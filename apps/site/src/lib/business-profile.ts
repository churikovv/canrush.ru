import { getPool } from '@/db/pool';
import { getCabinet, getOwnBusiness, logBusiness, type Business, type BusinessRole } from '@/lib/business';
import { BusinessError } from '@/lib/business-fields';
import { isPdf, MAX_AWARDS, MAX_PDF_BYTES, MAX_POST_PHOTOS, pdfFileName, type AwardInput, type CompanyInfo, type ProfileSection } from '@/lib/business-profile-fields';
import type { PreparedReviewPhoto } from '@/lib/review-photos';
import { loadAllCatalogGroups } from '@/lib/catalog';
import { catalogGroupSlug, flavorName } from '@/lib/catalog-query';
import { getCompanyListings, type Listing } from '@/lib/market';
import { frozenMessage, isFrozenError, isUserBlocked } from '@/lib/moderation';

/**
 * A company's public profile (/company/<id>, migration 0148): the logo as its avatar, the store on the CanRush map it
 * leads to, its drinks and listings, and a wall where the team pins PDF presentations. Only an approved company is
 * public; its own team sees it before that, with a note.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
/** Posts a company may publish in a day: the wall is for presentations and news, not a feed. */
export const POSTS_PER_DAY = 10;

export interface CompanyStore { id: string; name: string; city: string; address: string }
export interface CompanyDrink { brand: string; flavor: string; name: string; cover: string | null; href: string }
export interface CompanyPost { id: string; text: string; fileName: string | null; fileSize: number | null; createdAt: Date; author: string | null; username: string | null; /** Photo ids in order. */ photos: string[] }
/** A diploma or certificate on the profile: a picture or a PDF. */
export interface CompanyAward extends AwardInput { id: string; kind: 'image' | 'pdf'; fileName: string | null; fileSize: number }
export interface CompanyProfile {
  business: Business & CompanyInfo & { storeId: string | null; profileHidden: ProfileSection[]; presentationId: string | null; bannerId: string | null };
  /** Members subscribed to the company, and whether the viewer is one of them. */
  followers: number; following: boolean;
  /** The viewer's place in the company: an owner or a manager edits the wall. */
  role: BusinessRole | null;
  store: CompanyStore | null; drinks: CompanyDrink[]; listings: Listing[]; posts: CompanyPost[]; awards: CompanyAward[];
  /** The presentation laid open in its own block: the pinned PDF post, else the newest one; `pinned` — chosen by the team. */
  presentation: (CompanyPost & { pinned: boolean }) | null;
}

const BUSINESS_COLUMNS = `b.id, b."ownerId", b.name, b.kind, b.website, b.telegram, b."contactEmail", b.about, b.status, b."moderationNote", b."createdAt", b."reviewedAt", b."logoId", b.plan, b."planUntil", b.founder, b."storeId", b."profileHidden", b."presentationId", b."bannerId", b.bio, b.story, b."publicEmail", b.phone, b.address`;

/** The company's place for the viewer: its owner, an active team member by role, or nobody. */
async function viewerRole(businessId: string, viewerId: string | null): Promise<BusinessRole | null> {
  if (!viewerId) return null;
  const cabinet = await getCabinet(viewerId);
  return cabinet?.business.id === businessId ? cabinet.role : null;
}

export async function getCompanyProfile(id: string, viewerId: string | null): Promise<CompanyProfile | null> {
  if (!UUID.test(id)) return null;
  const business = (await getPool().query<CompanyProfile['business']>(`select ${BUSINESS_COLUMNS} from business b where b.id = $1`, [id])).rows[0];
  if (!business) return null;
  const role = await viewerRole(id, viewerId);
  if (business.status !== 'approved' && !role) return null;
  const hidden = new Set(business.profileHidden);
  const [store, drinks, listings, posts, awards, follow] = await Promise.all([
    business.storeId && !hidden.has('store') ? companyStore(business.storeId) : null,
    hidden.has('drinks') ? [] : companyDrinks(id),
    hidden.has('listings') ? [] : getCompanyListings(id),
    hidden.has('presentations') && !role ? [] : listCompanyPosts(id),
    hidden.has('awards') ? [] : listCompanyAwards(id),
    getPool().query<{ followers: number; following: boolean }>(`select count(*)::int as followers, coalesce(bool_or("userId" = $2), false) as following from "businessFollow" where "businessId" = $1`, [id, viewerId]).then(result => result.rows[0]!),
  ]);
  // The pinned post may be older than the wall's first page.
  const pinned = posts.find(post => post.id === business.presentationId && post.fileName)
    ?? (business.presentationId && posts.length ? (await listCompanyPosts(id, 1, business.presentationId))[0] : undefined);
  const shown = pinned ?? posts.find(post => post.fileName);
  return { business, role, store, drinks, listings, posts, awards, presentation: shown ? { ...shown, pinned: Boolean(pinned) } : null, followers: follow.followers, following: follow.following };
}

