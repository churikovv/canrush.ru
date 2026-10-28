import { canonicalProductFlavor, reviewedProductIdentity, type CatalogGroup, type PublishedIngredients } from '@canrush/shared';
import { cache } from 'react';
import { getPool } from '@/db/pool';
import { readAllCatalogGroups } from '@/lib/catalog-files';
import { catalogGroupSlug, flavorName } from '@/lib/catalog-query';
import { CatalogDrinkError, MAX_PENDING_DRINKS, type CatalogDrinkEdit, type CatalogDrinkInput } from '@/lib/catalog-drink-fields';
import type { PreparedReviewPhoto } from '@/lib/review-photos';
import { SUSPECT } from '@/lib/drink-duplicate-check';

export type CatalogDrinkStatus = 'pending' | 'published' | 'rejected';
export interface CatalogDrink {
  id: string; brand: string; flavor: string; name: string; /** The full name from the can, '' when not given. */ fullName: string; volumes: number[]; ingredients: string; status: CatalogDrinkStatus;
  /** No longer made: in the catalog's archive, not in the main list. */ discontinued: boolean;
  moderationNote: string; createdAt: Date; updatedAt: Date; href: string; photo: string;
  /** The company whose cabinet published it without the queue (migration 0127), or null. */
  business: string | null;
  /** Avatar, tag and XP as every author row shows them; `drinks` — how many of their drinks are published. */
  author: { id: string; username: string | null; name: string; avatarId: string | null; tag: string | null; xp: number; drinks: number };
}
/**
 * A duplicate of a drink the catalog already has or that waits in another member's request: the form links to it.
 * `confirmable` — the member may still send their own version after the warning (the moderator then compares, renames
 * or merges it); only an admin's rename onto a taken identity is refused outright.
 */
export class CatalogDrinkDuplicate extends CatalogDrinkError {
  constructor(message: string, readonly href: string, readonly confirmable = false) { super(message); }
}

/** The parser's card with this identity, if any: a member drink under it would stay hidden behind that card. */
export async function catalogFileMatch(brand: string, flavor: string): Promise<CatalogGroup | undefined> {
  return (await readAllCatalogGroups()).find(group => lower(group.brand) === lower(brand) && lower(group.flavor) === lower(flavor));
}

const COLUMNS = `d.id, d.brand, d.flavor, d."fullName", d.volumes, d.ingredients, d.status, d.discontinued, d."moderationNote", d."createdAt", d."updatedAt",
  d."ownerId", u.username, u.name, (select id::text from "profileImage" where "userId" = u.id and kind = 'avatar') as "avatarId",
  coalesce((select sum(points) from "profileExperience" where "userId" = u.id), 0)::int as xp,
  case when u."profileTags"[1] in ('admin', 'moderator') then case when exists(select 1 from "siteAdmin" where email = lower(u.email) and role = u."profileTags"[1]) then u."profileTags"[1] end
    when exists(select 1 from "profileAchievement" where "userId" = u.id and key = u."profileTags"[1]) then u."profileTags"[1] end as tag,
  (select count(*)::int from "catalogDrink" o where o."ownerId" = d."ownerId" and o.status = 'published') as drinks,
  (select name from business where id = d."businessId" and status = 'approved') as business`;
interface Row { id: string; brand: string; flavor: string; fullName: string; volumes: number[]; ingredients: string; status: CatalogDrinkStatus; discontinued: boolean; moderationNote: string; createdAt: Date; updatedAt: Date; ownerId: string; username: string | null; name: string; avatarId: string | null; xp: number; tag: string | null; drinks: number; business: string | null }
/** The photo's address carries `updatedAt` in the path: a new photo gets a new URL past the hour of public caching. */
const drinkPhotoUrl = (id: string, updatedAt: Date) => `/api/catalog-drinks/${id}/${updatedAt.getTime()}`;
const toDrink = (row: Row): CatalogDrink => ({
  id: row.id, brand: row.brand, flavor: row.flavor, name: flavorName(row.flavor), fullName: row.fullName, volumes: row.volumes, ingredients: row.ingredients,
  status: row.status, discontinued: row.discontinued, moderationNote: row.moderationNote, createdAt: row.createdAt, updatedAt: row.updatedAt,
  href: `/catalog/${catalogGroupSlug(row.brand, row.flavor)}`, photo: drinkPhotoUrl(row.id, row.updatedAt), business: row.business ?? null,
  author: { id: row.ownerId, username: row.username, name: row.name, avatarId: row.avatarId, tag: row.tag, xp: Number(row.xp), drinks: row.drinks },
});
const VISIBLE_AUTHOR = 'not exists(select 1 from "userBlock" b where b."userId" = d."ownerId")';

