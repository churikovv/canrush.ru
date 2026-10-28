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
import { brandSearchNames } from '@/lib/search-log-fields';
import { frozenMessage } from '@/lib/moderation';
import { isTelegramPlaceholderEmail } from '@/lib/telegram-init-data';
import { BUSINESS_ROLES, BusinessError, isBusinessMemberRole, type BusinessMemberRole, MAX_PENDING_BUSINESS_DRINKS, MAX_REPLY_TEMPLATES, parseBusinessReply, parseReplyTemplate, weeklySeries, type BusinessInput, type BusinessKind, type BusinessStatus } from '@/lib/business-fields';

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
 * Applies for a company account, or sends a rejected one again with fixes — back to the team's queue. Once applied, the
 * data is what the team checks: a company on review or approved cannot change it here (the cabinet shows it read-only,
 * changes go through support), so an approved name cannot be swapped without a new check. Blocked members cannot apply.
 */
export async function saveBusiness(userId: string, input: BusinessInput, termsVersion: string | null): Promise<void> {
  if (!termsVersion) throw new BusinessError('Примите условия для бизнеса, чтобы отправить заявку.');
  const db = getPool();
  if ((await db.query('select 1 from "userBlock" where "userId" = $1', [userId])).rowCount) throw new BusinessError('Этому аккаунту бизнес-кабинет недоступен.');
  const current = (await db.query<{ status: BusinessStatus }>('select status from business where "ownerId" = $1', [userId])).rows[0];
  if (current && current.status !== 'rejected') throw new BusinessError(current.status === 'pending' ? 'Заявка уже на проверке — данные можно будет поправить после решения.' : 'Данные подтверждённой компании меняются через поддержку: hello@canrush.ru.');
  await db.query(
    `insert into business("ownerId", name, kind, website, telegram, "contactEmail", about, "termsAcceptedAt", "termsVersion") values ($1, $2, $3, $4, $5, $6, $7, now(), $8)
     on conflict ("ownerId") do update set name = excluded.name, kind = excluded.kind, website = excluded.website, telegram = excluded.telegram,
       "contactEmail" = excluded."contactEmail", about = excluded.about, "updatedAt" = now(), "termsAcceptedAt" = now(), "termsVersion" = excluded."termsVersion",
       status = case when business.status = 'rejected' then 'pending' else business.status end,
       "moderationNote" = case when business.status = 'rejected' then null else business."moderationNote" end`,
    [userId, input.name, input.kind, input.website, input.telegram, input.contactEmail, input.about, termsVersion]);
}

export type BusinessRole = 'owner' | BusinessMemberRole;

/** The company whose cabinet the member opens: their own, or the one whose team they joined. */
export async function getCabinet(userId: string): Promise<{ business: Business; role: BusinessRole } | null> {
  const own = await getOwnBusiness(userId);
  if (own) return { business: own, role: 'owner' };
  const member = (await getPool().query<Business & { role: BusinessMemberRole }>(
    `select ${COLUMNS}, m.role from business b join "businessMember" m on m."businessId" = b.id where m."userId" = $1 and m.status = 'active'`, [userId])).rows[0];
  if (!member) return null;
  const { role, ...business } = member;
  return { business, role };
}

/** The company of a member who may act for it (owner or manager): an analyst only looks. */
async function editorCabinet(userId: string): Promise<Business> {
  const cabinet = await getCabinet(userId);
  if (!cabinet) throw new BusinessError('Сначала расскажите о компании.');
  if (cabinet.role === 'analyst') throw new BusinessError('У роли «Аналитик» только просмотр — попросите владельца кабинета сменить роль.');
  return cabinet.business;
}

/**
 * One line of the team's action log (`businessAuditLog`): who did what to which object. Never fails the action itself.
 */
export async function logBusiness(businessId: string, userId: string | null, action: string, target: string | null = null): Promise<void> {
  await getPool().query(`insert into "businessAuditLog"("businessId", "userId", action, target) values ($1, $2, $3, $4)`, [businessId, userId, action, target?.slice(0, 200) ?? null])
    .catch(error => console.error('[business] audit log failed', error instanceof Error ? error.message : 'unknown'));
}

