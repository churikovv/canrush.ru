import { getPool } from '@/db/pool';
import { loadAllCatalogGroups } from '@/lib/catalog';
import { flavorName } from '@/lib/catalog-query';
import { moscowDay } from '@/lib/drink-calendar-fields';
import { isCountedCatalogDrink } from '@/lib/home-metrics';
import { storeDrinkOptions } from '@/lib/store-catalog';
import { getGigaChat, type GigaChatClient } from '@/lib/gigachat';
import { getCatalogScoreProfile, getScoreProfile, type ScoreProfile } from '@/lib/score-profile';
import { DIGEST_COOLDOWN_HOURS, DIGEST_DAILY_LIMIT, DIGEST_MIN_REVIEWS, type ReviewDigest } from '@/lib/review-digest-fields';
import { writeReviewDigest } from '@/lib/review-digest';
import { BusinessError, MAX_PENDING_BUSINESS_DRINKS, weeklySeries, type BusinessInput, type BusinessKind, type BusinessStatus } from '@/lib/business-fields';

export interface Business {
  id: string; ownerId: string; name: string; kind: BusinessKind; website: string | null; telegram: string | null;
  contactEmail: string | null; about: string | null; status: BusinessStatus; moderationNote: string | null; createdAt: Date; reviewedAt: Date | null;
  logoId: string | null;
}
const COLUMNS = `b.id, b."ownerId", b.name, b.kind, b.website, b.telegram, b."contactEmail", b.about, b.status, b."moderationNote", b."createdAt", b."reviewedAt", b."logoId"`;

export async function getOwnBusiness(userId: string): Promise<Business | null> {
  return (await getPool().query<Business>(`select ${COLUMNS} from business b where b."ownerId" = $1`, [userId])).rows[0] ?? null;
}

/**
 * Applies for a company account or edits it. A new or rejected company goes (back) to the team's queue; an approved or
 * pending one keeps its status. Blocked members cannot apply.
 */
export async function saveBusiness(userId: string, input: BusinessInput): Promise<void> {
  const db = getPool();
  if ((await db.query('select 1 from "userBlock" where "userId" = $1', [userId])).rowCount) throw new BusinessError('Этому аккаунту бизнес-кабинет недоступен.');
  await db.query(
    `insert into business("ownerId", name, kind, website, telegram, "contactEmail", about) values ($1, $2, $3, $4, $5, $6, $7)
     on conflict ("ownerId") do update set name = excluded.name, kind = excluded.kind, website = excluded.website, telegram = excluded.telegram,
       "contactEmail" = excluded."contactEmail", about = excluded.about, "updatedAt" = now(),
       status = case when business.status = 'rejected' then 'pending' else business.status end,
       "moderationNote" = case when business.status = 'rejected' then null else business."moderationNote" end`,
    [userId, input.name, input.kind, input.website, input.telegram, input.contactEmail, input.about]);
}

export type BusinessRole = 'owner' | 'manager';

/** The company whose cabinet the member opens: their own, or the one whose team they joined. */
export async function getCabinet(userId: string): Promise<{ business: Business; role: BusinessRole } | null> {
  const own = await getOwnBusiness(userId);
  if (own) return { business: own, role: 'owner' };
  const member = (await getPool().query<Business>(
    `select ${COLUMNS} from business b join "businessMember" m on m."businessId" = b.id where m."userId" = $1 and m.status = 'active'`, [userId])).rows[0];
  return member ? { business: member, role: 'manager' } : null;
}

async function ownBusinessOrThrow(userId: string): Promise<Business> {
  const business = (await getCabinet(userId))?.business ?? null;
  if (!business) throw new BusinessError('Сначала расскажите о компании.');
  if (business.status === 'rejected') throw new BusinessError('Компания не прошла проверку: поправьте данные в настройках и отправьте снова.');
  return business;
}

/** Asks to attach a catalog drink to the company; the team approves it. A rejected request can be sent again. */
export async function requestBusinessDrink(userId: string, brand: string, flavor: string): Promise<void> {
  const business = await ownBusinessOrThrow(userId);
  const option = (await storeDrinkOptions()).find(item => item.brand === brand && item.flavor === flavor);
  if (!option) throw new BusinessError('Такого напитка нет в каталоге. Добавьте его как новый.');
  const db = getPool();
  const pending = (await db.query<{ count: number }>(`select count(*)::int as count from "businessDrink" where "businessId" = $1 and status = 'pending'`, [business.id])).rows[0]!.count;
  if (pending >= MAX_PENDING_BUSINESS_DRINKS) throw new BusinessError(`На проверке уже ${MAX_PENDING_BUSINESS_DRINKS} напитков — дождитесь решения.`);
  const result = await db.query(
    `insert into "businessDrink"("businessId", brand, flavor) values ($1, $2, $3)
     on conflict ("businessId", brand, flavor) do update set status = 'pending', "moderationNote" = null, "createdAt" = now(), "reviewedAt" = null, "reviewedBy" = null
       where "businessDrink".status = 'rejected'`,
    [business.id, option.brand, option.flavor]);
  if (!result.rowCount) throw new BusinessError('Этот напиток уже прикреплён или ждёт проверки.');
}