/**
 * The catalog's view of published member drinks: identity, full name and the photo address, nothing about the author.
 * Every page that loads the catalog reads it, so it stays one cheap scan; the author's avatar, XP and tag (COLUMNS)
 * are only for the drink's own page and the admin.
 */
const getPublishedDrinkIdentities = cache(async () => (await getPool().query<{ id: string; brand: string; flavor: string; fullName: string; updatedAt: Date; byBrand: boolean; discontinued: boolean }>(
  `select d.id, d.brand, d.flavor, d."fullName", d."updatedAt", d.discontinued,
     exists(select 1 from business b where b.id = d."businessId" and b.status = 'approved') as "byBrand" from "catalogDrink" d
   where d.status = 'published' and ${VISIBLE_AUTHOR} order by d."reviewedAt" desc nulls last, d."createdAt" desc`)).rows);

type PublishedDrink = Awaited<ReturnType<typeof getPublishedDrinkIdentities>>[number];
const drinkGroup = (drink: PublishedDrink): CatalogGroup => ({ brand: drink.brand, flavor: drink.flavor, variants: [], minPrice: 0,
  coverImageUrl: drinkPhotoUrl(drink.id, drink.updatedAt), ...(drink.fullName ? { fullName: drink.fullName } : {}) });

/**
 * The same drinks as catalog groups: no offers yet, the member's or the brand's photo as the cover. Discontinued ones
 * only with `archived` — like the parser's archive they live on for reviews, search and the official tier list.
 */
export async function catalogDrinkGroups({ archived = true }: { archived?: boolean } = {}): Promise<CatalogGroup[]> {
  return (await getPublishedDrinkIdentities()).filter(drink => archived || !drink.discontinued).map(drinkGroup);
}

/**
 * The same, split by who added them: drinks an approved company published from its cabinet are the brand's own
 * product and stand in the catalog like any drink; members' drinks keep their block «Добавлены участниками».
 */
export async function catalogDrinkGroupsByOrigin(): Promise<{ brands: CatalogGroup[]; members: CatalogGroup[] }> {
  // Discontinued drinks are left out: the catalog finds them in its archive (`loadAllCatalogGroups`) while searching.
  const drinks = (await getPublishedDrinkIdentities()).filter(drink => !drink.discontinued);
  return { brands: drinks.filter(drink => drink.byBrand).map(drinkGroup), members: drinks.filter(drink => !drink.byBrand).map(drinkGroup) };
}

/**
 * `groups` plus the published member drinks they do not already have — for lists that otherwise take only drinks in
 * shops (the tier list picker, the dating deck, «Тебе понравится»), which skip discontinued drinks; the whole catalog
 * (`archived`) keeps them, as it keeps the parser's archive.
 */
export async function withCatalogDrinks(groups: CatalogGroup[], { archived = false }: { archived?: boolean } = {}): Promise<CatalogGroup[]> {
  const added = await catalogDrinkGroups({ archived }).catch(() => []);
  const known = new Set(groups.map(group => JSON.stringify([group.brand, group.flavor])));
  return [...groups, ...added.filter(group => !known.has(JSON.stringify([group.brand, group.flavor])))];
}

/** One published drink with its author, for the drink's page. */
export async function getCatalogDrink(brand: string, flavor: string): Promise<CatalogDrink | null> {
  const { rows } = await getPool().query<Row>(`select ${COLUMNS} from "catalogDrink" d join "user" u on u.id = d."ownerId"
    where d.status = 'published' and d.brand = $1 and d.flavor = $2 and ${VISIBLE_AUTHOR} limit 1`, [brand, flavor]);
  return rows[0] ? toDrink(rows[0]) : null;
}

