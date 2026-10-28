import { brandPhotoUrl as photoUrl } from '@/lib/brand-covers';
import { getPool } from '@/db/pool';
import { getCabinet, logBusiness } from '@/lib/business';
import { BusinessError } from '@/lib/business-fields';
import { flavorName } from '@/lib/catalog-query';
import type { DrinkEditInput } from '@/lib/brand-drink-edit-fields';
import type { PreparedReviewPhoto } from '@/lib/review-photos';
import type { PublishedIngredients } from '@canrush/shared';

export type DrinkEditStatus = 'pending' | 'approved' | 'rejected';
export interface DrinkEdit {
  id: string; brand: string; flavor: string; name: string; business: string; author: string | null;
  fullName: string | null; ingredients: string | null; description: string | null; note: string | null; hasPhoto: boolean;
  status: DrinkEditStatus; moderationNote: string | null; createdAt: Date; reviewedAt: Date | null;
}
/** What the card shows from the brand once an edit is approved. */
export interface BrandProfile { id: string; business: string | null; fullName: string | null; ingredients: string | null; description: string | null; photo: string | null; updatedAt: Date }

const EDIT_COLUMNS = `e.id, e.brand, e.flavor, b.name as business, u.username as author, e."fullName", e.ingredients, e.description, e.note,
  e.photo is not null as "hasPhoto", e.status, e."moderationNote", e."createdAt", e."reviewedAt"`;
const toEdit = (row: Omit<DrinkEdit, 'name'>): DrinkEdit => ({ ...row, name: `${row.brand} · ${flavorName(row.flavor)}` });

/**
 * A company proposes a correction of one of its approved drinks (owner or manager): only changed fields, at most one
 * edit waiting per drink. The team decides in the admin's «Компании».
 */