export interface BusinessAuditEntry { id: string; action: string; target: string | null; createdAt: Date; actor: string; username: string | null }

/** The latest actions of the team, newest first. */
export async function listBusinessAudit(businessId: string, limit = 100): Promise<BusinessAuditEntry[]> {
  return (await getPool().query<BusinessAuditEntry>(
    `select a.id::text, a.action, a.target, a."createdAt", u.username,
       case when u.id is null then 'Бывший участник' when trim(u.name) <> '' and u.name not like '%@%' then u.name else coalesce(u.username, 'Участник') end as actor
     from "businessAuditLog" a left join "user" u on u.id = a."userId" where a."businessId" = $1 order by a."createdAt" desc, a.id desc limit $2`, [businessId, limit])).rows;
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
  await editorCabinet(userId);
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
  await logBusiness(business.id, userId, 'drink-request', `${option.brand} · ${flavorName(option.flavor)}`);
}

export async function removeBusinessDrink(userId: string, brand: string, flavor: string): Promise<void> {
  const business = await editorCabinet(userId);
  const removed = await getPool().query(`delete from "businessDrink" where "businessId" = $1 and brand = $2 and flavor = $3`, [business.id, brand, flavor]);
  if (removed.rowCount) await logBusiness(business.id, userId, 'drink-remove', `${brand} · ${flavorName(flavor)}`);
}

// ── Team ────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const MAX_BUSINESS_MEMBERS = 10;
/** Invitation letters a company may send a day — the form must not become a way to spam addresses. */
export const BUSINESS_INVITES_PER_DAY = 20;
/** A team row: a member (or their pending invitation), or an invitation still waiting for its address to sign in. */
export interface BusinessMember { key: string; userId: string | null; email: string | null; username: string | null; name: string; avatarId: string | null; status: 'pending' | 'active'; role: BusinessMemberRole; createdAt: Date }

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
       m.status, m.role, m."createdAt"
     from "businessMember" m join "user" u on u.id = m."userId" where m."businessId" = $1
     union all
     select 'email:' || e.email, null, e.email, null, e.email, null, 'pending', e.role, e."createdAt" from "businessEmailInvite" e where e."businessId" = $1
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
export async function inviteBusinessMember(ownerId: string, rawTarget: string, sendMail?: InviteMail, role: BusinessMemberRole = 'manager'): Promise<'email' | 'username'> {
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
      inserted = (await db.query(`insert into "businessMember"("businessId", "userId", "invitedBy", "invitedEmail", role) values ($1, $2, $3, $4, $5) on conflict do nothing`, [business.id, user.id, ownerId, email, role])).rowCount ?? 0;
      if (inserted) await db.query(`insert into notification("userId", "actorId", kind, "eventKey", payload) values ($1, $2, 'business-invite', $3, $4) on conflict ("userId", "eventKey") do nothing`,
        [user.id, ownerId, `business-invite:${business.id}`, JSON.stringify({ business: business.name })]);
    } else if (user) {
      return 'email'; // a banned account: the same answer as for any address, and no letter
    } else {
      inserted = (await db.query(`insert into "businessEmailInvite"("businessId", email, "invitedBy", role) values ($1, $2, $3, $4) on conflict do nothing`, [business.id, email, ownerId, role])).rowCount ?? 0;
    }
    if (!inserted) throw new BusinessError('На этот адрес приглашение уже отправлено.');
    await logBusiness(business.id, ownerId, 'invite', email);
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
  const inserted = await db.query(`insert into "businessMember"("businessId", "userId", "invitedBy", role) values ($1, $2, $3, $4) on conflict do nothing`, [business.id, user.id, ownerId, role]);
  if (!inserted.rowCount) throw new BusinessError('Этот участник уже в команде или приглашён.');
  await logBusiness(business.id, ownerId, 'invite', `@${username}`);
  await db.query(`insert into notification("userId", "actorId", kind, "eventKey", payload) values ($1, $2, 'business-invite', $3, $4) on conflict ("userId", "eventKey") do nothing`,
    [user.id, ownerId, `business-invite:${business.id}`, JSON.stringify({ business: business.name })]);
  return 'username';
}