export async function removeBusinessDrink(userId: string, brand: string, flavor: string): Promise<void> {
  const cabinet = await getCabinet(userId);
  if (!cabinet) return;
  await getPool().query(`delete from "businessDrink" where "businessId" = $1 and brand = $2 and flavor = $3`, [cabinet.business.id, brand, flavor]);
}

// ── Team ────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const MAX_BUSINESS_MEMBERS = 10;
/** Invitation letters a company may send a day — the form must not become a way to spam addresses. */
export const BUSINESS_INVITES_PER_DAY = 20;
/** A team row: a member (or their pending invitation), or an invitation still waiting for its address to sign in. */
export interface BusinessMember { key: string; userId: string | null; email: string | null; username: string | null; name: string; avatarId: string | null; status: 'pending' | 'active'; createdAt: Date }

/**
 * The team as the owner sees it. An invitation sent by email shows only that email until it is accepted — the owner
 * never learns from the list whether the address has a CanRush account.
 */
export async function listBusinessMembers(businessId: string): Promise<BusinessMember[]> {
  const { rows } = await getPool().query<BusinessMember>(
    `select 'user:' || m."userId" as key, m."userId", case when m.status = 'pending' then m."invitedEmail" end as email,
       case when m.status = 'pending' and m."invitedEmail" is not null then null else u.username end as username,
       case when m.status = 'pending' and m."invitedEmail" is not null then m."invitedEmail"
            when trim(u.name) <> '' and u.name not like '%@%' then u.name else coalesce(u.username, 'Участник') end as name,
       case when m.status = 'pending' and m."invitedEmail" is not null then null else (select id::text from "profileImage" where "userId" = u.id and kind = 'avatar') end as "avatarId",
       m.status, m."createdAt"
     from "businessMember" m join "user" u on u.id = m."userId" where m."businessId" = $1
     union all
     select 'email:' || e.email, null, e.email, null, e.email, null, 'pending', e."createdAt" from "businessEmailInvite" e where e."businessId" = $1
     order by status, "createdAt"`, [businessId]);
  return rows.sort((a, b) => (a.status === b.status ? 0 : a.status === 'active' ? -1 : 1));
}

