import { getPool } from '@/db/pool';
import { getCabinet, logBusiness } from '@/lib/business';
import { BusinessError } from '@/lib/business-fields';
import { flavorName } from '@/lib/catalog-query';
import { editor } from '@/lib/brand-drink-stores';

/** A brand's recommended ceiling for one can volume of its drink. */
export interface DrinkPrice { id: string; volumeMl: number; maxPrice: number; business: string; updatedAt: Date }

const COLUMNS = `p.id, p."volumeMl", p."maxPrice"::float8 as "maxPrice", b.name as business, p."updatedAt"`;

/** The company's ceilings for one drink, smallest can first. */
export async function listDrinkPrices(businessId: string, brand: string, flavor: string): Promise<DrinkPrice[]> {
  return (await getPool().query<DrinkPrice>(`select ${COLUMNS} from "brandDrinkPrice" p join business b on b.id = p."businessId"
    where p."businessId" = $1 and p.brand = $2 and p.flavor = $3 order by p."volumeMl"`, [businessId, brand, flavor])).rows;
}

/** How many ceilings each of the company's drinks has, for the drinks menu. */
export async function countDrinkPrices(businessId: string): Promise<Map<string, number>> {
  const rows = (await getPool().query<{ brand: string; flavor: string; count: number }>(`select brand, flavor, count(*)::int as count
    from "brandDrinkPrice" where "businessId" = $1 group by 1, 2`, [businessId])).rows;
  return new Map(rows.map(row => [JSON.stringify([row.brand, row.flavor]), row.count]));
}

/** Sets (or replaces) the ceiling of one volume. */
export async function setDrinkPrice(userId: string, brand: string, flavor: string, input: { volumeMl: number; maxPrice: number }): Promise<void> {
  const business = await editor(userId, brand, flavor);
  await getPool().query(`insert into "brandDrinkPrice"("businessId", "userId", brand, flavor, "volumeMl", "maxPrice") values ($1, $2, $3, $4, $5, $6)
    on conflict ("businessId", brand, flavor, "volumeMl") do update set "maxPrice" = excluded."maxPrice", "userId" = excluded."userId", "updatedAt" = now()`,
  [business.id, userId, brand, flavor, input.volumeMl, input.maxPrice]);
  await logBusiness(business.id, userId, 'drink-price', `${brand} · ${flavorName(flavor)} · ${input.volumeMl} мл · до ${input.maxPrice} ₽`);
}

export async function removeDrinkPrice(userId: string, id: string): Promise<void> {
  const cabinet = await getCabinet(userId);
  if (!cabinet || cabinet.role === 'analyst') throw new BusinessError('У роли «Аналитик» только просмотр.');
  const removed = await getPool().query<{ brand: string; flavor: string; volumeMl: number }>(`delete from "brandDrinkPrice" where id = $1 and "businessId" = $2
    returning brand, flavor, "volumeMl"`, [id, cabinet.business.id]);
  const row = removed.rows[0];
  if (row) await logBusiness(cabinet.business.id, userId, 'drink-price-remove', `${row.brand} · ${flavorName(row.flavor)} · ${row.volumeMl} мл`);
}

/**
 * The ceilings the drink page shows next to shop prices: from approved companies with the drink approved for them.
 * Two companies with the same drink are rare; then the lower ceiling of a volume wins.
 */
export async function getBrandPrices(brand: string, flavor: string): Promise<DrinkPrice[]> {
  const rows = (await getPool().query<DrinkPrice>(`select ${COLUMNS} from "brandDrinkPrice" p join business b on b.id = p."businessId" and b.status = 'approved'
    join "businessDrink" bd on bd."businessId" = p."businessId" and bd.brand = p.brand and bd.flavor = p.flavor and bd.status = 'approved'
    where p.brand = $1 and p.flavor = $2 order by p."volumeMl", p."maxPrice"`, [brand, flavor])).rows;
  return rows.filter((row, index) => rows.findIndex(other => other.volumeMl === row.volumeMl) === index);
}