/** The label text a member typed, shown in the «Состав» block like a store's unverified card. */
export function catalogDrinkIngredients(drink: CatalogDrink): PublishedIngredients | null {
  if (!drink.ingredients) return null;
  return {
    brand: drink.brand, flavor: drink.flavor, productTitle: `${drink.brand} ${drink.name}`, volumeMl: drink.volumes[0] ?? 0, market: 'RU',
    ingredients: drink.ingredients, fetchedAt: drink.createdAt.toISOString(),
    // A company's drink: the label as the brand gave it; a member's stays unverified.
    ...(drink.business ? { sourceName: `Бренд «${drink.business}»`, status: 'source_reported' as const } : { sourceName: 'Участник CanRush', status: 'unverified' as const }),
  };
}

const lower = (value: string) => value.toLocaleLowerCase('ru-RU');

/**
 * Sends a drink for moderation. The brand takes the catalog's spelling when it is already known. A drink the catalog
 * already has — a parser card or another member's drink — or that waits in another member's request is refused with a
 * warning first and goes through with `confirmMatch`, as the member's own version of it: the moderator renames or
 * merges it, publishing it as is fails (`catalog_drink_identity` holds one published drink per identity). The member's
 * own waiting request for the same drink is refused (`catalog_drink_owner_pending` catches a race).
 */
/**
 * `businessId` — sent from the cabinet of an approved company: checked again in the transaction (approved, the member
 * is its owner or active teammate), and then the drink is published at once, without the queue, with the company kept
 * on the row. A drink that matched something (the «всё равно отправить» path) still goes to moderation — publishing it
 * would hide a parser card or clash with a published drink. Attaching it to the company stays a moderated request.
 */
export async function submitCatalogDrink(userId: string, input: CatalogDrinkInput, photo: PreparedReviewPhoto | undefined, confirmMatch = false, businessId: string | null = null): Promise<{ id: string; published: boolean; href: string }> {
  if (!photo) throw new CatalogDrinkError('Добавьте фото банки.');
  const files = await readAllCatalogGroups();
  const published = await catalogDrinkGroups();
  const brand = [...files, ...published].find(group => lower(group.brand) === lower(input.brand))?.brand ?? input.brand;
  const identity = reviewedProductIdentity(brand, canonicalProductFlavor(brand, input.flavor));
  const same = (group: CatalogGroup) => lower(group.brand) === lower(identity.brand) && lower(group.flavor) === lower(identity.flavor);
  const member = published.find(same);
  if (member && !confirmMatch) throw new CatalogDrinkDuplicate('Такой напиток уже добавил другой участник. Если в вашей банке есть сок или часть сахара заменена подсластителем, отметьте это на первом шаге. Если у вас другая версия — новый дизайн или состав, — всё равно отправьте её: модератор сверит и переименует или объединит.', `/catalog/${catalogGroupSlug(member.brand, member.flavor)}`, true);
  const waiting = (await getPool().query<{ own: boolean }>(`select bool_or("ownerId" = $3) as own from "catalogDrink"
    where status = 'pending' and lower(brand) = lower($1) and lower(flavor) = lower($2) having count(*) > 0`, [identity.brand, identity.flavor, userId])).rows[0];
  if (waiting?.own) throw new CatalogDrinkError('Этот напиток уже ждёт проверки.');
  if (waiting && !confirmMatch) throw new CatalogDrinkDuplicate('Такой напиток уже ждёт проверки — его отправил другой участник. Если у вас другая версия, всё равно отправьте её: модератор сверит обе заявки.', `/catalog/pending?${new URLSearchParams({ q: identity.brand })}`, true);
  const file = files.find(same);
  if (file && !confirmMatch) throw new CatalogDrinkDuplicate('Похоже, такой напиток уже есть в каталоге. Если у вас другая версия — новый дизайн, состав или объём, — всё равно отправьте её: модератор сверит с карточкой и переименует или объединит.', `/catalog/${catalogGroupSlug(file.brand, file.flavor)}`, true);
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
    // Only a clean submission skips the queue: no parser card, no published or waiting drink under this identity.
    const company = businessId && !member && !waiting && !files.some(same) ? (await db.query<{ id: string }>(
      `select b.id from business b where b.id = $1 and b.status = 'approved'
         and (b."ownerId" = $2 or exists(select 1 from "businessMember" m where m."businessId" = b.id and m."userId" = $2 and m.status = 'active' and m.role = 'manager'))`, [businessId, userId])).rows[0]?.id ?? null : null;
    const result = await db.query<{ id: string }>(`insert into "catalogDrink"("ownerId", brand, flavor, "fullName", volumes, ingredients, photo, thumbnail, status, "businessId", "reviewedAt", discontinued)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, case when $9 = 'published' then now() end, $11) returning id`,
      [userId, identity.brand, identity.flavor, input.fullName, input.volumes, input.ingredients, photo.data, photo.thumbnail, company ? 'published' : 'pending', businessId && company ? company : null, input.discontinued ?? false]);
    if (company) await db.query(`insert into "businessAuditLog"("businessId", "userId", action, target) values ($1, $2, 'drink-new', $3)`, [company, userId, `${identity.brand} · ${flavorName(identity.flavor)}`]);
    await db.query('commit');
    return { id: result.rows[0]!.id, published: Boolean(company), href: `/catalog/${catalogGroupSlug(identity.brand, identity.flavor)}` };
  } catch (error) {
    await db.query('rollback');
    if ((error as { code?: string }).code === '23505') throw new CatalogDrinkError(businessId ? 'Такой напиток уже есть в каталоге или ждёт проверки.' : 'Этот напиток уже ждёт проверки.');
    throw error;
  } finally { db.release(); }
}