/** Removes a member or withdraws an invitation (`user:<id>` or `email:<address>`, as listBusinessMembers keys them). */
export async function removeBusinessMember(ownerId: string, key: string): Promise<void> {
  const business = await ownerBusinessOrThrow(ownerId);
  if (key.startsWith('email:')) await getPool().query(`delete from "businessEmailInvite" where "businessId" = $1 and email = $2`, [business.id, key.slice(6)]);
  else if (key.startsWith('user:')) await getPool().query(`delete from "businessMember" where "businessId" = $1 and "userId" = $2`, [business.id, key.slice(5)]);
  else return;
  await logBusiness(business.id, ownerId, 'member-remove', await memberLabel(key));
}

/** «@nick» or the address of a team row key, for the log. */
async function memberLabel(key: string): Promise<string> {
  if (key.startsWith('email:')) return key.slice(6);
  const user = (await getPool().query<{ username: string | null; name: string }>(`select username, name from "user" where id = $1`, [key.slice(5)])).rows[0];
  return user?.username ? `@${user.username}` : user?.name ?? 'участник';
}

/** The owner changes a teammate's (or an invitation's) role. */
export async function setBusinessMemberRole(ownerId: string, key: string, role: unknown): Promise<void> {
  const business = await ownerBusinessOrThrow(ownerId);
  if (!isBusinessMemberRole(role)) throw new BusinessError('Выберите роль.');
  const result = key.startsWith('email:')
    ? await getPool().query(`update "businessEmailInvite" set role = $3 where "businessId" = $1 and email = $2 and role <> $3`, [business.id, key.slice(6), role])
    : key.startsWith('user:') ? await getPool().query(`update "businessMember" set role = $3 where "businessId" = $1 and "userId" = $2 and role <> $3`, [business.id, key.slice(5), role]) : null;
  if (result?.rowCount) await logBusiness(business.id, ownerId, 'member-role', `${await memberLabel(key)} → ${BUSINESS_ROLES.find(item => item.value === role)!.label}`);
}

