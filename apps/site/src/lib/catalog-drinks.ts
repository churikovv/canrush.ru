import { canonicalProductFlavor, reviewedProductIdentity, type CatalogGroup, type PublishedIngredients } from '@canrush/shared';
import { cache } from 'react';
import { getPool } from '@/db/pool';
import { readAllCatalogGroups } from '@/lib/catalog-files';
import { catalogGroupSlug, flavorName } from '@/lib/catalog-query';
import { CatalogDrinkError, MAX_PENDING_DRINKS, type CatalogDrinkInput } from '@/lib/catalog-drink-fields';
import type { PreparedReviewPhoto } from '@/lib/review-photos';

export type CatalogDrinkStatus = 'pending' | 'published' | 'rejected';
export interface CatalogDrink {
  id: string; brand: string; flavor: string; name: string; volumes: number[]; ingredients: string; status: CatalogDrinkStatus;
  moderationNote: string; createdAt: Date; updatedAt: Date; href: string; photo: string;
  /** Avatar, tag and XP as every author row shows them; `drinks` — how many of their drinks are published. */
  author: { id: string; username: string | null; name: string; avatarId: string | null; tag: string | null; xp: number; drinks: number };
}
/** A duplicate of a drink the catalog already has: the form links to it. */
export class CatalogDrinkDuplicate extends CatalogDrinkError {
  constructor(message: string, readonly href: string) { super(message); }
}

const COLUMNS = `d.id, d.brand, d.flavor, d.volumes, d.ingredients, d.status, d."moderationNote", d."createdAt", d."updatedAt",
  d."ownerId", u.username, u.name, (select id::text from "profileImage" where "userId" = u.id and kind = 'avatar') as "avatarId",
  coalesce((select xp from "profileRanking" where id = u.id), 0) as xp,
  case when u."profileTags"[1] = 'admin' then case when exists(select 1 from "siteAdmin" where email = lower(u.email)) then 'admin' end
    when exists(select 1 from "profileAchievement" where "userId" = u.id and key = u."profileTags"[1]) then u."profileTags"[1] end as tag,
  (select count(*)::int from "catalogDrink" o where o."ownerId" = d."ownerId" and o.status = 'published') as drinks`;
interface Row { id: string; brand: string; flavor: string; volumes: number[]; ingredients: string; status: CatalogDrinkStatus; moderationNote: string; createdAt: Date; updatedAt: Date; ownerId: string; username: string | null; name: string; avatarId: string | null; xp: number; tag: string | null; drinks: number }
const toDrink = (row: Row): CatalogDrink => ({
  id: row.id, brand: row.brand, flavor: row.flavor, name: flavorName(row.flavor), volumes: row.volumes, ingredients: row.ingredients,
  status: row.status, moderationNote: row.moderationNote, createdAt: row.createdAt, updatedAt: row.updatedAt,
  href: `/catalog/${catalogGroupSlug(row.brand, row.flavor)}`, photo: `/api/catalog-drinks/${row.id}`,
  author: { id: row.ownerId, username: row.username, name: row.name, avatarId: row.avatarId, tag: row.tag, xp: Number(row.xp), drinks: row.drinks },
});
const VISIBLE_AUTHOR = 'not exists(select 1 from "userBlock" b where b."userId" = d."ownerId")';

/** Published drinks of members whose accounts are not blocked; read once per request. */
export const getPublishedCatalogDrinks = cache(async (): Promise<CatalogDrink[]> => {
  const { rows } = await getPool().query<Row>(`select ${COLUMNS} from "catalogDrink" d join "user" u on u.id = d."ownerId"
    where d.status = 'published' and ${VISIBLE_AUTHOR} order by d."reviewedAt" desc nulls last, d."createdAt" desc`);
  return rows.map(toDrink);
});

/** The same drinks as catalog groups: no offers yet, the member's photo as the cover. */
export async function catalogDrinkGroups(): Promise<CatalogGroup[]> {
  return (await getPublishedCatalogDrinks()).map(drink => ({ brand: drink.brand, flavor: drink.flavor, variants: [], minPrice: 0, coverImageUrl: drink.photo }));
}

export async function getCatalogDrink(brand: string, flavor: string): Promise<CatalogDrink | null> {
  return (await getPublishedCatalogDrinks()).find(drink => drink.brand === brand && drink.flavor === flavor) ?? null;
}

/** The label text a member typed, shown in the «Состав» block like a store's unverified card. */
export function catalogDrinkIngredients(drink: CatalogDrink): PublishedIngredients | null {
  if (!drink.ingredients) return null;
  return {
    brand: drink.brand, flavor: drink.flavor, productTitle: `${drink.brand} ${drink.name}`, volumeMl: drink.volumes[0] ?? 0, market: 'RU',
    ingredients: drink.ingredients, sourceName: 'Участник CanRush', fetchedAt: drink.createdAt.toISOString(), status: 'unverified',
  };
}

const lower = (value: string) => value.toLocaleLowerCase('ru-RU');

/**
 * Sends a drink for moderation. The brand takes the catalog's spelling when it is already known, and the drink must not
 * be in the catalog or in another live request (the unique index catches a race).
 */