export async function requestDrinkEdit(userId: string, brand: string, flavor: string, input: DrinkEditInput, photo?: PreparedReviewPhoto): Promise<string> {
  const cabinet = await getCabinet(userId);
  if (!cabinet || cabinet.business.status !== 'approved') throw new BusinessError('Править карточки может подтверждённая компания.');
  if (cabinet.role === 'analyst') throw new BusinessError('У роли «Аналитик» только просмотр.');
  const db = getPool();
  const owned = await db.query(`select 1 from "businessDrink" where "businessId" = $1 and brand = $2 and flavor = $3 and status = 'approved'`, [cabinet.business.id, brand, flavor]);
  if (!owned.rowCount) throw new BusinessError('Править можно только подтверждённые напитки компании.');
  const result = await db.query<{ id: string }>(`insert into "brandDrinkEdit"("businessId", "userId", brand, flavor, "fullName", ingredients, description, note, photo, thumbnail)
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
  [cabinet.business.id, userId, brand, flavor, input.fullName, input.ingredients, input.description, input.note, photo?.data ?? null, photo?.thumbnail ?? null])
    .catch((error: { code?: string }) => { if (error.code === '23505') throw new BusinessError('Правка этого напитка уже ждёт проверки.'); throw error; });
  await logBusiness(cabinet.business.id, userId, 'drink-edit', `${brand} · ${flavorName(flavor)}`);
  return result.rows[0]!.id;
}

/** The company's edits, newest first, for the cabinet's drinks. */
export async function listDrinkEdits(businessId: string): Promise<DrinkEdit[]> {
  return (await getPool().query<Omit<DrinkEdit, 'name'>>(`select ${EDIT_COLUMNS} from "brandDrinkEdit" e join business b on b.id = e."businessId"
    left join "user" u on u.id = e."userId" where e."businessId" = $1 order by e."createdAt" desc limit 100`, [businessId])).rows.map(toEdit);
}

/** The team's queue (oldest first) or its history. */
export async function listDrinkEditsForAdmin(status: DrinkEditStatus = 'pending'): Promise<DrinkEdit[]> {
  return (await getPool().query<Omit<DrinkEdit, 'name'>>(`select ${EDIT_COLUMNS} from "brandDrinkEdit" e join business b on b.id = e."businessId"
    left join "user" u on u.id = e."userId" where e.status = $1 order by e."createdAt" ${status === 'pending' ? 'asc' : 'desc'} limit 100`, [status])).rows.map(toEdit);
}

/**
 * The team's decision. Approving merges the edit into the drink's brand profile — fields the edit left empty keep
 * their earlier value — in one transaction with the admin log; rejecting needs a reason the company sees.
 */
export async function moderateDrinkEdit(adminId: string, id: string, status: 'approved' | 'rejected', note: string): Promise<void> {
  if (status === 'rejected' && !note.trim()) throw new BusinessError('Напишите причину отказа.');
  const db = await getPool().connect();
  try {
    await db.query('begin');
    const staff = (await db.query<{ email: string }>(`select a.email from "user" u join "siteAdmin" a on a.email = lower(u.email) where u.id = $1`, [adminId])).rows[0];
    if (!staff) throw new BusinessError('Решение принимает только команда.');
    const edit = (await db.query<{ businessId: string; brand: string; flavor: string }>(
      `update "brandDrinkEdit" set status = $2, "moderationNote" = $3, "reviewedBy" = $4, "reviewedAt" = now() where id = $1 and status = 'pending'
       returning "businessId", brand, flavor`, [id, status, status === 'rejected' ? note.trim().slice(0, 500) : null, adminId])).rows[0];
    if (!edit) throw new BusinessError('Правка уже рассмотрена.');
    if (status === 'approved') await db.query(
      `insert into "brandDrinkProfile"(brand, flavor, "businessId", "fullName", ingredients, description, photo, thumbnail)
       select brand, flavor, "businessId", "fullName", ingredients, description, photo, thumbnail from "brandDrinkEdit" where id = $1
       on conflict (brand, flavor) do update set "businessId" = excluded."businessId",
         "fullName" = coalesce(excluded."fullName", "brandDrinkProfile"."fullName"), ingredients = coalesce(excluded.ingredients, "brandDrinkProfile".ingredients),
         description = coalesce(excluded.description, "brandDrinkProfile".description),
         photo = coalesce(excluded.photo, "brandDrinkProfile".photo), thumbnail = coalesce(excluded.thumbnail, "brandDrinkProfile".thumbnail), "updatedAt" = clock_timestamp()`, [id]);
    await db.query('insert into "adminAuditLog" ("adminEmail", action, "targetType", "targetId") values ($1, $2, $3, $4)', [staff.email, status === 'approved' ? 'approve' : 'reject', 'brand-drink-edit', id]);
    await db.query('commit');
  } catch (error) { await db.query('rollback'); throw error; } finally { db.release(); }
}

/** The brand's data of one drink for its page, or null. */
export async function getBrandProfile(brand: string, flavor: string): Promise<BrandProfile | null> {
  const row = (await getPool().query<{ id: string; business: string | null; fullName: string | null; ingredients: string | null; description: string | null; hasPhoto: boolean; updatedAt: Date }>(
    `select p.id, b.name as business, p."fullName", p.ingredients, p.description, p.photo is not null as "hasPhoto", p."updatedAt"
     from "brandDrinkProfile" p left join business b on b.id = p."businessId" where p.brand = $1 and p.flavor = $2`, [brand, flavor])).rows[0];
  return row ? { id: row.id, business: row.business, fullName: row.fullName, ingredients: row.ingredients, description: row.description, photo: row.hasPhoto ? photoUrl(row.id, row.updatedAt) : null, updatedAt: row.updatedAt } : null;
}

/** The composition the brand gave, in the shape of the «Состав» block: a reviewed source, the brand itself. */
export function brandIngredients(profile: BrandProfile, brand: string, flavor: string, volumeMl = 0): PublishedIngredients | null {
  if (!profile.ingredients) return null;
  return { brand, flavor, productTitle: `${brand} ${flavorName(flavor)}`, volumeMl: volumeMl || 450, market: 'RU', ingredients: profile.ingredients,
    sourceName: profile.business ? `Бренд «${profile.business}»` : 'Бренд', fetchedAt: profile.updatedAt.toISOString(), status: 'source_reported' };
}

/** A photo by profile id (public) or by edit id (the company's team and staff only — `edit`). */
export async function getBrandDrinkPhoto(id: string, size: 'full' | 'thumbnail'): Promise<Buffer | null> {
  const column = size === 'thumbnail' ? 'thumbnail' : 'photo';
  return (await getPool().query<{ data: Buffer }>(`select ${column} as data from "brandDrinkProfile" where id = $1 and photo is not null`, [id])).rows[0]?.data ?? null;
}
export async function getDrinkEditPhoto(id: string, viewerId: string, staff: boolean, size: 'full' | 'thumbnail'): Promise<Buffer | null> {
  const column = size === 'thumbnail' ? 'thumbnail' : 'photo';
  return (await getPool().query<{ data: Buffer }>(`select e.${column} as data from "brandDrinkEdit" e join business b on b.id = e."businessId"
    where e.id = $1 and e.photo is not null and ($3::boolean or b."ownerId" = $2 or exists(select 1 from "businessMember" m where m."businessId" = b.id and m."userId" = $2 and m.status = 'active'))`,
  [id, viewerId, staff])).rows[0]?.data ?? null;
}