async function companyStore(storeId: string): Promise<CompanyStore | null> {
  return (await getPool().query<CompanyStore>(`select id, name, city, address from "marketStore" where id = $1 and status = 'published'`, [storeId])).rows[0] ?? null;
}

/** The company's drinks: those it attached and the team approved, and those it published itself from the cabinet. */
async function companyDrinks(businessId: string): Promise<CompanyDrink[]> {
  const [{ rows }, groups] = await Promise.all([getPool().query<{ brand: string; flavor: string }>(
    `select brand, flavor from "businessDrink" where "businessId" = $1 and status = 'approved'
     union select brand, flavor from "catalogDrink" where "businessId" = $1 and status = 'published'`, [businessId]), loadAllCatalogGroups()]);
  const covers = new Map(groups.map(group => [`${group.brand}\u0000${group.flavor}`, group.coverImageUrl ?? null]));
  return rows.map(row => ({ ...row, name: flavorName(row.flavor), cover: covers.get(`${row.brand}\u0000${row.flavor}`) ?? null, href: `/catalog/${catalogGroupSlug(row.brand, row.flavor)}` }))
    .sort((a, b) => a.brand.localeCompare(b.brand, 'ru') || a.name.localeCompare(b.name, 'ru'));
}

export async function listCompanyPosts(businessId: string, limit = 30, only: string | null = null): Promise<CompanyPost[]> {
  return (await getPool().query<CompanyPost>(`select p.id, p.text, p."fileName", p."fileSize", p."createdAt",
      array(select f.id::text from "businessPostPhoto" f where f."postId" = p.id order by f.position) as photos,
      case when trim(u.name) <> '' and u.name not like '%@%' then u.name else u.username end as author, u.username
    from "businessPost" p left join "user" u on u.id = p."authorId" where p."businessId" = $1 and ($3::uuid is null or p.id = $3)
    order by p."createdAt" desc limit $2`, [businessId, limit, only])).rows;
}

/** Awards with a year first, the newest on top; files stay out of the list. */
export async function listCompanyAwards(businessId: string): Promise<CompanyAward[]> {
  return (await getPool().query<CompanyAward>(`select id, title, issuer, year, kind, "fileName", "fileSize" from "businessAward"
    where "businessId" = $1 order by year desc nulls last, "createdAt" desc`, [businessId])).rows;
}

/** The company of a member who may publish for it: the owner or a manager of an approved company. */
async function publisher(userId: string): Promise<Business> {
  const cabinet = await getCabinet(userId);
  if (!cabinet || cabinet.role === 'analyst') throw new BusinessError('Публиковать от имени компании могут владелец и менеджеры.');
  if (cabinet.business.status !== 'approved') throw new BusinessError('Стена откроется, когда компанию подтвердят.');
  return cabinet.business;
}

/**
 * A wall post: text, a PDF presentation, photos (news with pictures) — any of them. The PDF is checked by its content,
 * photos come re-encoded (`prepareReviewPhotos`); the post and its photos go in one transaction.
 */
export async function createCompanyPost(userId: string, text: string, file: { name: string; data: Buffer } | null, photos: PreparedReviewPhoto[] = []): Promise<string> {
  const business = await publisher(userId);
  if (await isUserBlocked(userId)) throw new BusinessError('Этому аккаунту публикации недоступны.');
  const frozen = await frozenMessage(userId);
  if (frozen) throw new BusinessError(frozen);
  if (!text && !file && !photos.length) throw new BusinessError('Добавьте текст, фото или PDF-файл.');
  if (photos.length > MAX_POST_PHOTOS) throw new BusinessError(`Не больше ${MAX_POST_PHOTOS} фото в записи.`);
  if (file && (file.data.length > MAX_PDF_BYTES || !file.data.length)) throw new BusinessError('PDF — до 20 МБ.');
  if (file && !isPdf(file.data)) throw new BusinessError('Это не PDF. Сохраните презентацию в PDF и загрузите снова.');
  const pool = getPool();
  const today = (await pool.query<{ n: number }>(`select count(*)::int as n from "businessPost" where "businessId" = $1 and "createdAt" > now() - interval '1 day'`, [business.id])).rows[0]!.n;
  if (today >= POSTS_PER_DAY) throw new BusinessError(`Не больше ${POSTS_PER_DAY} записей в сутки — продолжите завтра.`);
  const db = await pool.connect();
  try {
    await db.query('begin');
    const id = (await db.query<{ id: string }>(`insert into "businessPost"("businessId", "authorId", text, "fileName", file, "fileSize") values ($1, $2, $3, $4, $5, $6) returning id`,
      [business.id, userId, text, file ? pdfFileName(file.name) : null, file?.data ?? null, file?.data.length ?? null])).rows[0]!.id;
    for (const [position, photo] of photos.entries()) await db.query(`insert into "businessPostPhoto"("postId", position, data, thumbnail) values ($1, $2, $3, $4)`, [id, position, photo.data, photo.thumbnail]);
    await db.query('commit');
    await logBusiness(business.id, userId, 'post', file ? pdfFileName(file.name) : text.slice(0, 200) || `${photos.length} фото`);
    return id;
  } catch (error) {
    await db.query('rollback');
    if (isFrozenError(error)) throw new BusinessError(error.message);
    throw error;
  } finally { db.release(); }
}