export async function submitCatalogDrink(userId: string, input: CatalogDrinkInput, photo: PreparedReviewPhoto | undefined): Promise<string> {
  if (!photo) throw new CatalogDrinkError('Добавьте фото банки.');
  const files = await readAllCatalogGroups();
  const published = await catalogDrinkGroups();
  const brand = [...files, ...published].find(group => lower(group.brand) === lower(input.brand))?.brand ?? input.brand;
  const identity = reviewedProductIdentity(brand, canonicalProductFlavor(brand, input.flavor));
  const existing = [...files, ...published].find(group => lower(group.brand) === lower(identity.brand) && lower(group.flavor) === lower(identity.flavor));
  if (existing) throw new CatalogDrinkDuplicate('Такой напиток уже есть в каталоге.', `/catalog/${catalogGroupSlug(existing.brand, existing.flavor)}`);
  const db = await getPool().connect();
  try {
    await db.query('begin');
    await db.query('select id from "user" where id = $1 for update', [userId]);
    if ((await db.query('select 1 from "userBlock" where "userId" = $1', [userId])).rowCount) throw new CatalogDrinkError('Добавление напитков для аккаунта ограничено.');
    const counts = await db.query<{ pending: number; recent: boolean }>(`select count(*) filter (where status = 'pending')::int as pending,
      coalesce(bool_or("createdAt" > now() - interval '60 seconds'), false) as recent from "catalogDrink" where "ownerId" = $1`, [userId]);
    if (counts.rows[0]!.pending >= MAX_PENDING_DRINKS || counts.rows[0]!.recent) {
      throw new CatalogDrinkError(`Подождите минуту между заявками. Одновременно на проверке может быть до ${MAX_PENDING_DRINKS} напитков.`);
    }
    const result = await db.query<{ id: string }>(`insert into "catalogDrink"("ownerId", brand, flavor, volumes, ingredients, photo, thumbnail)
      values ($1, $2, $3, $4, $5, $6, $7) returning id`, [userId, identity.brand, identity.flavor, input.volumes, input.ingredients, photo.data, photo.thumbnail]);
    await db.query('commit');
    return result.rows[0]!.id;
  } catch (error) {
    await db.query('rollback');
    if ((error as { code?: string }).code === '23505') throw new CatalogDrinkError('Этот напиток уже ждёт проверки.');
    throw error;
  } finally { db.release(); }
}

export async function moderateCatalogDrink(adminId: string, id: string, status: 'published' | 'rejected', note: string, version: string) {
  if (!['published', 'rejected'].includes(status) || note.length > 500 || (status === 'rejected' && !note.trim())) throw new CatalogDrinkError('Для отклонения укажите причину (до 500 символов).');
  const result = await getPool().query(`update "catalogDrink" d set status = $3, "moderationNote" = $4, "reviewedBy" = $1, "reviewedAt" = now(), "updatedAt" = clock_timestamp()
    where id = $2 and status = 'pending' and date_trunc('milliseconds', "updatedAt") = $5::timestamptz
      and exists(select 1 from "user" u join "siteAdmin" a on lower(u.email) = a.email where u.id = $1) and ${VISIBLE_AUTHOR} returning id`,
  [adminId, id, status, note.trim(), version]);
  if (!result.rowCount) throw new CatalogDrinkError('Заявка изменилась, уже проверена или автор заблокирован. Обновите страницу.');
}

export async function listPendingCatalogDrinks(page = 1, size = 20): Promise<{ items: CatalogDrink[]; hasMore: boolean }> {
  const { rows } = await getPool().query<Row>(`select ${COLUMNS} from "catalogDrink" d join "user" u on u.id = d."ownerId"
    where d.status = 'pending' and ${VISIBLE_AUTHOR} order by d."createdAt" limit $1 offset $2`, [size + 1, (page - 1) * size]);
  return { items: rows.slice(0, size).map(toDrink), hasMore: rows.length > size };
}

/** The member's own requests with their status and the moderator's note. */
export async function listOwnCatalogDrinks(userId: string): Promise<CatalogDrink[]> {
  const { rows } = await getPool().query<Row>(`select ${COLUMNS} from "catalogDrink" d join "user" u on u.id = d."ownerId"
    where d."ownerId" = $1 order by d."createdAt" desc limit 50`, [userId]);
  return rows.map(toDrink);
}

/** Photo bytes: published drinks for everyone, others only for their author and admins. */
export async function getCatalogDrinkPhoto(id: string, userId: string | null, thumbnail: boolean): Promise<{ data: Buffer; published: boolean } | null> {
  const { rows } = await getPool().query<{ data: Buffer; published: boolean }>(`select ${thumbnail ? 'd.thumbnail' : 'd.photo'} as data,
      d.status = 'published' and ${VISIBLE_AUTHOR} as published
    from "catalogDrink" d where d.id = $1 and ((d.status = 'published' and ${VISIBLE_AUTHOR}) or d."ownerId" = $2
      or exists(select 1 from "user" u join "siteAdmin" a on lower(u.email) = a.email where u.id = $2))`, [id, userId]);
  return rows[0] ?? null;
}