export async function moderateCatalogDrink(adminId: string, id: string, status: 'published' | 'rejected', note: string, version: string) {
  if (!['published', 'rejected'].includes(status) || note.length > 500 || (status === 'rejected' && !note.trim())) throw new CatalogDrinkError('Для отклонения укажите причину (до 500 символов).');
  if (status === 'published') {
    const drink = (await getPool().query<{ brand: string; flavor: string }>('select brand, flavor from "catalogDrink" where id = $1', [id])).rows[0];
    // Published under a parser card's identity, the drink would be hidden behind that card.
    if (drink && await catalogFileMatch(drink.brand, drink.flavor)) throw new CatalogDrinkError('Такая карточка уже есть в каталоге: измените вкус в «Редактировать» или склейте напиток с ней.');
  }
  // Another member's drink under the same identity is already published: the unique index refuses a second one.
  const result = await getPool().query(`update "catalogDrink" d set status = $3, "moderationNote" = $4, "reviewedBy" = $1, "reviewedAt" = now(), "updatedAt" = clock_timestamp()
    where id = $2 and status = 'pending' and date_trunc('milliseconds', "updatedAt") = $5::timestamptz
      and exists(select 1 from "user" u join "siteAdmin" a on lower(u.email) = a.email where u.id = $1) and ${VISIBLE_AUTHOR} returning id`,
  [adminId, id, status, note.trim(), version]).catch((error: { code?: string }) => {
    if (error.code === '23505') throw new CatalogDrinkError('Такой напиток уже опубликован: измените вкус в «Редактировать» или склейте напиток с ним.');
    throw error;
  });
  if (!result.rowCount) throw new CatalogDrinkError('Заявка изменилась, уже проверена или автор заблокирован. Обновите страницу.');
}

export async function listPendingCatalogDrinks(page = 1, size = 20): Promise<{ items: CatalogDrink[]; hasMore: boolean }> {
  return listCatalogDrinks('pending', page, size);
}

/**
 * The admin's lists: requests oldest first (the queue), published and rejected newest first. `query` matches brand,
 * flavour key and full name. Blocked authors' requests stay out of the queue, as in moderation.
 */
/**
 * The admin's lists. Requests the neural network took for a duplicate come first (`catalogDrinkCheck`, migration 0139);
 * `suspects` — only published drinks it suspects and the team has not cleared («Возможные дубли»).
 */
export async function listCatalogDrinks(status: CatalogDrinkStatus, page = 1, size = 20, query = '', { suspects = false }: { suspects?: boolean } = {}): Promise<{ items: CatalogDrink[]; hasMore: boolean }> {
  const flagged = `exists(select 1 from "catalogDrinkCheck" c where c."drinkId" = d.id and c.verdict = 'duplicate' and c."dismissedAt" is null)`;
  const { rows } = await getPool().query<Row>(`select ${COLUMNS} from "catalogDrink" d join "user" u on u.id = d."ownerId"
    where d.status = $1 ${status === 'pending' ? `and ${VISIBLE_AUTHOR}` : ''} ${suspects ? `and ${SUSPECT}` : ''}
      and ($4 = '' or concat_ws(' ', d.brand, d.flavor, d."fullName") ilike '%' || $4 || '%')
    order by ${status === 'pending' ? `${flagged} desc, d."createdAt"` : suspects ? `${flagged} desc, d.brand, d.flavor` : 'coalesce(d."reviewedAt", d."createdAt") desc'} limit $2 offset $3`,
  [status, size + 1, (page - 1) * size, query.trim().replace(/[\\%_]/gu, match => `\\${match}`)]);
  return { items: rows.slice(0, size).map(toDrink), hasMore: rows.length > size };
}

