import type { ContentReportKind, ReportReason } from '@/lib/profile-report-fields';
import { getPool } from '@/db/pool';
import { normalizeAdminSearch } from '@/lib/admin-fields';
import { DEFAULT_PROFILE_APPEARANCE, parseProfileAppearance } from '@/lib/profile-appearance';
import { adminPage, type AdminTab } from '@/lib/admin-tabs';
import type { AdminEntry, AdminUserEntry } from '@/lib/admin';

export const ADMIN_PAGE_SIZE = 25;
export interface AdminMetrics {
  users: number; online: number; reviews: number; tierLists: number; wall: number; admins: number; sessions: number;
  newUsers: number; newReviews: number; newWall: number; newTierLists: number;
  published: number; drafts: number; blocked: number; averageRating: number | null;
  /** Members with signed-in activity today (Moscow day) and in the last 7 days including today, hidden status included. */
  activeToday: number; activeWeek: number;
  /** Dating: decisions kept now (a repeat swipe replaces one, «вернуть» deletes it), without blocked members. */
  swipes: number; swipeLikes: number; swipers: number; swipersWeek: number;
  topSwipe: { brand: string; flavor: string; likes: number } | null;
}
export interface AdminReportEntry { id: string; reason: ReportReason; comment: string; status: 'open' | 'resolved' | 'dismissed'; createdAt: Date; authorName: string; authorUsername: string | null; targetName: string; targetUsername: string | null; contentKind: ContentReportKind | null; excerpt: string; pagePath: string | null }
export interface AdminMarketEntry { id: string; title: string; sellerId: string; sellerName: string; sellerEmail: string; username: string | null; closed: boolean; deletedAt: Date | null; blockedAt: Date | null; isAdmin: boolean; createdAt: Date }
export interface AdminDashboardData {
  market: AdminMarketEntry[];
  reports: AdminReportEntry[];
  users: AdminUserEntry[];
  admins: AdminEntry[]; total: number; page: number;
  metrics: AdminMetrics | null; registrations: { day: string; count: number }[];
  /** Last 24 hours, oldest first: peak of members active in one 5-minute window during the hour. */
  onlineByHour: { hour: string; peak: number }[];
  /** Last 14 Moscow days, oldest first: members with signed-in activity that day. */
  activity: { day: string; count: number }[];
  /** Last 14 Moscow days, oldest first: swipes by the day of the decision and the members who made them. */
  swipesByDay: { day: string; count: number; likes: number; members: number }[];
  /** «Приложения»: members by the platform they came from (`platformDay`) and devices registered for push. */
  apps: AdminAppMetrics | null;
}

export type PlatformCounts = { ios: number; android: number; telegram: number; web: number };
export interface AdminAppMetrics {
  /** Last 14 Moscow days, oldest first: members active that day on each platform. */
  byDay: (PlatformCounts & { day: string })[];
  today: PlatformCounts; week: PlatformCounts; month: PlatformCounts;
  /** Members in either app over 30 days, counted once, and their share of all active members. */
  appMonth: number; activeMonth: number;
  /** Members with a device registered for push, by provider. */
  push: { fcm: number; rustore: number; apns: number };
  /** The first day with platform data: counting began with the deploy of migration 0143. */
  since: string | null;
}