export interface BusinessInvite { businessId: string; business: string; kind: string; inviter: string | null; createdAt: Date }
export async function listBusinessInvites(userId: string): Promise<BusinessInvite[]> {
  // Invitations sent to this member's email before they had an account become ordinary pending invitations now.
  await getPool().query(
    `with mine as (select lower(email) as email from "user" where id = $1),
       moved as (delete from "businessEmailInvite" e using mine where e.email = mine.email returning e."businessId", e."invitedBy", e.email, e.role, e."createdAt")
     insert into "businessMember"("businessId", "userId", "invitedBy", "invitedEmail", role, "createdAt") select "businessId", $1, "invitedBy", email, role, "createdAt" from moved
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
    await logBusiness(business.id, ownerId, 'logo');
    return id;
  } catch (error) { await db.query('rollback'); throw error; } finally { db.release(); }
}

export async function removeBusinessLogo(ownerId: string): Promise<void> {
  const business = await ownerBusinessOrThrow(ownerId);
  await getPool().query(`delete from "businessLogo" where "businessId" = $1`, [business.id]);
  await logBusiness(business.id, ownerId, 'logo-remove');
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
  /** The company's public reply, if it wrote one. */
  reply: { text: string; updatedAt: Date } | null;
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
/** Which reviews: all, the ones the company has not answered yet, or the low ones (average below 5). */
export type BusinessReviewView = 'all' | 'unanswered' | 'low';
const REVIEW_VIEW: Record<BusinessReviewView, string> = {
  all: 'true',
  unanswered: 'not exists(select 1 from "reviewCompanyReply" c where c."reviewId" = r.id)',
  low: '(r.taste + r.design) < 10',
};

export async function listBusinessReviews(businessId: string, options: { page?: number; size?: number; drink?: { brand: string; flavor: string }; q?: string; sort?: BusinessReviewSort; limit?: number; view?: BusinessReviewView } = {}): Promise<{ items: BusinessReview[]; total: number }> {
  const db = getPool();
  const size = options.limit ?? options.size ?? 20, page = options.page ?? 1;
  const where = `exists(select 1 from "businessDrink" d where d."businessId" = $1 and d.status = 'approved' and d.brand = r.brand and d.flavor = r.flavor)
    and ($2::text is null or (r.brand = $2 and r.flavor = $3)) and not exists(select 1 from "userBlock" b where b."userId" = r."userId")
    and ($4::text is null or strpos(lower(r.text), lower($4)) > 0 or strpos(lower(u.username), lower($4)) > 0)
    and ${REVIEW_VIEW[options.view ?? 'all']}`;
  const args = [businessId, options.drink?.brand ?? null, options.drink?.flavor ?? null, options.q?.trim().slice(0, 80) || null];
  const [{ rows }, total] = await Promise.all([
    db.query<Omit<BusinessReview, 'name'>>(
      `select r.id, r.brand, r.flavor, r.taste, r.design, r.text, r."createdAt", u.username as author,
         case when trim(u.name) <> '' and u.name not like '%@%' then u.name else coalesce(u.username, 'Участник') end as "authorName",
         (select id::text from "profileImage" where "userId" = u.id and kind = 'avatar') as "avatarId",
         (select jsonb_build_object('text', c.text, 'updatedAt', c."updatedAt") from "reviewCompanyReply" c where c."reviewId" = r.id and c."businessId" = $1) as reply
       from review r join "user" u on u.id = r."userId" where ${where} order by ${REVIEW_ORDER[options.sort ?? 'new']} limit $5 offset $6`,
      [...args, size, (page - 1) * size]),
    db.query<{ count: number }>(`select count(*)::int as count from review r join "user" u on u.id = r."userId" where ${where}`, args),
  ]);
  return { items: rows.map(row => ({ ...row, name: `${row.brand} · ${flavorName(row.flavor)}`, reply: row.reply ? { text: row.reply.text, updatedAt: new Date(row.reply.updatedAt) } : null })), total: total.rows[0]!.count };
}

/** How many reviews of the company's approved drinks wait for an answer, and how many of them are low. */
export async function countReviewQueue(businessId: string): Promise<{ unanswered: number; low: number; lowUnanswered: number }> {
  return (await getPool().query<{ unanswered: number; low: number; lowUnanswered: number }>(
    `select count(*) filter (where ${REVIEW_VIEW.unanswered})::int as unanswered, count(*) filter (where ${REVIEW_VIEW.low})::int as low,
       count(*) filter (where ${REVIEW_VIEW.unanswered} and ${REVIEW_VIEW.low})::int as "lowUnanswered"
     from review r where exists(select 1 from "businessDrink" d where d."businessId" = $1 and d.status = 'approved' and d.brand = r.brand and d.flavor = r.flavor)
       and not exists(select 1 from "userBlock" b where b."userId" = r."userId")`, [businessId])).rows[0]!;
}

/**
 * The company's public reply to a review (`reviewCompanyReply`, migration 0124): the owner or an active member of an
 * approved company, only on a review of one of its approved drinks; writing again edits it. The review's author is
 * notified once (trigger `notify_business_reply`). Blocked or frozen members cannot write.
 */
export async function replyToReview(userId: string, reviewId: string, value: unknown): Promise<void> {
  const text = parseBusinessReply(value);
  const business = await replyBusiness(userId, reviewId);
  const frozen = await frozenMessage(userId);
  if (frozen) throw new BusinessError(frozen);
  const saved = await getPool().query<{ created: boolean }>(
    `insert into "reviewCompanyReply"("reviewId", "businessId", "authorId", text) values ($1, $2, $3, $4)
     on conflict ("reviewId") do update set text = excluded.text, "authorId" = excluded."authorId", "updatedAt" = now()
       where "reviewCompanyReply"."businessId" = excluded."businessId" returning (xmax = 0) as created`, [reviewId, business.id, userId, text]);
  if (!saved.rowCount) throw new BusinessError('На этот отзыв уже ответила другая компания.');
  await logBusiness(business.id, userId, saved.rows[0]!.created ? 'reply' : 'reply-edit', await reviewLabel(reviewId));
}

/** «Burn · Манго, @автор» — the review a log line is about. */
async function reviewLabel(reviewId: string): Promise<string> {
  const row = (await getPool().query<{ brand: string; flavor: string; username: string | null }>(
    `select r.brand, r.flavor, u.username from review r join "user" u on u.id = r."userId" where r.id = $1`, [reviewId])).rows[0];
  return row ? `${row.brand} · ${flavorName(row.flavor)}${row.username ? `, @${row.username}` : ''}` : 'отзыв';
}

/** Removes the company's reply (owner or active member). */
export async function deleteReviewReply(userId: string, reviewId: string): Promise<void> {
  const business = await replyBusiness(userId, reviewId);
  const removed = await getPool().query(`delete from "reviewCompanyReply" where "reviewId" = $1 and "businessId" = $2`, [reviewId, business.id]);
  if (removed.rowCount) await logBusiness(business.id, userId, 'reply-delete', await reviewLabel(reviewId));
}

async function replyBusiness(userId: string, reviewId: string): Promise<Business> {
  if (!/^[0-9a-f-]{36}$/i.test(reviewId)) throw new BusinessError('Отзыв не найден.');
  const cabinet = await getCabinet(userId);
  const business = cabinet?.business ?? null;
  if (!business || business.status !== 'approved') throw new BusinessError('Отвечать может подтверждённая компания.');
  if (cabinet!.role === 'analyst') throw new BusinessError('У роли «Аналитик» только просмотр — отвечать могут владелец и менеджеры.');
  const db = getPool();
  if ((await db.query(`select 1 from "userBlock" where "userId" = $1`, [userId])).rowCount) throw new BusinessError('Аккаунт заблокирован.');
  const owned = await db.query(`select 1 from review r join "businessDrink" d on d.brand = r.brand and d.flavor = r.flavor
    where r.id = $1 and d."businessId" = $2 and d.status = 'approved'`, [reviewId, business.id]);
  if (!owned.rowCount) throw new BusinessError('Можно ответить только на отзыв о подтверждённом напитке компании.');
  return business;
}

export interface BusinessSearch {
  brands: string[];
  /** Searches in the last 30 days that showed a brand in the results or named it, and the 30 days before. */
  total30: number; previous30: number; shown30: number; named30: number;
  /** Searches that named a brand and found nothing: demand the catalog, stores or market did not meet. */
  missed30: number;
  weekly: { week: string; count: number }[];
  top: { query: string; count: number; results: number; named: boolean; scopes: string[]; lastAt: Date }[];
  missed: { query: string; count: number; lastAt: Date }[];
}

/**
 * «Поиск» in the cabinet, from the anonymous `searchQuery` log (search-log.ts): searches whose results showed one of
 * the company's brands (brands of its approved drinks) or whose text named one (the brand and its search aliases).
 */
export async function getBusinessSearch(businessId: string, today = moscowDay(), topLimit = 20): Promise<BusinessSearch> {
  const db = getPool();
  const brands = [...new Set((await db.query<{ brand: string }>(`select distinct brand from "businessDrink" where "businessId" = $1 and status = 'approved'`, [businessId])).rows.map(row => row.brand))];
  const empty: BusinessSearch = { brands, total30: 0, previous30: 0, shown30: 0, named30: 0, missed30: 0, weekly: weeklySeries([], today), top: [], missed: [] };
  if (!brands.length) return empty;
  const names = [...new Set(brands.flatMap(brandSearchNames))];
  const scope = `with s as (
      select q.*, q.brands && $1::text[] as shown, exists(select 1 from unnest($2::text[]) as n(name) where strpos(q.query, n.name) > 0) as named
      from "searchQuery" q where q."createdAt" > now() - interval '13 weeks'),
    m as (select * from s where shown or named)`;
  const recent = `"createdAt" > now() - interval '30 days'`;
  const [totals, weekly, top, missed] = await Promise.all([
    db.query<Omit<BusinessSearch, 'brands' | 'weekly' | 'top' | 'missed'>>(`${scope}
      select count(*) filter (where ${recent})::int as total30,
        count(*) filter (where "createdAt" <= now() - interval '30 days' and "createdAt" > now() - interval '60 days')::int as previous30,
        count(*) filter (where shown and ${recent})::int as shown30, count(*) filter (where named and ${recent})::int as named30,
        count(*) filter (where named and results = 0 and ${recent})::int as missed30
      from m`, [brands, names]),
    db.query<{ week: string; count: number }>(`${scope}
      select date_trunc('week', "createdAt" at time zone 'Europe/Moscow')::date::text as week, count(*)::int as count from m group by 1`, [brands, names]),
    db.query<BusinessSearch['top'][number]>(`${scope}
      select query, count(*)::int as count, round(avg(results))::int as results, bool_or(named) as named,
        array_agg(distinct scope order by scope) as scopes, max("createdAt") as "lastAt"
      from m where ${recent} group by query order by count(*) desc, max("createdAt") desc limit $3`, [brands, names, topLimit]),
    db.query<BusinessSearch['missed'][number]>(`${scope}
      select query, count(*)::int as count, max("createdAt") as "lastAt"
      from m where named and results = 0 and ${recent} group by query order by count(*) desc, max("createdAt") desc limit 10`, [brands, names]),
  ]);
  return { ...empty, ...totals.rows[0]!, weekly: weeklySeries(weekly.rows, today), top: top.rows, missed: missed.rows };
}

export interface BusinessCards {
  /** Approved drinks of the company: card views and taps on store offers in the last 30 days and the 30 before. */
  drinks: number;
  views30: number; previousViews30: number; clicks30: number; previousClicks30: number;
  /** Views per week for 12 weeks, store taps in the same weeks. */
  weekly: { week: string; count: number; clicks: number }[];
  items: { brand: string; flavor: string; name: string; cover: string | null; views: number; clicks: number; retailer: string | null }[];
  retailers: { retailer: string; count: number }[];
}

/**
 * Drink card analytics for the company's approved drinks (`catalogEvent`, anonymous): views of the drink page and
 * taps on a store offer, 30 days against the 30 before, by week, by drink (with the most tapped store) and by store.
 */
export async function getBusinessCards(businessId: string, today = moscowDay()): Promise<BusinessCards> {
  const db = getPool();
  const own = (await db.query<{ brand: string; flavor: string }>(`select brand, flavor from "businessDrink" where "businessId" = $1 and status = 'approved' order by brand, flavor`, [businessId])).rows;
  const empty: BusinessCards = { drinks: own.length, views30: 0, previousViews30: 0, clicks30: 0, previousClicks30: 0, weekly: weeklySeries([], today).map(item => ({ ...item, clicks: 0 })), items: [], retailers: [] };
  if (!own.length) return empty;
  const params = [own.map(row => row.brand), own.map(row => row.flavor)];
  const scope = `with d as (select * from unnest($1::text[], $2::text[]) as t(brand, flavor)),
    e as (select e.* from "catalogEvent" e join d on d.brand = e.brand and d.flavor = e.flavor where e."createdAt" > now() - interval '13 weeks')`;
  const recent = `"createdAt" > now() - interval '30 days'`;
  const before = `"createdAt" <= now() - interval '30 days' and "createdAt" > now() - interval '60 days'`;
  const [totals, weekly, items, retailers, groups] = await Promise.all([
    db.query<Pick<BusinessCards, 'views30' | 'previousViews30' | 'clicks30' | 'previousClicks30'>>(`${scope}
      select count(*) filter (where kind = 'view' and ${recent})::int as "views30", count(*) filter (where kind = 'view' and ${before})::int as "previousViews30",
        count(*) filter (where kind = 'store' and ${recent})::int as "clicks30", count(*) filter (where kind = 'store' and ${before})::int as "previousClicks30"
      from e`, params),
    db.query<{ week: string; count: number; clicks: number }>(`${scope}
      select date_trunc('week', "createdAt" at time zone 'Europe/Moscow')::date::text as week,
        count(*) filter (where kind = 'view')::int as count, count(*) filter (where kind = 'store')::int as clicks
      from e group by 1`, params),
    db.query<{ brand: string; flavor: string; views: number; clicks: number; retailer: string | null }>(`${scope}
      select d.brand, d.flavor,
        (select count(*)::int from e where e.brand = d.brand and e.flavor = d.flavor and e.kind = 'view' and e.${recent}) as views,
        (select count(*)::int from e where e.brand = d.brand and e.flavor = d.flavor and e.kind = 'store' and e.${recent}) as clicks,
        (select e.retailer from e where e.brand = d.brand and e.flavor = d.flavor and e.kind = 'store' and e.${recent}
          group by e.retailer order by count(*) desc, e.retailer limit 1) as retailer
      from d`, params),
    db.query<{ retailer: string; count: number }>(`${scope}
      select retailer, count(*)::int as count from e where kind = 'store' and retailer is not null and ${recent}
      group by retailer order by count(*) desc, retailer limit 10`, params),
    loadAllCatalogGroups(),
  ]);
  const clicksByWeek = new Map(weekly.rows.map(row => [row.week, row.clicks]));
  const covers = new Map(groups.map(group => [JSON.stringify([group.brand, group.flavor]), group.coverImageUrl ?? null]));
  return {
    ...empty, ...totals.rows[0]!,
    weekly: weeklySeries(weekly.rows, today).map(item => ({ ...item, clicks: clicksByWeek.get(item.week) ?? 0 })),
    items: items.rows.map(row => ({ ...row, name: `${row.brand} · ${flavorName(row.flavor)}`, cover: covers.get(JSON.stringify([row.brand, row.flavor])) ?? null }))
      .sort((a, b) => b.views - a.views || b.clicks - a.clicks || a.name.localeCompare(b.name, 'ru-RU')),
    retailers: retailers.rows,
  };
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

type ApprovedMail = (to: string, business: string) => Promise<void>;

/**
 * The team's decision on a company. Approving one that was not approved yet sends its owner the good-news letter
 * (`sendBusinessApprovedEmail`) after the commit — not to a Telegram placeholder address; a failed letter does not undo
 * the decision.
 */
export async function moderateBusiness(adminId: string, id: string, status: 'approved' | 'rejected', note: string, sendMail?: ApprovedMail): Promise<void> {
  const email = await staffEmail(adminId);
  if (status === 'rejected' && !note.trim()) throw new BusinessError('Напишите причину отказа.');
  const db = await getPool().connect();
  let letter: { to: string; business: string } | null = null;
  try {
    await db.query('begin');
    const before = (await db.query<{ status: BusinessStatus; name: string; email: string }>(
      `select b.status, b.name, u.email from business b join "user" u on u.id = b."ownerId" where b.id = $1 for update of b`, [id])).rows[0];
    if (!before) throw new BusinessError('Компания не найдена.');
    await db.query(`update business set status = $2, "moderationNote" = $3, "reviewedBy" = $4, "reviewedAt" = now() where id = $1`, [id, status, status === 'rejected' ? note.trim().slice(0, 500) : null, adminId]);
    await db.query('insert into "adminAuditLog" ("adminEmail", action, "targetType", "targetId") values ($1, $2, $3, $4)', [email, status === 'approved' ? 'approve' : 'reject', 'business', id]);
    await db.query('commit');
    if (status === 'approved' && before.status !== 'approved' && !isTelegramPlaceholderEmail(before.email)) letter = { to: before.email, business: before.name };
  } catch (error) { await db.query('rollback'); throw error; } finally { db.release(); }
  if (!letter) return;
  try { await (sendMail ?? (await import('@/lib/email')).sendBusinessApprovedEmail)(letter.to, letter.business); }
  catch (error) { console.error('[business] approval email failed', error instanceof Error ? error.message : 'unknown'); }
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

// ── Шаблоны ответов ────────────────────────────────────────────────────────────────────────────────────────────────

export interface ReplyTemplate { id: string; title: string; text: string }

export async function listReplyTemplates(businessId: string): Promise<ReplyTemplate[]> {
  return (await getPool().query<ReplyTemplate>(`select id, title, text from "businessReplyTemplate" where "businessId" = $1 order by "createdAt", title`, [businessId])).rows;
}

/** The company whose replies the member may write and keep templates for: approved, owner or active teammate. */
async function replyingCompany(userId: string): Promise<Business> {
  const business = await editorCabinet(userId).catch(error => { if ((error as Error).message.startsWith('Сначала')) return null; throw error; });
  if (!business || business.status !== 'approved') throw new BusinessError('Шаблоны доступны подтверждённой компании.');
  return business;
}

/** Saves a template for the whole team; at most MAX_REPLY_TEMPLATES, titles unique within the company. */
export async function saveReplyTemplate(userId: string, title: unknown, text: unknown): Promise<ReplyTemplate> {
  const business = await replyingCompany(userId);
  const input = parseReplyTemplate(title, text);
  const result = await getPool().query<ReplyTemplate>(`insert into "businessReplyTemplate"("businessId", title, text, "createdBy")
    select $1, $2, $3, $4 where (select count(*) from "businessReplyTemplate" where "businessId" = $1) < $5 returning id, title, text`,
  [business.id, input.title, input.text, userId, MAX_REPLY_TEMPLATES]).catch((error: { code?: string }) => {
    if (error.code === '23505') throw new BusinessError('Шаблон с таким названием уже есть.');
    throw error;
  });
  if (!result.rows[0]) throw new BusinessError(`Можно сохранить до ${MAX_REPLY_TEMPLATES} шаблонов — удалите ненужный.`);
  await logBusiness(business.id, userId, 'template', input.title);
  return result.rows[0];
}

export async function deleteReplyTemplate(userId: string, id: string): Promise<void> {
  const business = await replyingCompany(userId);
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new BusinessError('Шаблон не найден.');
  const removed = await getPool().query<{ title: string }>(`delete from "businessReplyTemplate" where id = $1 and "businessId" = $2 returning title`, [id, business.id]);
  if (removed.rows[0]) await logBusiness(business.id, userId, 'template-delete', removed.rows[0].title);
}

// ── Стартовый чек-лист ─────────────────────────────────────────────────────────────────────────────────────────────

export interface OnboardingStep { key: 'verified' | 'logo' | 'drink' | 'team' | 'reply' | 'competitors'; done: boolean }

/** What a new company has already set up: the checklist on the overview disappears once every step is done. */
export async function getOnboarding(business: Business): Promise<OnboardingStep[]> {
  const row = (await getPool().query<{ drink: boolean; team: boolean; reply: boolean; competitors: boolean }>(
    `select exists(select 1 from "businessDrink" where "businessId" = $1 and status <> 'rejected') as drink,
       exists(select 1 from "businessMember" where "businessId" = $1) or exists(select 1 from "businessEmailInvite" where "businessId" = $1) as team,
       exists(select 1 from "reviewCompanyReply" where "businessId" = $1) as reply,
       exists(select 1 from "businessCompetitor" where "businessId" = $1) as competitors`, [business.id])).rows[0]!;
  return [
    { key: 'verified', done: business.status === 'approved' },
    { key: 'logo', done: Boolean(business.logoId) },
    { key: 'drink', done: row.drink },
    { key: 'team', done: row.team },
    { key: 'reply', done: row.reply },
    { key: 'competitors', done: row.competitors },
  ];
}