const ADMIN = 'exists(select 1 from "user" u join "siteAdmin" a on lower(u.email) = a.email where u.id = $1)';

/**
 * An admin fixes a drink: brand, flavour, full name, volumes, label text and the photo. A new brand or flavour is checked
 * against the catalog like a request; for a published drink everything tied to the old identity (reviews, favourites,
 * tier lists, the calendar, swipes) moves to the new one (`move_drink_identity`), and the old address redirects
 * (`catalogDrinkRename`). `version` is the `updatedAt` the admin saw, so two admins do not overwrite each other.
 */
export async function updateCatalogDrink(adminId: string, adminEmail: string, id: string, version: string, edit: CatalogDrinkEdit, photo?: PreparedReviewPhoto): Promise<void> {
  const db = await getPool().connect();
  try {
    await db.query('begin');
    const current = (await db.query<{ brand: string; flavor: string; status: CatalogDrinkStatus; discontinued: boolean }>(`select d.brand, d.flavor, d.status, d.discontinued from "catalogDrink" d
      where d.id = $2 and date_trunc('milliseconds', d."updatedAt") = $3::timestamptz and ${ADMIN} for update`, [adminId, id, version])).rows[0];
    if (!current) throw new CatalogDrinkError('Напиток изменился или удалён. Обновите страницу.');
    const files = await readAllCatalogGroups();
    const published = (await catalogDrinkGroups()).filter(group => !(group.brand === current.brand && group.flavor === current.flavor));
    const brand = [...files, ...published].find(group => lower(group.brand) === lower(edit.brand))?.brand ?? edit.brand;
    const identity = reviewedProductIdentity(brand, canonicalProductFlavor(brand, edit.flavor));
    const renamed = identity.brand !== current.brand || identity.flavor !== current.flavor;
    if (renamed) {
      const other = [...files, ...published].find(group => lower(group.brand) === lower(identity.brand) && lower(group.flavor) === lower(identity.flavor));
      if (other) throw new CatalogDrinkDuplicate('Такой напиток уже есть в каталоге.', `/catalog/${catalogGroupSlug(other.brand, other.flavor)}`);
    }
    await db.query(`update "catalogDrink" set brand = $2, flavor = $3, "fullName" = $4, volumes = $5, ingredients = $6,
        photo = coalesce($7, photo), thumbnail = coalesce($8, thumbnail), discontinued = $9, "updatedAt" = clock_timestamp() where id = $1`,
    [id, identity.brand, identity.flavor, edit.fullName, edit.volumes, edit.ingredients, photo?.data ?? null, photo?.thumbnail ?? null, edit.discontinued ?? false]);
    if (renamed && current.status === 'published') {
      await db.query('select move_drink_identity($1, $2, $3, $4)', [current.brand, current.flavor, identity.brand, identity.flavor]);
      // Earlier renames of this drink lead straight to the newest address.
      await db.query('update "catalogDrinkRename" set "toBrand" = $3, "toFlavor" = $4 where "toBrand" = $1 and "toFlavor" = $2', [current.brand, current.flavor, identity.brand, identity.flavor]);
      await db.query('insert into "catalogDrinkRename"("drinkId", "fromBrand", "fromFlavor", "toBrand", "toFlavor") values ($1, $2, $3, $4, $5)', [id, current.brand, current.flavor, identity.brand, identity.flavor]);
    }
    await db.query('insert into "adminAuditLog" ("adminEmail", action, "targetType", "targetId") values ($1, $2, $3, $4)',
      [adminEmail, renamed ? 'catalog-drink-rename' : photo ? 'catalog-drink-edit-photo'
        : (edit.discontinued ?? false) !== current.discontinued ? (edit.discontinued ? 'catalog-drink-archive' : 'catalog-drink-unarchive') : 'catalog-drink-edit', 'catalog-drink', id]);
    await db.query('commit');
  } catch (error) {
    await db.query('rollback');
    if ((error as { code?: string }).code === '23505') throw new CatalogDrinkError('Такой напиток уже ждёт проверки.');
    throw error;
  } finally { db.release(); }
}

