import { getPool } from '@/db/pool';
import { getCabinet, logBusiness } from '@/lib/business';
import { BusinessError } from '@/lib/business-fields';
import { MAX_BUSINESS_POINTS, POINT_SAVES_PER_MINUTE, PointError, siteCity, type PointDrink, type PointInput, type PointKind } from '@/lib/business-point-fields';
import { companyDrinks, type CompanyDrink } from '@/lib/business-profile';
import { isFrozenError, frozenMessage } from '@/lib/moderation';
import { geocodeAnywhere, geocodeStoreAddress, hasStoreGeocoder } from '@/lib/store-geocoder';

/**
 * Точки продаж компании (миграция `0205`): где купить её напитки или где стоят её магазины. Добавляют и правят владелец
 * и менеджеры подтверждённой компании, аналитик только смотрит. Точка всегда на карте: координаты даёт геокодер по
 * адресу — в городах сайта в пределах 100 км от центра, в остальных — по России, и ответ должен назвать этот город.
 */
export interface BusinessPoint {
  id: string; name: string; kind: PointKind; city: string; address: string; latitude: number; longitude: number;
  hours: string | null; note: string | null; drinks: PointDrink[]; updatedAt: Date;
}
/** Точка для страницы: напитки уже с названиями и ссылками, только те, что компания подтвердила сейчас. */
export type PointView = Omit<BusinessPoint, 'drinks' | 'updatedAt'> & { drinks: Pick<CompanyDrink, 'brand' | 'name' | 'href'>[]; /** Те же напитки ключами формы: `["бренд","вкус"]`. */ drinkKeys: string[] };

const COLUMNS = `id, name, kind, city, address, latitude, longitude, hours, note, drinks, "updatedAt"`;
const key = (brand: string, flavor: string) => JSON.stringify([brand, flavor]);

export async function listBusinessPoints(businessId: string): Promise<BusinessPoint[]> {
  return (await getPool().query<BusinessPoint>(`select ${COLUMNS} from "businessPoint" where "businessId" = $1 order by city, name, "createdAt"`, [businessId])).rows;
}

/** Точки с напитками для показа: напиток, который компания больше не подтверждает, из точки пропадает сам. */
export async function pointViews(businessId: string, points?: BusinessPoint[]): Promise<PointView[]> {
  const [list, drinks] = await Promise.all([points ?? listBusinessPoints(businessId), companyDrinks(businessId)]);
  const known = new Map(drinks.map(drink => [key(drink.brand, drink.flavor), drink]));
  return list.map(({ updatedAt: _updatedAt, ...point }) => {
    const current = point.drinks.filter(item => known.has(key(item.brand, item.flavor)));
    return {
      ...point,
      drinks: current.map(item => { const drink = known.get(key(item.brand, item.flavor))!; return { brand: drink.brand, name: drink.name, href: drink.href }; }),
      drinkKeys: current.map(item => key(item.brand, item.flavor)),
    };
  });
}

async function pointEditor(userId: string) {
  const cabinet = await getCabinet(userId);
  if (!cabinet) throw new BusinessError('Сначала расскажите о компании.');
  if (cabinet.business.status !== 'approved') throw new BusinessError('Точки можно добавить, когда компанию подтвердят.');
  if (cabinet.role === 'analyst') throw new BusinessError('У роли «Аналитик» только просмотр — попросите владельца кабинета сменить роль.');
  return cabinet.business;
}

/** Адрес на карте: город сайта — в его окрестностях, другой — по России. Без ключа геокодера точку не сохранить. */
async function locate(input: PointInput) {
  if (!hasStoreGeocoder()) throw new BusinessError('Карта пока не подключена — точку не на что поставить. Напишите в поддержку.');
  const city = siteCity(input.city);
  const found = await (city ? geocodeStoreAddress(city.id, input.address) : geocodeAnywhere(input.city, input.address))
    .catch(() => { throw new BusinessError('Карта не ответила. Попробуйте сохранить ещё раз через минуту.'); });
  if (!found) throw new PointError(`Не нашли «${input.address}» в городе ${input.city}. Проверьте улицу и номер дома.`);
  return found;
}

/**
 * Новая точка (`id` — null) или правка своей. Адрес ищется заново, только если изменились город или адрес. Напитки —
 * только подтверждённые компанией, лимит точек и частота сохранений проверяются под блокировкой компании.
 */
export async function savePoint(userId: string, id: string | null, input: PointInput): Promise<{ id: string }> {
  const business = await pointEditor(userId);
  const own = new Set((await companyDrinks(business.id)).map(drink => key(drink.brand, drink.flavor)));
  const drinks = input.drinks.filter(drink => own.has(key(drink.brand, drink.flavor)));
  const before = id ? (await getPool().query<BusinessPoint>(`select ${COLUMNS} from "businessPoint" where id = $1 and "businessId" = $2`, [id, business.id])).rows[0] : null;
  if (id && !before) throw new BusinessError('Эта точка уже удалена — обновите страницу.');
  const moved = !before || before.city !== input.city || before.address !== input.address;
  // The address stays as the team wrote it: the geocoder's line starts with «Россия, Москва».
  const place = moved ? await locate(input) : before;
  const db = await getPool().connect();
  try {
    await db.query('begin');
    await db.query(`select pg_advisory_xact_lock(hashtext('business-point:' || $1))`, [business.id]);
    const { count, recent } = (await db.query<{ count: number; recent: number }>(`select count(*)::int as count,
        count(*) filter (where "updatedAt" > now() - interval '1 minute')::int as recent from "businessPoint" where "businessId" = $1`, [business.id])).rows[0]!;
    if (!before && count >= MAX_BUSINESS_POINTS) throw new BusinessError(`Не больше ${MAX_BUSINESS_POINTS} точек у компании.`);
    if (recent >= POINT_SAVES_PER_MINUTE) throw new BusinessError('Слишком много правок за минуту. Подождите немного и сохраните ещё раз.');
    const values = [input.name, input.kind, input.city, input.address, place.latitude, place.longitude, input.hours, input.note, JSON.stringify(drinks)];
    const saved = before
      ? await db.query<{ id: string }>(`update "businessPoint" set name = $3, kind = $4, city = $5, address = $6, latitude = $7, longitude = $8, hours = $9,
          note = $10, drinks = $11::jsonb, "updatedAt" = now() where id = $1 and "businessId" = $2 returning id`, [before.id, business.id, ...values])
      : await db.query<{ id: string }>(`insert into "businessPoint" ("businessId", "userId", name, kind, city, address, latitude, longitude, hours, note, drinks)
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb) returning id`, [business.id, userId, ...values]);
    await db.query('commit');
    await logBusiness(business.id, userId, before ? 'point-edit' : 'point', `${input.name} · ${input.city}`);
    return { id: saved.rows[0]!.id };
  } catch (error) {
    await db.query('rollback');
    if ((error as { code?: string }).code === '23505') throw new PointError('Точка с таким названием уже стоит по этому адресу.');
    if (isFrozenError(error)) throw new BusinessError(await frozenMessage(userId) ?? 'Публикации временно ограничены.');
    throw error;
  } finally { db.release(); }
}

export async function deletePoint(userId: string, id: string): Promise<void> {
  const business = await pointEditor(userId);
  const removed = (await getPool().query<{ name: string; city: string }>(`delete from "businessPoint" where id = $1 and "businessId" = $2 returning name, city`, [id, business.id])).rows[0];
  if (removed) await logBusiness(business.id, userId, 'point-delete', `${removed.name} · ${removed.city}`);
}