/** The owner and managers remove the company's posts. */
export async function deleteCompanyPost(userId: string, postId: string): Promise<void> {
  if (!UUID.test(postId)) return;
  const business = await publisher(userId);
  const { rows } = await getPool().query<{ text: string; fileName: string | null }>(`delete from "businessPost" where id = $1 and "businessId" = $2 returning text, "fileName"`, [postId, business.id]);
  if (rows[0]) await logBusiness(business.id, userId, 'post-delete', rows[0].fileName ?? rows[0].text.slice(0, 200));
}

/** An award's file, ready to store: a PDF as it came, or a picture already re-encoded with its thumbnail. */
export type AwardFile = { kind: 'pdf'; name: string; data: Buffer } | ({ kind: 'image' } & PreparedReviewPhoto);

/** Adds an award to the profile: the owner and managers of an approved company, up to `MAX_AWARDS`. */
export async function createCompanyAward(userId: string, input: AwardInput, file: AwardFile): Promise<string> {
  const business = await publisher(userId);
  if (await isUserBlocked(userId)) throw new BusinessError('Этому аккаунту публикации недоступны.');
  const frozen = await frozenMessage(userId);
  if (frozen) throw new BusinessError(frozen);
  if (file.kind === 'pdf' && (file.data.length > MAX_PDF_BYTES || !isPdf(file.data))) throw new BusinessError('Нужен PDF до 20 МБ.');
  const name = file.kind === 'pdf' ? pdfFileName(file.name) : null;
  const thumbnail = file.kind === 'image' ? file.thumbnail : null;
  try {
    // The limit is checked by the insert itself, so two uploads at once cannot pass it together.
    const { rows } = await getPool().query<{ id: string }>(`insert into "businessAward"("businessId", "authorId", title, issuer, year, kind, "fileName", "fileSize", data, thumbnail)
      select $1, $2, $3, $4, $5, $6, $7, $8, $9, $10 where (select count(*) from "businessAward" where "businessId" = $1) < $11 returning id`,
      [business.id, userId, input.title, input.issuer, input.year, file.kind, name, file.data.length, file.data, thumbnail, MAX_AWARDS]);
    if (!rows[0]) throw new BusinessError(`Не больше ${MAX_AWARDS} наград в профиле.`);
    await logBusiness(business.id, userId, 'award', input.title);
    return rows[0].id;
  } catch (error) {
    if (isFrozenError(error)) throw new BusinessError(error.message);
    throw error;
  }
}

/** The owner and managers remove the company's awards. */
export async function deleteCompanyAward(userId: string, awardId: string): Promise<void> {
  if (!UUID.test(awardId)) return;
  const business = await publisher(userId);
  const { rows } = await getPool().query<{ title: string }>(`delete from "businessAward" where id = $1 and "businessId" = $2 returning title`, [awardId, business.id]);
  if (rows[0]) await logBusiness(business.id, userId, 'award-delete', rows[0].title);
}

/**
 * An award's file (`thumb` — the picture's small copy, a PDF has none) while the company is public and the section is
 * on, or for the company's own team. `name` is set only for a PDF.
 */
export async function getCompanyAwardFile(awardId: string, viewerId: string | null, thumb: boolean): Promise<{ name: string | null; data: Buffer } | null> {
  if (!UUID.test(awardId)) return null;
  const row = (await getPool().query<{ name: string | null; data: Buffer | null; businessId: string; open: boolean }>(
    `select a."fileName" as name, ${thumb ? 'a.thumbnail' : 'a.data'} as data, a."businessId", b.status = 'approved' and not 'awards' = any(b."profileHidden") as open
     from "businessAward" a join business b on b.id = a."businessId" where a.id = $1`, [awardId])).rows[0];
  if (!row?.data) return null;
  if (!row.open && !(await viewerRole(row.businessId, viewerId))) return null;
  return { name: row.name, data: row.data };
}