/** Where a renamed member drink lives now: the product page redirects its old address there. */
export async function renamedCatalogDrink(slug: string): Promise<{ brand: string; flavor: string } | null> {
  const { rows } = await getPool().query<{ fromBrand: string; fromFlavor: string; toBrand: string; toFlavor: string }>(
    'select "fromBrand", "fromFlavor", "toBrand", "toFlavor" from "catalogDrinkRename" order by id desc limit 2000');
  const row = rows.find(rename => catalogGroupSlug(rename.fromBrand, rename.fromFlavor) === slug);
  return row ? { brand: row.toBrand, flavor: row.toFlavor } : null;
}

/**
 * Removes a drink and its photo. A published drink leaves the catalog; reviews, the calendar and tier lists keep their
 * rows as for an archived product, and the XP paid for it stays (as for a deleted store).
 */
export async function deleteCatalogDrink(adminId: string, adminEmail: string, id: string): Promise<void> {
  const db = await getPool().connect();
  try {
    await db.query('begin');
    const result = await db.query(`delete from "catalogDrink" d where d.id = $2 and ${ADMIN} returning id`, [adminId, id]);
    if (!result.rowCount) throw new CatalogDrinkError('Напиток уже удалён. Обновите страницу.');
    await db.query('insert into "adminAuditLog" ("adminEmail", action, "targetType", "targetId") values ($1, $2, $3, $4)', [adminEmail, 'catalog-drink-delete', 'catalog-drink', id]);
    await db.query('commit');
  } catch (error) {
    await db.query('rollback');
    throw error;
  } finally { db.release(); }
}

/** A request waiting for moderation, as anyone may see it: no photo (not checked yet), no label text, no moderator note. */
export interface PendingCatalogDrink { id: string; brand: string; flavor: string; name: string; fullName: string; volumes: number[]; createdAt: Date; author: string | null }

/**
 * «На модерации» in the catalog: requests now waiting for review, newest first, so members see a drink is already on its
 * way before sending it again. `query` matches brand, flavour and full name; blocked authors are left out.
 */
export async function listPendingCatalogDrinksPublic(query = '', page = 1, size = 30): Promise<{ items: PendingCatalogDrink[]; total: number; hasMore: boolean }> {
  const { rows } = await getPool().query<{ id: string; brand: string; flavor: string; fullName: string; volumes: number[]; createdAt: Date; username: string | null; total: number }>(
    `select d.id, d.brand, d.flavor, d."fullName", d.volumes, d."createdAt", u.username, count(*) over()::int as total
     from "catalogDrink" d join "user" u on u.id = d."ownerId"
     where d.status = 'pending' and ${VISIBLE_AUTHOR}
       and ($1 = '' or concat_ws(' ', d.brand, d.flavor, d."fullName") ilike '%' || $1 || '%')
     order by d."createdAt" desc limit $2 offset $3`,
    [query.trim().replace(/[\\%_]/gu, match => `\\${match}`), size + 1, (page - 1) * size]);
  return {
    items: rows.slice(0, size).map(row => ({ id: row.id, brand: row.brand, flavor: row.flavor, name: flavorName(row.flavor), fullName: row.fullName, volumes: row.volumes, createdAt: row.createdAt, author: row.username })),
    total: rows[0]?.total ?? 0, hasMore: rows.length > size,
  };
}

/** How many requests wait for moderation now, for the badge on the catalog button. */
export async function countPendingCatalogDrinks(): Promise<number> {
  const { rows } = await getPool().query<{ count: number }>(`select count(*)::int as count from "catalogDrink" d where d.status = 'pending' and ${VISIBLE_AUTHOR}`);
  return rows[0]?.count ?? 0;
}

/** A member's published drinks for the profile block «Добавленные напитки», newest first, and how many there are. */
export async function listPublishedDrinksByOwner(userId: string, limit = 6): Promise<{ items: CatalogDrink[]; total: number }> {
  const { rows } = await getPool().query<Row & { total: number }>(`select ${COLUMNS}, count(*) over()::int as total from "catalogDrink" d join "user" u on u.id = d."ownerId"
    where d."ownerId" = $1 and d.status = 'published' and ${VISIBLE_AUTHOR} order by d."reviewedAt" desc nulls last, d."createdAt" desc limit $2`, [userId, limit]);
  return { items: rows.map(toDrink), total: rows[0]?.total ?? 0 };
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