async function ownerBusinessOrThrow(userId: string): Promise<Business> {
  const business = await getOwnBusiness(userId);
  if (!business) throw new BusinessError('Управлять командой может только владелец кабинета.');
  return business;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type InviteMail = (to: string, business: string, inviter: string) => Promise<void>;

/**
 * Invites by email (the main way) or by CanRush nickname. Email: a letter goes out; an address with an account becomes a
 * pending member at once (with a site notification), one without waits until someone signs in with it. Either way the
 * owner gets the same answer. Nickname: a site notification only.
 */
export async function inviteBusinessMember(ownerId: string, rawTarget: string, sendMail?: InviteMail): Promise<'email' | 'username'> {
  const business = await ownerBusinessOrThrow(ownerId);
  const db = getPool();
  const target = rawTarget.trim();
  const [{ count }] = (await db.query<{ count: number }>(
    `select (select count(*) from "businessMember" where "businessId" = $1) + (select count(*) from "businessEmailInvite" where "businessId" = $1) as count`, [business.id])).rows as [{ count: number }];
  if (Number(count) >= MAX_BUSINESS_MEMBERS) throw new BusinessError(`В команде может быть до ${MAX_BUSINESS_MEMBERS} человек вместе с приглашениями.`);
  const owner = (await db.query<{ email: string; name: string }>(
    `select lower(email) as email, case when trim(name) <> '' and name not like '%@%' then name else coalesce('@' || username, 'Владелец компании') end as name from "user" where id = $1`, [ownerId])).rows[0]!;

  if (!target.startsWith('@') && target.includes('@')) {
    const email = target.toLowerCase();
    if (email.length > 254 || !EMAIL.test(email)) throw new BusinessError('Проверьте адрес почты.');
    if (email === owner.email) throw new BusinessError('Это ваша почта — вы уже владелец кабинета.');
    const sentToday = (await db.query<{ count: number }>(
      `select count(*)::int as count from (select "createdAt" from "businessEmailInvite" where "businessId" = $1 union all
         select "createdAt" from "businessMember" where "businessId" = $1 and "invitedEmail" is not null) x where "createdAt" > now() - interval '1 day'`, [business.id])).rows[0]!.count;
    if (sentToday >= BUSINESS_INVITES_PER_DAY) throw new BusinessError(`На сегодня лимит — ${BUSINESS_INVITES_PER_DAY} приглашений на почту. Попробуйте завтра.`);
    const user = (await db.query<{ id: string; blocked: boolean }>(
      `select id, exists(select 1 from "userBlock" b where b."userId" = u.id) as blocked from "user" u where lower(u.email) = $1`, [email])).rows[0];
    let inserted: number;
    if (user && !user.blocked) {
      inserted = (await db.query(`insert into "businessMember"("businessId", "userId", "invitedBy", "invitedEmail") values ($1, $2, $3, $4) on conflict do nothing`, [business.id, user.id, ownerId, email])).rowCount ?? 0;
      if (inserted) await db.query(`insert into notification("userId", "actorId", kind, "eventKey", payload) values ($1, $2, 'business-invite', $3, $4) on conflict ("userId", "eventKey") do nothing`,
        [user.id, ownerId, `business-invite:${business.id}`, JSON.stringify({ business: business.name })]);
    } else if (user) {
      return 'email'; // a banned account: the same answer as for any address, and no letter
    } else {
      inserted = (await db.query(`insert into "businessEmailInvite"("businessId", email, "invitedBy") values ($1, $2, $3) on conflict do nothing`, [business.id, email, ownerId])).rowCount ?? 0;
    }
    if (!inserted) throw new BusinessError('На этот адрес приглашение уже отправлено.');
    try { await (sendMail ?? (await import('@/lib/email')).sendBusinessInviteEmail)(email, business.name, owner.name); }
    catch (error) {
      console.error('[business] invite email failed', error instanceof Error ? error.message : 'unknown');
      throw new BusinessError('Приглашение сохранено, но письмо не ушло. Человек увидит его, когда войдёт с этой почтой.');
    }
    return 'email';
  }

  const username = target.replace(/^@+/, '').replace(/^https?:\/\/[^/]+\/profile\//i, '').replace(/\/$/, '');
  if (!/^[A-Za-z0-9_.-]{2,40}$/.test(username)) throw new BusinessError('Укажите почту или ник участника CanRush.');
  const user = (await db.query<{ id: string }>(`select id from "user" where lower(username) = lower($1)`, [username])).rows[0];
  if (!user) throw new BusinessError('Участника с таким ником нет. Пригласите по почте — так надёжнее.');
  if (user.id === ownerId) throw new BusinessError('Вы уже владелец этого кабинета.');
  if ((await db.query('select 1 from "userBlock" where "userId" = $1', [user.id])).rowCount) throw new BusinessError('Этого участника нельзя пригласить.');
  const inserted = await db.query(`insert into "businessMember"("businessId", "userId", "invitedBy") values ($1, $2, $3) on conflict do nothing`, [business.id, user.id, ownerId]);
  if (!inserted.rowCount) throw new BusinessError('Этот участник уже в команде или приглашён.');
  await db.query(`insert into notification("userId", "actorId", kind, "eventKey", payload) values ($1, $2, 'business-invite', $3, $4) on conflict ("userId", "eventKey") do nothing`,
    [user.id, ownerId, `business-invite:${business.id}`, JSON.stringify({ business: business.name })]);
  return 'username';
}

/** Removes a member or withdraws an invitation (`user:<id>` or `email:<address>`, as listBusinessMembers keys them). */
export async function removeBusinessMember(ownerId: string, key: string): Promise<void> {
  const business = await ownerBusinessOrThrow(ownerId);
  if (key.startsWith('email:')) await getPool().query(`delete from "businessEmailInvite" where "businessId" = $1 and email = $2`, [business.id, key.slice(6)]);
  else if (key.startsWith('user:')) await getPool().query(`delete from "businessMember" where "businessId" = $1 and "userId" = $2`, [business.id, key.slice(5)]);
}

export interface BusinessInvite { businessId: string; business: string; kind: string; inviter: string | null; createdAt: Date }
export async function listBusinessInvites(userId: string): Promise<BusinessInvite[]> {
  // Invitations sent to this member's email before they had an account become ordinary pending invitations now.
  await getPool().query(
    `with mine as (select lower(email) as email from "user" where id = $1),
       moved as (delete from "businessEmailInvite" e using mine where e.email = mine.email returning e."businessId", e."invitedBy", e.email, e."createdAt")
     insert into "businessMember"("businessId", "userId", "invitedBy", "invitedEmail", "createdAt") select "businessId", $1, "invitedBy", email, "createdAt" from moved
     on conflict do nothing`, [userId]);
  return (await getPool().query<BusinessInvite>(
    `select b.id as "businessId", b.name as business, b.kind, u.username as inviter, m."createdAt" from "businessMember" m
       join business b on b.id = m."businessId" left join "user" u on u.id = m."invitedBy" where m."userId" = $1 and m.status = 'pending' order by m."createdAt" desc`, [userId])).rows;
}

/** Accepting joins the team (one active team at a time; owning a company of one's own comes first). */
export async function answerBusinessInvite(userId: string, businessId: string, accept: boolean): Promise<void> {
  const db = getPool();
  if (!accept) { await db.query(`delete from "businessMember" where "businessId" = $1 and "userId" = $2 and status = 'pending'`, [businessId, userId]); return; }
  if (await getOwnBusiness(userId)) throw new BusinessError('У вас уже есть свой кабинет компании.');
  try {
    const result = await db.query(`update "businessMember" set status = 'active', "acceptedAt" = now() where "businessId" = $1 and "userId" = $2 and status = 'pending'`, [businessId, userId]);
    if (!result.rowCount) throw new BusinessError('Приглашение уже недействительно.');
  } catch (error) {
    if ((error as { code?: string }).code === '23505') throw new BusinessError('Вы уже в команде другой компании — сначала выйдите из неё.');
    throw error;
  }
}

export async function leaveBusiness(userId: string): Promise<void> {
  await getPool().query(`delete from "businessMember" where "userId" = $1 and status = 'active'`, [userId]);
}

// ── Logo ────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Replaces the company logo (only the owner); older logo rows are dropped, the new id busts every cache. */
export async function setBusinessLogo(ownerId: string, data: Buffer): Promise<string> {
  const business = await ownerBusinessOrThrow(ownerId);
  const db = await getPool().connect();
  try {
    await db.query('begin');
    const id = (await db.query<{ id: string }>(`insert into "businessLogo"("businessId", data) values ($1, $2) returning id`, [business.id, data])).rows[0]!.id;
    await db.query(`update business set "logoId" = $2, "updatedAt" = now() where id = $1`, [business.id, id]);
    await db.query(`delete from "businessLogo" where "businessId" = $1 and id <> $2`, [business.id, id]);
    await db.query('commit');
    return id;
  } catch (error) { await db.query('rollback'); throw error; } finally { db.release(); }
}

export async function removeBusinessLogo(ownerId: string): Promise<void> {
  const business = await ownerBusinessOrThrow(ownerId);
  await getPool().query(`delete from "businessLogo" where "businessId" = $1`, [business.id]);
}

export async function getBusinessLogo(id: string): Promise<Buffer | null> {
  return (await getPool().query<{ data: Buffer }>(`select data from "businessLogo" where id = $1`, [id])).rows[0]?.data ?? null;
}

export interface BusinessDrink {
  brand: string; flavor: string; name: string; cover: string | null; status: BusinessStatus; moderationNote: string | null; createdAt: Date;
  reviews: number; taste: number | null; design: number | null; likes: number; skips: number; cans: number;
}

/** The company's drinks with their numbers: reviews and average scores, swipes and cans in calendars. */
export async function listBusinessDrinks(businessId: string): Promise<BusinessDrink[]> {
  const [{ rows }, groups] = await Promise.all([getPool().query<Omit<BusinessDrink, 'name' | 'cover'>>(
    `select d.brand, d.flavor, d.status, d."moderationNote", d."createdAt",
       (select count(*)::int from review r where r.brand = d.brand and r.flavor = d.flavor) as reviews,
       (select round(avg(r.taste)::numeric, 1)::float8 from review r where r.brand = d.brand and r.flavor = d.flavor) as taste,
       (select round(avg(r.design)::numeric, 1)::float8 from review r where r.brand = d.brand and r.flavor = d.flavor) as design,
       (select count(*)::int from "drinkSwipe" s where s.brand = d.brand and s.flavor = d.flavor and s.liked) as likes,
       (select count(*)::int from "drinkSwipe" s where s.brand = d.brand and s.flavor = d.flavor and not s.liked) as skips,
       (select count(*)::int from "drinkLog" l where l.brand = d.brand and l.flavor = d.flavor) as cans
     from "businessDrink" d where d."businessId" = $1 order by d.status = 'approved' desc, d."createdAt" desc`, [businessId]), loadAllCatalogGroups()]);
  const covers = new Map(groups.map(group => [JSON.stringify([group.brand, group.flavor]), group.coverImageUrl ?? null]));
  return rows.map(row => ({ ...row, name: `${row.brand} · ${flavorName(row.flavor)}`, cover: covers.get(JSON.stringify([row.brand, row.flavor])) ?? null }));
}

export interface BusinessAnalytics {
  drinks: number; brands: string[];
  reviews: { total: number; last30: number; previous30: number; taste: number | null; design: number | null; weekly: { week: string; count: number }[]; scores: number[] };
  brand: { reviews: number; reviews30: number; likes: number; skips: number; likes30: number; catalogDrinks: number };
  /** The radar: each axis 0–100 (null without data) for the company's drinks and for the whole catalog. */
  profile: { yours: ScoreProfile; catalog: ScoreProfile };
}
/**
 * Numbers of the cabinet. «Ваши напитки» — approved drinks only; the brand block covers every drink of the brands those
 * drinks belong to (reviews, swipes and how many of them the catalog has). Authors under a ban are left out.
 */
export async function getBusinessAnalytics(businessId: string, today = moscowDay()): Promise<BusinessAnalytics> {
  const db = getPool();
  const approved = (await db.query<{ brand: string; flavor: string }>(`select brand, flavor from "businessDrink" where "businessId" = $1 and status = 'approved'`, [businessId])).rows;
  const brands = [...new Set(approved.map(row => row.brand))].sort((a, b) => a.localeCompare(b, 'ru-RU'));
  const params = [approved.map(row => row.brand), approved.map(row => row.flavor)];
  const mine = `exists(select 1 from unnest($1::text[], $2::text[]) as t(brand, flavor) where t.brand = r.brand and t.flavor = r.flavor)
    and not exists(select 1 from "userBlock" b where b."userId" = r."userId")`;
  const [totals, weekly, scores, brand, groups, yours, catalog] = await Promise.all([
    db.query<{ total: number; last30: number; previous30: number; taste: number | null; design: number | null }>(
      `select count(*)::int as total, count(*) filter (where r."createdAt" > now() - interval '30 days')::int as last30,
         count(*) filter (where r."createdAt" <= now() - interval '30 days' and r."createdAt" > now() - interval '60 days')::int as previous30,
         round(avg(r.taste)::numeric, 1)::float8 as taste, round(avg(r.design)::numeric, 1)::float8 as design
       from review r where ${mine}`, params),
    db.query<{ week: string; count: number }>(
      `select date_trunc('week', r."createdAt" at time zone 'Europe/Moscow')::date::text as week, count(*)::int as count
       from review r where ${mine} and r."createdAt" > now() - interval '13 weeks' group by 1`, params),
    db.query<{ score: number; count: number }>(
      `select least(10, greatest(1, round((r.taste + r.design) / 2.0)))::int as score, count(*)::int as count from review r where ${mine} group by 1`, params),
    db.query<BusinessAnalytics['brand']>(
      `select (select count(*)::int from review r where r.brand = any($1::text[]) and not exists(select 1 from "userBlock" b where b."userId" = r."userId")) as reviews,
         (select count(*)::int from review r where r.brand = any($1::text[]) and r."createdAt" > now() - interval '30 days' and not exists(select 1 from "userBlock" b where b."userId" = r."userId")) as reviews30,
         (select count(*)::int from "drinkSwipe" s where s.brand = any($1::text[]) and s.liked) as likes,
         (select count(*)::int from "drinkSwipe" s where s.brand = any($1::text[]) and not s.liked) as skips,
         (select count(*)::int from "drinkSwipe" s where s.brand = any($1::text[]) and s.liked and s."createdAt" > now() - interval '30 days') as likes30,
         0 as "catalogDrinks"`, [brands]),
    loadAllCatalogGroups(),
    getScoreProfile(approved),
    getCatalogScoreProfile(),
  ]);
  const distribution = Array.from({ length: 10 }, (_, index) => scores.rows.find(row => row.score === index + 1)?.count ?? 0);
  return {
    drinks: approved.length, brands,
    reviews: { ...totals.rows[0]!, weekly: weeklySeries(weekly.rows, today), scores: distribution },
    brand: { ...brand.rows[0]!, catalogDrinks: groups.filter(group => brands.includes(group.brand) && isCountedCatalogDrink(group)).length },
    profile: { yours, catalog },
  };
}

export interface BusinessReview {
  id: string; brand: string; flavor: string; name: string; taste: number; design: number; text: string; createdAt: Date;
  author: string | null; authorName: string; avatarId: string | null;
}
export type BusinessReviewSort = 'new' | 'old' | 'high' | 'low';
export const BUSINESS_REVIEW_SORTS: { value: BusinessReviewSort; label: string }[] = [
  { value: 'new', label: 'Сначала новые' }, { value: 'old', label: 'Сначала старые' },
  { value: 'high', label: 'Высокие оценки' }, { value: 'low', label: 'Низкие оценки' },
];
const REVIEW_ORDER: Record<BusinessReviewSort, string> = {
  new: 'r."createdAt" desc', old: 'r."createdAt" asc', high: '(r.taste + r.design) desc, r."createdAt" desc', low: '(r.taste + r.design) asc, r."createdAt" desc',
};

/** Reviews of the company's approved drinks: a page of `size`, filtered by drink and text, in the chosen order. */
export async function listBusinessReviews(businessId: string, options: { page?: number; size?: number; drink?: { brand: string; flavor: string }; q?: string; sort?: BusinessReviewSort; limit?: number } = {}): Promise<{ items: BusinessReview[]; total: number }> {
  const db = getPool();
  const size = options.limit ?? options.size ?? 20, page = options.page ?? 1;
  const where = `exists(select 1 from "businessDrink" d where d."businessId" = $1 and d.status = 'approved' and d.brand = r.brand and d.flavor = r.flavor)
    and ($2::text is null or (r.brand = $2 and r.flavor = $3)) and not exists(select 1 from "userBlock" b where b."userId" = r."userId")
    and ($4::text is null or strpos(lower(r.text), lower($4)) > 0 or strpos(lower(u.username), lower($4)) > 0)`;
  const args = [businessId, options.drink?.brand ?? null, options.drink?.flavor ?? null, options.q?.trim().slice(0, 80) || null];
  const [{ rows }, total] = await Promise.all([
    db.query<Omit<BusinessReview, 'name'>>(
      `select r.id, r.brand, r.flavor, r.taste, r.design, r.text, r."createdAt", u.username as author,
         case when trim(u.name) <> '' and u.name not like '%@%' then u.name else coalesce(u.username, 'Участник') end as "authorName",
         (select id::text from "profileImage" where "userId" = u.id and kind = 'avatar') as "avatarId"
       from review r join "user" u on u.id = r."userId" where ${where} order by ${REVIEW_ORDER[options.sort ?? 'new']} limit $5 offset $6`,
      [...args, size, (page - 1) * size]),
    db.query<{ count: number }>(`select count(*)::int as count from review r join "user" u on u.id = r."userId" where ${where}`, args),
  ]);
  return { items: rows.map(row => ({ ...row, name: `${row.brand} · ${flavorName(row.flavor)}` })), total: total.rows[0]!.count };
}

export interface BrandDrink { brand: string; flavor: string; name: string; cover: string | null; reviews: number; score: number | null; likes: number; skips: number; yours: boolean }

/** Every catalog drink of the company's brands with its reviews, average score and swipes; the company's own marked. */
export async function listBrandDrinks(businessId: string, brands: string[]): Promise<BrandDrink[]> {
  if (!brands.length) return [];
  const groups = (await loadAllCatalogGroups()).filter(group => brands.includes(group.brand) && isCountedCatalogDrink(group));
  const { rows } = await getPool().query<{ brand: string; flavor: string; reviews: number; score: number | null; likes: number; skips: number; yours: boolean }>(
    `select t.brand, t.flavor,
       (select count(*)::int from review r where r.brand = t.brand and r.flavor = t.flavor) as reviews,
       (select round(avg((r.taste + r.design) / 2.0)::numeric, 1)::float8 from review r where r.brand = t.brand and r.flavor = t.flavor) as score,
       (select count(*)::int from "drinkSwipe" s where s.brand = t.brand and s.flavor = t.flavor and s.liked) as likes,
       (select count(*)::int from "drinkSwipe" s where s.brand = t.brand and s.flavor = t.flavor and not s.liked) as skips,
       exists(select 1 from "businessDrink" d where d."businessId" = $3 and d.status = 'approved' and d.brand = t.brand and d.flavor = t.flavor) as yours
     from unnest($1::text[], $2::text[]) as t(brand, flavor)`,
    [groups.map(group => group.brand), groups.map(group => group.flavor), businessId]);
  const covers = new Map(groups.map(group => [JSON.stringify([group.brand, group.flavor]), group.coverImageUrl ?? null]));
  return rows.map(row => ({ ...row, name: `${row.brand} · ${flavorName(row.flavor)}`, cover: covers.get(JSON.stringify([row.brand, row.flavor])) ?? null }))
    .sort((a, b) => b.reviews - a.reviews || b.likes - a.likes || a.name.localeCompare(b.name, 'ru-RU'));
}

// ── «Рецензии на отзывы» (GigaChat) ─────────────────────────────────────────────────────────────────────────────────

export interface DrinkDigest {
  brand: string; flavor: string; name: string; cover: string | null; reviews: number; lastReviewAt: Date | null;
  digest: { body: ReviewDigest; reviewCount: number; createdAt: Date; model: string } | null;
  /** Reviews written after the current brief. */
  fresh: number;
}

/** The company's approved drinks with their latest brief and how many reviews came after it. */
export async function listDrinkDigests(businessId: string): Promise<DrinkDigest[]> {
  const [{ rows }, groups] = await Promise.all([getPool().query<Omit<DrinkDigest, 'name' | 'cover' | 'digest' | 'fresh'> & { body: ReviewDigest | null; reviewCount: number | null; digestAt: Date | null; model: string | null; fresh: number }>(
    `select d.brand, d.flavor,
       (select count(*)::int from review r where r.brand = d.brand and r.flavor = d.flavor and not exists(select 1 from "userBlock" b where b."userId" = r."userId")) as reviews,
       (select max(r."createdAt") from review r where r.brand = d.brand and r.flavor = d.flavor) as "lastReviewAt",
       g.digest as body, g."reviewCount", g."createdAt" as "digestAt", g.model,
       (select count(*)::int from review r where r.brand = d.brand and r.flavor = d.flavor and r."createdAt" > coalesce(g."lastReviewAt", 'epoch')
          and not exists(select 1 from "userBlock" b where b."userId" = r."userId")) as fresh
     from "businessDrink" d
     left join lateral (select * from "businessReviewDigest" x where x.brand = d.brand and x.flavor = d.flavor order by x."createdAt" desc limit 1) g on true
     where d."businessId" = $1 and d.status = 'approved' order by reviews desc, d.brand, d.flavor`, [businessId]), loadAllCatalogGroups()]);
  const covers = new Map(groups.map(group => [JSON.stringify([group.brand, group.flavor]), group.coverImageUrl ?? null]));
  return rows.map(row => ({
    brand: row.brand, flavor: row.flavor, name: `${row.brand} · ${flavorName(row.flavor)}`, cover: covers.get(JSON.stringify([row.brand, row.flavor])) ?? null,
    reviews: row.reviews, lastReviewAt: row.lastReviewAt, fresh: row.body ? row.fresh : row.reviews,
    digest: row.body ? { body: row.body, reviewCount: row.reviewCount ?? 0, createdAt: row.digestAt!, model: row.model ?? '' } : null,
  }));
}

/**
 * Writes a new brief for one of the company's approved drinks: at least DIGEST_MIN_REVIEWS reviews, something new since
 * the last brief, not within DIGEST_COOLDOWN_HOURS of it and within the company's DIGEST_DAILY_LIMIT. Only review texts
 * and scores go to GigaChat — no names; reviews of banned members are left out.
 */
export async function generateDrinkDigest(userId: string, brand: string, flavor: string, client: GigaChatClient | null = getGigaChat()): Promise<ReviewDigest> {
  if (!client) throw new BusinessError('Разбор нейросетью пока не подключён.');
  const business = (await getCabinet(userId))?.business ?? null;
  if (!business || business.status !== 'approved') throw new BusinessError('Разбор доступен подтверждённой компании.');
  const db = getPool();
  const owned = await db.query(`select 1 from "businessDrink" where "businessId" = $1 and brand = $2 and flavor = $3 and status = 'approved'`, [business.id, brand, flavor]);
  if (!owned.rowCount) throw new BusinessError('Этот напиток не подтверждён у компании.');
  const today = await db.query<{ count: number }>(`select count(*)::int as count from "businessReviewDigest" where "businessId" = $1 and "createdAt" > now() - interval '1 day'`, [business.id]);
  if (today.rows[0]!.count >= DIGEST_DAILY_LIMIT) throw new BusinessError(`На сегодня лимит — ${DIGEST_DAILY_LIMIT} разборов. Попробуйте завтра.`);
  return writeReviewDigest(brand, flavor, client, business.id);
}

/** Whether a drink's brief is due now: enough reviews, and none yet or new reviews after it once the cooldown passed. */
export function digestDue(drink: DrinkDigest, now = Date.now()): boolean {
  if (drink.reviews < DIGEST_MIN_REVIEWS) return false;
  if (!drink.digest) return true;
  return drink.fresh > 0 && now - new Date(drink.digest.createdAt).getTime() >= DIGEST_COOLDOWN_HOURS * 3_600_000;
}

/**
 * The cabinet's briefs write themselves (there is no «Разобрать» button): opening «Разбор» schedules this after the
 * response for the drinks that are due, one request at a time, within the company's DIGEST_DAILY_LIMIT. Each drink is
 * claimed in `telegramJobRun` for the hour, so two tabs or two instances do not ask the model twice; a failed one is
 * retried next hour (or by the nightly catalog run).
 */
export async function refreshBusinessDigests(businessId: string, drinks: DrinkDigest[], client: GigaChatClient | null = getGigaChat()): Promise<number> {
  if (!client) return 0;
  const db = getPool();
  const hour = new Date().toISOString().slice(0, 13);
  let written = 0;
  for (const drink of drinks.filter(item => digestDue(item))) {
    const today = await db.query<{ count: number }>(`select count(*)::int as count from "businessReviewDigest" where "businessId" = $1 and "createdAt" > now() - interval '1 day'`, [businessId]);
    if (today.rows[0]!.count >= DIGEST_DAILY_LIMIT) break;
    const claimed = await db.query(`insert into "telegramJobRun"(job, period) values ($1, $2) on conflict do nothing`, [`business-digest:${drink.brand}:${drink.flavor}`, hour]);
    if (!claimed.rowCount) continue;
    try { await writeReviewDigest(drink.brand, drink.flavor, client, businessId); written++; }
    catch (error) { if (!(error instanceof BusinessError)) console.error('[business-digest] drink failed', error instanceof Error ? error.message : 'unknown'); }
  }
  return written;
}

// ── The team's side ─────────────────────────────────────────────────────────────────────────────────────────────────

export interface AdminBusiness extends Business { owner: string | null; drinks: number; pendingDrinks: number }

export async function listBusinessesForAdmin(status: BusinessStatus): Promise<AdminBusiness[]> {
  return (await getPool().query<AdminBusiness>(
    `select ${COLUMNS}, u.username as owner,
       (select count(*)::int from "businessDrink" d where d."businessId" = b.id and d.status = 'approved') as drinks,
       (select count(*)::int from "businessDrink" d where d."businessId" = b.id and d.status = 'pending') as "pendingDrinks"
     from business b join "user" u on u.id = b."ownerId" where b.status = $1 order by b."createdAt" ${status === 'pending' ? 'asc' : 'desc'} limit 100`, [status])).rows;
}

export interface AdminBusinessDrink { businessId: string; business: string; brand: string; flavor: string; name: string; createdAt: Date }

export async function listPendingBusinessDrinks(): Promise<AdminBusinessDrink[]> {
  const { rows } = await getPool().query<Omit<AdminBusinessDrink, 'name'>>(
    `select d."businessId", b.name as business, d.brand, d.flavor, d."createdAt" from "businessDrink" d join business b on b.id = d."businessId"
     where d.status = 'pending' and b.status <> 'rejected' order by d."createdAt" limit 200`);
  return rows.map(row => ({ ...row, name: `${row.brand} · ${flavorName(row.flavor)}` }));
}

async function staffEmail(adminId: string): Promise<string> {
  const row = (await getPool().query<{ email: string }>(`select u.email from "user" u join "siteAdmin" a on a.email = lower(u.email) where u.id = $1`, [adminId])).rows[0];
  if (!row) throw new BusinessError('Решение принимает только команда.');
  return row.email;
}

export async function moderateBusiness(adminId: string, id: string, status: 'approved' | 'rejected', note: string): Promise<void> {
  const email = await staffEmail(adminId);
  if (status === 'rejected' && !note.trim()) throw new BusinessError('Напишите причину отказа.');
  const db = await getPool().connect();
  try {
    await db.query('begin');
    await db.query(`update business set status = $2, "moderationNote" = $3, "reviewedBy" = $4, "reviewedAt" = now() where id = $1`, [id, status, status === 'rejected' ? note.trim().slice(0, 500) : null, adminId]);
    await db.query('insert into "adminAuditLog" ("adminEmail", action, "targetType", "targetId") values ($1, $2, $3, $4)', [email, status === 'approved' ? 'approve' : 'reject', 'business', id]);
    await db.query('commit');
  } catch (error) { await db.query('rollback'); throw error; } finally { db.release(); }
}

export async function moderateBusinessDrink(adminId: string, businessId: string, brand: string, flavor: string, status: 'approved' | 'rejected', note: string): Promise<void> {
  const email = await staffEmail(adminId);
  const db = await getPool().connect();
  try {
    await db.query('begin');
    await db.query(`update "businessDrink" set status = $4, "moderationNote" = $5, "reviewedBy" = $6, "reviewedAt" = now() where "businessId" = $1 and brand = $2 and flavor = $3`,
      [businessId, brand, flavor, status, status === 'rejected' ? note.trim().slice(0, 500) || null : null, adminId]);
    await db.query('insert into "adminAuditLog" ("adminEmail", action, "targetType", "targetId") values ($1, $2, $3, $4)', [email, status === 'approved' ? 'approve' : 'reject', 'business-drink', `${businessId}:${brand}:${flavor}`]);
    await db.query('commit');
  } catch (error) { await db.query('rollback'); throw error; } finally { db.release(); }
}