/** `showEmails` is off for moderators: their tables show `@nickname` instead of the email and search ignores emails. */
export async function getAdminDashboardData(search: string, tab: AdminTab, requestedPage = 1, showEmails = true): Promise<AdminDashboardData> {
  const db = getPool();
  const result: AdminDashboardData = { market: [], reports: [], users: [], admins: [], total: 0, page: 1, metrics: null, registrations: [], onlineByHour: [], activity: [], swipesByDay: [], apps: null };
  if (tab === 'campaigns') return result;
  if (tab === 'analytics') {
    await db.query(`delete from "presenceSample" where bucket < now() - interval '8 days'`);
    await db.query(`delete from "activityDay" where day < (now() at time zone 'Europe/Moscow')::date - 400`);
    await db.query(`delete from "platformDay" where day < (now() at time zone 'Europe/Moscow')::date - 400`);
    const [metrics, registrations, online, activity, swipes, apps] = await Promise.all([
      db.query<AdminMetrics>(`select
        (select count(*)::int from "user") as users,
        -- Same rule as the profile status (getPresence): a heartbeat within 2 minutes and a live session.
        (select count(*)::int from "user" u where u."showOnline" and u."lastSeenAt">now()-interval '2 minutes'
          and exists(select 1 from session s where s."userId"=u.id and s."expiresAt">now())) as online,
        (select count(*)::int from review) as reviews,
        (select count(*)::int from "tierList") as "tierLists",
        (select count(*)::int from "profileComment") as wall,
        (select count(*)::int from "siteAdmin") as admins,
        (select count(distinct s."userId")::int from session s where s."expiresAt">now() and not exists(select 1 from "userBlock" b where b."userId"=s."userId")) as sessions,
        (select count(*)::int from "user" where "createdAt">=now()-interval '30 days') as "newUsers",
        (select count(*)::int from review where "createdAt">=now()-interval '30 days') as "newReviews",
        (select count(*)::int from "profileComment" where "createdAt">=now()-interval '30 days') as "newWall",
        (select count(*)::int from "tierList" where "createdAt">=now()-interval '30 days') as "newTierLists",
        (select count(*)::int from "tierList" where status='published') as published,
        (select count(*)::int from "tierList" where status='draft') as drafts,
        (select count(*)::int from "userBlock") as blocked,
        (select avg((design+taste)::float8/2) from review) as "averageRating",
        (select count(*)::int from "activityDay" a where a.day=(now() at time zone 'Europe/Moscow')::date
          and not exists(select 1 from "userBlock" b where b."userId"=a."userId")) as "activeToday",
        (select count(distinct a."userId")::int from "activityDay" a where a.day>(now() at time zone 'Europe/Moscow')::date-7
          and not exists(select 1 from "userBlock" b where b."userId"=a."userId")) as "activeWeek",
        (select count(*)::int from "drinkSwipe" s where not exists(select 1 from "userBlock" b where b."userId"=s."userId")) as swipes,
        (select count(*)::int from "drinkSwipe" s where liked and not exists(select 1 from "userBlock" b where b."userId"=s."userId")) as "swipeLikes",
        (select count(distinct s."userId")::int from "drinkSwipe" s where not exists(select 1 from "userBlock" b where b."userId"=s."userId")) as swipers,
        (select count(distinct s."userId")::int from "drinkSwipe" s where s."createdAt">=now()-interval '7 days'
          and not exists(select 1 from "userBlock" b where b."userId"=s."userId")) as "swipersWeek",
        (select json_build_object('brand', brand, 'flavor', flavor, 'likes', count(*)::int) from "drinkSwipe" s
          where liked and not exists(select 1 from "userBlock" b where b."userId"=s."userId")
          group by brand, flavor order by count(*) desc, brand, flavor limit 1) as "topSwipe"`),
      db.query<{ day: string; count: number }>(`with days as (
        select generate_series((now() at time zone 'Europe/Moscow')::date-13, (now() at time zone 'Europe/Moscow')::date, interval '1 day')::date as day
      ), counts as (select ("createdAt" at time zone 'Europe/Moscow')::date as day, count(*)::int as count from "user"
        where "createdAt">=(((now() at time zone 'Europe/Moscow')::date-13)::timestamp at time zone 'Europe/Moscow') group by 1)
      select to_char(days.day,'YYYY-MM-DD') as day, coalesce(counts.count,0) as count from days left join counts using(day) order by days.day`),
      db.query<{ hour: string; peak: number }>(`with hours as (
        select generate_series(date_trunc('hour', now()) - interval '23 hours', date_trunc('hour', now()), interval '1 hour') as hour
      ), buckets as (select bucket, count(*)::int as online from "presenceSample" where bucket >= date_trunc('hour', now()) - interval '23 hours' group by bucket)
      select to_char(hours.hour at time zone 'Europe/Moscow', 'YYYY-MM-DD"T"HH24:00') as hour, coalesce(max(buckets.online), 0)::int as peak
      from hours left join buckets on buckets.bucket >= hours.hour and buckets.bucket < hours.hour + interval '1 hour'
      group by hours.hour order by hours.hour`),
      db.query<{ day: string; count: number }>(`with days as (
        select generate_series((now() at time zone 'Europe/Moscow')::date-13, (now() at time zone 'Europe/Moscow')::date, interval '1 day')::date as day
      ), counts as (select a.day, count(*)::int as count from "activityDay" a
        where a.day>=(now() at time zone 'Europe/Moscow')::date-13 and not exists(select 1 from "userBlock" b where b."userId"=a."userId") group by a.day)
      select to_char(days.day,'YYYY-MM-DD') as day, coalesce(counts.count,0) as count from days left join counts using(day) order by days.day`),
      db.query<{ day: string; count: number; likes: number; members: number }>(`with days as (
        select generate_series((now() at time zone 'Europe/Moscow')::date-13, (now() at time zone 'Europe/Moscow')::date, interval '1 day')::date as day
      ), counts as (select (s."createdAt" at time zone 'Europe/Moscow')::date as day, count(*)::int as count, count(*) filter (where s.liked)::int as likes,
          count(distinct s."userId")::int as members from "drinkSwipe" s
        where s."createdAt">=(((now() at time zone 'Europe/Moscow')::date-13)::timestamp at time zone 'Europe/Moscow')
          and not exists(select 1 from "userBlock" b where b."userId"=s."userId") group by 1)
      select to_char(days.day,'YYYY-MM-DD') as day, coalesce(counts.count,0) as count, coalesce(counts.likes,0) as likes, coalesce(counts.members,0) as members
      from days left join counts using(day) order by days.day`),
      getAppMetrics(),
    ]);
    result.apps = apps;
    result.swipesByDay = swipes.rows;
    result.activity = activity.rows;
    result.onlineByHour = online.rows;
    result.metrics = metrics.rows[0] ?? null;
    result.registrations = registrations.rows;
    return result;
  }
  const query = normalizeAdminSearch(search);
  // Moderators see members by nickname: emails are neither shown nor searchable for them.
  const email = showEmails ? 'u.email' : `coalesce('@' || u.username, 'почта скрыта')`;
  const emailSearch = (alias: 'u' | 'p') => showEmails ? ` or ${alias}.email ilike $1` : '';
  const pattern = query ? `%${query}%` : null;
  const fragments = {
    market: `from "marketListing" l join "user" u on u.id=l."sellerId" left join "userBlock" b on b."userId"=u.id left join "siteAdmin" sa on sa.email=lower(u.email) where ($1::text is null or l.title ilike $1 or l.description ilike $1 or u.name ilike $1${emailSearch('u')} or coalesce(u.username,'') ilike $1)`,
    reports: `from "profileReport" r join "user" u on u.id=r."userId" join "user" p on p.id=r."targetId" where ($1::text is null or r.comment ilike $1 or r.excerpt ilike $1 or u.name ilike $1${emailSearch('u')} or coalesce(u.username,'') ilike $1 or p.name ilike $1${emailSearch('p')} or coalesce(p.username,'') ilike $1)`,
    users: `from "user" u left join "userBlock" ub on ub."userId"=u.id left join "siteAdmin" sa on sa.email=lower(u.email)
      where ($1::text is null or u.name ilike $1${emailSearch('u')} or coalesce(u.username,'') ilike $1)`,
    admins: `from "siteAdmin" sa left join "user" u on u.id=sa."addedByUserId" where ($1::text is null or sa.email ilike $1)`,
  };
  const from = fragments[tab];
  result.total = (await db.query<{ count: number }>(`select count(*)::int as count ${from}`, [pattern])).rows[0]?.count ?? 0;
  result.page = Math.min(adminPage(requestedPage), Math.max(1, Math.ceil(result.total / ADMIN_PAGE_SIZE)));
  const params = [pattern, ADMIN_PAGE_SIZE, (result.page - 1) * ADMIN_PAGE_SIZE];
  const pagination = 'limit $2 offset $3';
  if (tab === 'market') result.market = (await db.query<AdminMarketEntry>(`select l.id,l.title,l."sellerId",l.closed,l."deletedAt",l."createdAt",u.name as "sellerName",${email} as "sellerEmail",u.username,b."createdAt" as "blockedAt",(sa.email is not null) as "isAdmin" ${from} order by l."createdAt" desc,l.id ${pagination}`,params)).rows;
  if (tab === 'reports') result.reports = (await db.query<AdminReportEntry>(`select r.id,r.reason,r.comment,r.status,r."createdAt",r."contentKind",r.excerpt,r."pagePath",u.name as "authorName",u.username as "authorUsername",p.name as "targetName",p.username as "targetUsername" ${from} order by (r.status='open') desc,r."createdAt" desc,r.id ${pagination}`,params)).rows;
  if (tab === 'users') result.users = (await db.query<Omit<AdminUserEntry, 'frame'> & { appearance: unknown }>(`select u.id,u.name,${email} as email,u.username,u."createdAt", ub."createdAt" as "blockedAt",(sa.email is not null) as "isAdmin",sa.role,
    (select count(*)::int from review where "userId"=u.id) as "reviewCount",
    (select count(*)::int from "tierList" where "userId"=u.id) as "tierListCount",
    ((select count(*) from "reviewComment" where "userId"=u.id)+(select count(*) from "tierListComment" where "userId"=u.id)
      +(select count(*) from "wallReply" where "userId"=u.id)+(select count(*) from "profileComment" where "userId"=u.id))::int as "commentCount",
    (select id::text from "profileImage" where "userId"=u.id and kind='avatar') as "avatarId", u."profileAppearance" as appearance,
    case when u."profileTags"[1] in ('admin','moderator') then case when sa.role = u."profileTags"[1] then u."profileTags"[1] end
      when exists(select 1 from "profileAchievement" where "userId"=u.id and key=u."profileTags"[1]) then u."profileTags"[1] end as tag,
    coalesce((select sum(points) from "profileExperience" where "userId"=u.id),0)::int as xp,
    (select until from "userFreeze" where "userId"=u.id and until>now()) as "frozenUntil"
    ${from} order by u."createdAt" desc,u.id ${pagination}`,params)).rows.map(({ appearance, ...user }) => ({ ...user, frame: (parseProfileAppearance(appearance) ?? DEFAULT_PROFILE_APPEARANCE).frame }));
  if (tab === 'admins') result.admins = (await db.query<AdminEntry>(`select sa.email,sa."isOwner",sa.role,sa."createdAt",u.name as "addedByName" ${from} order by sa."isOwner" desc,sa."createdAt",sa.email ${pagination}`,params)).rows;
  return result;
}

