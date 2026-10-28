import { CITIES } from '@canrush/shared';
import { getPool } from '@/db/pool';
import { getCabinet, logBusiness } from '@/lib/business';
import { BusinessError } from '@/lib/business-fields';
import { flavorName } from '@/lib/catalog-query';
import { MAX_DRINK_STORES, type DrinkStoreInput, type DrinkStoreKind } from '@/lib/brand-drink-store-fields';

/** One «Где купить» line: a store on the CanRush map, a chain, or the brand's own store. */
export interface DrinkStore {
  id: string; kind: DrinkStoreKind; name: string; address: string | null; city: string | null;
  url: string | null; storeId: string | null; retailer: string | null; business: string; createdAt: Date;
}
export interface StoreOption { id: string; name: string; address: string; city: string }

const cityName = (id: string | null) => id ? CITIES.find(city => city.id === id)?.name ?? id : null;
const COLUMNS = `d.id, d.kind, coalesce(s.name, d.retailer, d.name) as name, coalesce(s.address, d.address) as address,
  coalesce(s.city, d.city) as city, d.url, d."storeId", d.retailer, b.name as business, d."createdAt"`;
const toStore = (row: DrinkStore): DrinkStore => ({ ...row, city: row.kind === 'store' ? cityName(row.city) : row.city });

/** Owner or manager of an approved company, and the drink is approved for it (also the price ceiling's check). */
export async function editor(userId: string, brand: string, flavor: string) {
  const cabinet = await getCabinet(userId);
  if (!cabinet || cabinet.business.status !== 'approved') throw new BusinessError('Это может подтверждённая компания.');
  if (cabinet.role === 'analyst') throw new BusinessError('У роли «Аналитик» только просмотр.');
  const owned = await getPool().query(`select 1 from "businessDrink" where "businessId" = $1 and brand = $2 and flavor = $3 and status = 'approved'`, [cabinet.business.id, brand, flavor]);
  if (!owned.rowCount) throw new BusinessError('Только для подтверждённых напитков компании.');
  return cabinet.business;
}

/** The company's list for one drink, in the order it was built. */
export async function listDrinkStores(businessId: string, brand: string, flavor: string): Promise<DrinkStore[]> {
  return (await getPool().query<DrinkStore>(`select ${COLUMNS} from "brandDrinkStore" d join business b on b.id = d."businessId"
    left join "marketStore" s on s.id = d."storeId" where d."businessId" = $1 and d.brand = $2 and d.flavor = $3 order by d."createdAt"`,
  [businessId, brand, flavor])).rows.map(toStore);
}

/** How many places each of the company's drinks lists, for the drinks table. */
export async function countDrinkStores(businessId: string): Promise<Map<string, number>> {
  const rows = (await getPool().query<{ brand: string; flavor: string; count: number }>(`select brand, flavor, count(*)::int as count
    from "brandDrinkStore" where "businessId" = $1 group by 1, 2`, [businessId])).rows;
  return new Map(rows.map(row => [JSON.stringify([row.brand, row.flavor]), row.count]));
}

export async function addDrinkStore(userId: string, brand: string, flavor: string, input: DrinkStoreInput): Promise<void> {
  const business = await editor(userId, brand, flavor);
  const db = await getPool().connect();
  try {
    await db.query('begin');
    // One list per drink at a time, so two tabs cannot both pass the limit.
    await db.query(`select pg_advisory_xact_lock(hashtext('brand-drink-store:' || $1 || ':' || $2 || ':' || $3))`, [business.id, brand, flavor]);
    const count = (await db.query<{ count: number }>(`select count(*)::int as count from "brandDrinkStore" where "businessId" = $1 and brand = $2 and flavor = $3`, [business.id, brand, flavor])).rows[0]!.count;
    if (count >= MAX_DRINK_STORES) throw new BusinessError(`Не больше ${MAX_DRINK_STORES} мест для одного напитка.`);
    if (input.kind === 'store') {
      const store = await db.query(`select 1 from "marketStore" where id = $1 and status = 'published'`, [input.storeId]);
      if (!store.rowCount) throw new BusinessError('Этот магазин не найден на карте CanRush.');
    }
    await db.query(`insert into "brandDrinkStore"("businessId", "userId", brand, flavor, kind, "storeId", retailer, name, url, address, city)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`, [business.id, userId, brand, flavor, input.kind,
      input.kind === 'store' ? input.storeId : null, input.kind === 'retailer' ? input.retailer : null,
      input.kind === 'custom' ? input.name : null, input.kind === 'custom' ? input.url : null,
      input.kind === 'custom' ? input.address : null, input.kind === 'custom' ? input.city : null])
      .catch((error: { code?: string }) => { if (error.code === '23505') throw new BusinessError('Это место уже в списке.'); throw error; });
    await db.query('commit');
  } catch (error) { await db.query('rollback'); throw error; } finally { db.release(); }
  await logBusiness(business.id, userId, 'drink-store', `${brand} · ${flavorName(flavor)}`);
}

export async function removeDrinkStore(userId: string, id: string): Promise<void> {
  const cabinet = await getCabinet(userId);
  if (!cabinet || cabinet.role === 'analyst') throw new BusinessError('У роли «Аналитик» только просмотр.');
  const removed = await getPool().query<{ brand: string; flavor: string }>(`delete from "brandDrinkStore" where id = $1 and "businessId" = $2 returning brand, flavor`, [id, cabinet.business.id]);
  const row = removed.rows[0];
  if (row) await logBusiness(cabinet.business.id, userId, 'drink-store-remove', `${row.brand} · ${flavorName(row.flavor)}`);
}

/**
 * «Где купить» on the drink page: what approved companies list for a drink approved for them. A CanRush store shows
 * only while it is published; chains and the brand's own stores as they were added.
 */
export async function getBrandStores(brand: string, flavor: string): Promise<DrinkStore[]> {
  return (await getPool().query<DrinkStore>(`select ${COLUMNS} from "brandDrinkStore" d join business b on b.id = d."businessId" and b.status = 'approved'
    join "businessDrink" bd on bd."businessId" = d."businessId" and bd.brand = d.brand and bd.flavor = d.flavor and bd.status = 'approved'
    left join "marketStore" s on s.id = d."storeId"
    where d.brand = $1 and d.flavor = $2 and (d."storeId" is null or s.status = 'published')
    order by case d.kind when 'retailer' then 0 when 'store' then 1 else 2 end, d."createdAt" limit 40`, [brand, flavor])).rows.map(toStore);
}

/** Published stores of the CanRush map for the cabinet's picker. */
export async function storeOptions(): Promise<StoreOption[]> {
  return (await getPool().query<StoreOption>(`select id, name, address, city from "marketStore" where status = 'published' order by name limit 2000`)).rows
    .map(row => ({ ...row, city: cityName(row.city) ?? '' }));
}