/**
 * Pins a PDF post of the company's wall as its main presentation (its own block on the profile), or unpins with null.
 * The owner and managers decide, like posting.
 */
export async function pinCompanyPresentation(userId: string, postId: string | null): Promise<void> {
  const business = await publisher(userId);
  if (postId && (!UUID.test(postId) || !(await getPool().query(`select 1 from "businessPost" where id = $1 and "businessId" = $2 and file is not null`, [postId, business.id])).rowCount))
    throw new BusinessError('Закрепить можно только PDF со стены компании.');
  await getPool().query(`update business set "presentationId" = $2 where id = $1`, [business.id, postId]);
  await logBusiness(business.id, userId, postId ? 'presentation-pin' : 'presentation-unpin');
}

/** A post's PDF while its company is public (approved), or for the company's own team. */
export async function getCompanyPostFile(postId: string, viewerId: string | null): Promise<{ name: string; data: Buffer } | null> {
  if (!UUID.test(postId)) return null;
  const row = (await getPool().query<{ name: string; data: Buffer; businessId: string; status: string }>(
    `select p."fileName" as name, p.file as data, b.id as "businessId", b.status from "businessPost" p join business b on b.id = p."businessId" where p.id = $1 and p.file is not null`, [postId])).rows[0];
  if (!row) return null;
  if (row.status !== 'approved' && !(await viewerRole(row.businessId, viewerId))) return null;
  return { name: row.name, data: row.data };
}

/** A wall photo (full or `thumb`) while its company is public, or for the company's own team. */
export async function getCompanyPostPhoto(photoId: string, viewerId: string | null, thumb: boolean): Promise<Buffer | null> {
  if (!UUID.test(photoId)) return null;
  const row = (await getPool().query<{ data: Buffer; businessId: string; status: string }>(
    `select ${thumb ? 'f.thumbnail' : 'f.data'} as data, b.id as "businessId", b.status from "businessPostPhoto" f
     join "businessPost" p on p.id = f."postId" join business b on b.id = p."businessId" where f.id = $1`, [photoId])).rows[0];
  if (!row) return null;
  if (row.status !== 'approved' && !(await viewerRole(row.businessId, viewerId))) return null;
  return row.data;
}

/**
 * Subscribes the member to an approved company, or unsubscribes (`on` false): subscribers get a notification for each
 * new post (trigger `notify_company_post`). Returns the new count.
 */
export async function setCompanyFollow(userId: string, businessId: string, on: boolean): Promise<number> {
  if (!UUID.test(businessId)) throw new BusinessError('Компания не найдена.');
  if (await isUserBlocked(userId)) throw new BusinessError('Этому аккаунту подписки недоступны.');
  const db = getPool();
  if (on) {
    const added = await db.query(`insert into "businessFollow"("businessId", "userId") select id, $2 from business where id = $1 and status = 'approved' on conflict do nothing`, [businessId, userId]);
    if (!added.rowCount && !(await db.query(`select 1 from business where id = $1 and status = 'approved'`, [businessId])).rowCount) throw new BusinessError('Компания не найдена.');
  } else await db.query(`delete from "businessFollow" where "businessId" = $1 and "userId" = $2`, [businessId, userId]);
  return (await db.query<{ n: number }>(`select count(*)::int as n from "businessFollow" where "businessId" = $1`, [businessId])).rows[0]!.n;
}

/**
 * The brand's own words on its profile — the short line under the name, the long story of «О бренде» and public
 * contacts. The owner changes them any time; the reviewed company data (name, kind, site) stays with support.
 */
export async function saveCompanyInfo(ownerId: string, info: CompanyInfo): Promise<void> {
  const business = await getOwnBusiness(ownerId);
  if (!business) throw new BusinessError('Описание и контакты меняет владелец кабинета.');
  await getPool().query(`update business set bio = $2, story = $3, "publicEmail" = $4, phone = $5, address = $6, "updatedAt" = now() where id = $1`,
    [business.id, info.bio, info.story, info.publicEmail, info.phone, info.address]);
  await logBusiness(business.id, ownerId, 'profile-info');
}