const PLATFORM_COUNTS = (since: string) => `count(distinct p."userId") filter (where p.platform = 'ios' and p.day >= ${since})::int as ios,
  count(distinct p."userId") filter (where p.platform = 'android' and p.day >= ${since})::int as android,
  count(distinct p."userId") filter (where p.platform = 'telegram' and p.day >= ${since})::int as telegram,
  count(distinct p."userId") filter (where p.platform = 'web' and p.day >= ${since})::int as web`;

/**
 * Members by platform (`platformDay`): today, 7 and 30 Moscow days, the last 14 days by day, plus push devices.
 * Blocked members are left out, as in the other activity numbers. A member on two platforms counts on each.
 */
export async function getAppMetrics(): Promise<AdminAppMetrics> {
  const db = getPool();
  const today = `(now() at time zone 'Europe/Moscow')::date`;
  const live = `not exists(select 1 from "userBlock" b where b."userId" = p."userId")`;
  const [totals, byDay, push] = await Promise.all([
    db.query<Record<string, number | string | null>>(`select
        ${PLATFORM_COUNTS(today).replace(/ as (ios|android|telegram|web)/g, ' as "today_$1"')},
        ${PLATFORM_COUNTS(`${today} - 6`).replace(/ as (ios|android|telegram|web)/g, ' as "week_$1"')},
        ${PLATFORM_COUNTS(`${today} - 29`).replace(/ as (ios|android|telegram|web)/g, ' as "month_$1"')},
        count(distinct p."userId") filter (where p.platform in ('ios', 'android'))::int as "appMonth",
        count(distinct p."userId")::int as "activeMonth",
        (select to_char(min(day), 'YYYY-MM-DD') from "platformDay") as since
      from "platformDay" p where p.day >= ${today} - 29 and ${live}`),
    db.query<PlatformCounts & { day: string }>(`with days as (select generate_series(${today} - 13, ${today}, interval '1 day')::date as day)
      select to_char(days.day, 'YYYY-MM-DD') as day,
        count(distinct p."userId") filter (where p.platform = 'ios')::int as ios, count(distinct p."userId") filter (where p.platform = 'android')::int as android,
        count(distinct p."userId") filter (where p.platform = 'telegram')::int as telegram, count(distinct p."userId") filter (where p.platform = 'web')::int as web
      from days left join "platformDay" p on p.day = days.day and ${live} group by days.day order by days.day`),
    db.query<{ fcm: number; rustore: number; apns: number }>(`select
        count(distinct "userId") filter (where provider = 'fcm')::int as fcm, count(distinct "userId") filter (where provider = 'rustore')::int as rustore,
        count(distinct "userId") filter (where provider = 'apns')::int as apns from "pushDevice"`),
  ]);
  const row = totals.rows[0] ?? {};
  const pick = (prefix: string): PlatformCounts => ({ ios: Number(row[`${prefix}_ios`] ?? 0), android: Number(row[`${prefix}_android`] ?? 0), telegram: Number(row[`${prefix}_telegram`] ?? 0), web: Number(row[`${prefix}_web`] ?? 0) });
  return {
    byDay: byDay.rows, today: pick('today'), week: pick('week'), month: pick('month'),
    appMonth: Number(row.appMonth ?? 0), activeMonth: Number(row.activeMonth ?? 0),
    push: push.rows[0] ?? { fcm: 0, rustore: 0, apns: 0 }, since: (row.since as string | null) ?? null,
  };
}