/** The owner's banner over the logo: a new row each upload, the previous ones go (as the logo). */
export async function setCompanyBanner(ownerId: string, data: Buffer | null): Promise<void> {
  const business = await getOwnBusiness(ownerId);
  if (!business) throw new BusinessError('Баннер меняет владелец кабинета.');
  const db = await getPool().connect();
  try {
    await db.query('begin');
    const id = data ? (await db.query<{ id: string }>(`insert into "businessBanner"("businessId", data) values ($1, $2) returning id`, [business.id, data])).rows[0]!.id : null;
    await db.query(`update business set "bannerId" = $2, "updatedAt" = now() where id = $1`, [business.id, id]);
    await db.query(`delete from "businessBanner" where "businessId" = $1 and id is distinct from $2`, [business.id, id]);
    await db.query('commit');
  } catch (error) { await db.query('rollback'); throw error; } finally { db.release(); }
  await logBusiness(business.id, ownerId, data ? 'banner' : 'banner-remove');
}

export async function getCompanyBanner(id: string): Promise<Buffer | null> {
  if (!UUID.test(id)) return null;
  return (await getPool().query<{ data: Buffer }>(`select data from "businessBanner" where id = $1`, [id])).rows[0]?.data ?? null;
}

/** Published stores on the CanRush map the owner and the active team added: the ones the profile may lead to. */
export async function companyStoreOptions(business: Business): Promise<CompanyStore[]> {
  return (await getPool().query<CompanyStore>(`select s.id, s.name, s.city, s.address from "marketStore" s
    where s.status = 'published' and (s."ownerId" = $1 or s."ownerId" in (select "userId" from "businessMember" where "businessId" = $2 and status = 'active'))
    order by s.name`, [business.ownerId, business.id])).rows;
}

/** The owner picks the store the profile leads to and the sections it shows (all on unless hidden). */
export async function saveCompanyProfile(ownerId: string, storeId: string | null, hidden: ProfileSection[]): Promise<void> {
  const business = await getOwnBusiness(ownerId);
  if (!business) throw new BusinessError('Профиль компании настраивает владелец кабинета.');
  if (storeId && !(await companyStoreOptions(business)).some(store => store.id === storeId)) throw new BusinessError('Выберите опубликованный магазин вашей команды.');
  await getPool().query(`update business set "storeId" = $2, "profileHidden" = $3, "updatedAt" = now() where id = $1`, [business.id, storeId, hidden]);
  await logBusiness(business.id, ownerId, 'profile');
}

export async function getCompanyProfileSettings(business: Business): Promise<{ storeId: string | null; hidden: ProfileSection[]; bannerId: string | null; info: CompanyInfo }> {
  const row = (await getPool().query<{ storeId: string | null; profileHidden: ProfileSection[]; bannerId: string | null } & CompanyInfo>(
    `select "storeId", "profileHidden", "bannerId", bio, story, "publicEmail", phone, address from business where id = $1`, [business.id])).rows[0];
  return { storeId: row?.storeId ?? null, hidden: row?.profileHidden ?? [], bannerId: row?.bannerId ?? null,
    info: { bio: row?.bio ?? null, story: row?.story ?? null, publicEmail: row?.publicEmail ?? null, phone: row?.phone ?? null, address: row?.address ?? null } };
}

/** The company card at the end of a drink's page: the brand that published or confirmed it, like a member's author card. */
export interface CompanyCard { id: string; name: string; kind: Business['kind']; logoId: string | null; bio: string; createdAt: Date; followers: number; following: boolean; drinks: number }

export async function getCompanyCard(id: string, viewerId: string | null): Promise<CompanyCard | null> {
  if (!UUID.test(id)) return null;
  return (await getPool().query<CompanyCard>(
    `select b.id, b.name, b.kind, b."logoId", coalesce(nullif(b.bio, ''), b.about, '') as bio, b."createdAt",
       (select count(*)::int from "businessFollow" f where f."businessId" = b.id) as followers,
       exists (select 1 from "businessFollow" f where f."businessId" = b.id and f."userId" = $2) as following,
       (select count(*)::int from (select brand, flavor from "businessDrink" where "businessId" = b.id and status = 'approved'
          union select brand, flavor from "catalogDrink" where "businessId" = b.id and status = 'published') d) as drinks
     from business b where b.id = $1 and b.status = 'approved'`, [id, viewerId])).rows[0] ?? null;
}

/** The approved company that attached this drink in its cabinet and had it confirmed (the oldest, if several did). */
export async function drinkCompanyId(brand: string, flavor: string): Promise<string | null> {
  return (await getPool().query<{ id: string }>(
    `select b.id from "businessDrink" d join business b on b.id = d."businessId" and b.status = 'approved'
     where d.brand = $1 and d.flavor = $2 and d.status = 'approved' order by d."createdAt" limit 1`, [brand, flavor])).rows[0]?.id ?? null;
}
