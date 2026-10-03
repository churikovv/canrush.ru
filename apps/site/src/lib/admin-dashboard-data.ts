import { getPool } from '@/db/pool';
import { normalizeAdminSearch } from '@/lib/admin-fields';
import { adminPage, type AdminTab } from '@/lib/admin-tabs';
import type { AdminEntry, AdminUserEntry, AdminTierListEntry, AdminReviewEntry } from '@/lib/admin';

export const ADMIN_PAGE_SIZE = 25;
export interface AdminWallEntry {
  photos: string[];
  id: string; text: string; createdAt: Date; authorName: string; authorEmail: string;
  authorUsername: string | null; profileUsername: string | null;
}
export interface AdminReviewCommentEntry { id: string; reviewId: string; text: string; createdAt: Date; authorName: string; authorEmail: string; brand: string; flavor: string }
export interface AdminMetrics {
  users: number; reviews: number; tierLists: number; wall: number; admins: number; sessions: number;
  newUsers: number; newReviews: number; newWall: number; newTierLists: number;
  published: number; drafts: number; blocked: number; averageRating: number | null;
}
export interface AdminDashboardData {
  comments: AdminReviewCommentEntry[];
  users: AdminUserEntry[]; tierLists: AdminTierListEntry[]; reviews: AdminReviewEntry[];
  admins: AdminEntry[]; wall: AdminWallEntry[]; total: number; page: number;
  metrics: AdminMetrics | null; registrations: { day: string; count: number }[];
}

export async function getAdminDashboardData(search: string, tab: AdminTab, requestedPage = 1): Promise<AdminDashboardData> {
  const db = getPool();
  const result: AdminDashboardData = { comments: [], users: [], tierLists: [], reviews: [], admins: [], wall: [], total: 0, page: 1, metrics: null, registrations: [] };
  if (tab === 'analytics') {
    const [metrics, registrations] = await Promise.all([
      db.query<AdminMetrics>(`select
        (select count(*)::int from "user") as users,
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
        (select avg((design+taste)::float8/2) from review) as "averageRating"`),
      db.query<{ day: string; count: number }>(`with days as (
        select generate_series((now() at time zone 'Europe/Moscow')::date-13, (now() at time zone 'Europe/Moscow')::date, interval '1 day')::date as day
      ), counts as (select ("createdAt" at time zone 'Europe/Moscow')::date as day, count(*)::int as count from "user"
        where "createdAt">=(((now() at time zone 'Europe/Moscow')::date-13)::timestamp at time zone 'Europe/Moscow') group by 1)
      select to_char(days.day,'YYYY-MM-DD') as day, coalesce(counts.count,0) as count from days left join counts using(day) order by days.day`),
    ]);
    result.metrics = metrics.rows[0] ?? null;
    result.registrations = registrations.rows;
    return result;
  }
  const query = normalizeAdminSearch(search);
  const pattern = query ? `%${query}%` : null;
  const fragments = {
    comments: `from "reviewComment" c join "user" u on u.id=c."userId" join review r on r.id=c."reviewId" where ($1::text is null or c.text ilike $1 or u.name ilike $1 or u.email ilike $1 or coalesce(u.username,'') ilike $1 or r.brand ilike $1)`,
    users: `from "user" u left join "userBlock" ub on ub."userId"=u.id left join "siteAdmin" sa on sa.email=lower(u.email)
      where ($1::text is null or u.name ilike $1 or u.email ilike $1 or coalesce(u.username,'') ilike $1)`,
    tierlists: `from "tierList" t join "user" u on u.id=t."userId" where ($1::text is null or t.title ilike $1 or u.name ilike $1 or u.email ilike $1 or coalesce(u.username,'') ilike $1)`,
    reviews: `from review r join "user" u on u.id=r."userId" where ($1::text is null or r.text ilike $1 or r.brand ilike $1 or u.name ilike $1 or u.email ilike $1 or coalesce(u.username,'') ilike $1)`,
    wall: `from "profileComment" c join "user" u on u.id=c."userId" join "user" p on p.id=c."profileId" where ($1::text is null or c.text ilike $1 or u.name ilike $1 or u.email ilike $1 or coalesce(u.username,'') ilike $1 or coalesce(p.username,'') ilike $1)`,
    admins: `from "siteAdmin" sa left join "user" u on u.id=sa."addedByUserId" where ($1::text is null or sa.email ilike $1)`,
  };
  const from = fragments[tab];
  result.total = (await db.query<{ count: number }>(`select count(*)::int as count ${from}`, [pattern])).rows[0]?.count ?? 0;
  result.page = Math.min(adminPage(requestedPage), Math.max(1, Math.ceil(result.total / ADMIN_PAGE_SIZE)));
  const params = [pattern, ADMIN_PAGE_SIZE, (result.page - 1) * ADMIN_PAGE_SIZE];
  const pagination = 'limit $2 offset $3';
  if (tab === 'users') result.users = (await db.query<AdminUserEntry>(`select u.id,u.name,u.email,u.username,u."createdAt", ub."createdAt" as "blockedAt",(sa.email is not null) as "isAdmin",
    (select count(*)::int from review where "userId"=u.id) as "reviewCount",
    (select count(*)::int from "tierList" where "userId"=u.id) as "tierListCount" ${from} order by u."createdAt" desc,u.id ${pagination}`,params)).rows;
  if (tab === 'tierlists') result.tierLists = (await db.query<AdminTierListEntry>(`select t.id,t.slug,t.title,t.status,t."updatedAt",t."userId",u.name as "authorName",u.email as "authorEmail",
    (select count(*)::int from "tierListItem" where "tierListId"=t.id) as "itemCount" ${from} order by t."updatedAt" desc,t.id ${pagination}`,params)).rows;
  if (tab === 'reviews') result.reviews = (await db.query<AdminReviewEntry>(`select r.id,r.brand,r.flavor,r.text,r."createdAt",r."userId",u.name as "authorName",u.email as "authorEmail",(r.design+r.taste)::float8/2 as score ${from} order by r."createdAt" desc,r.id ${pagination}`,params)).rows;
  if (tab === 'wall') result.wall = (await db.query<AdminWallEntry>(`select c.id,c.text,c."createdAt",coalesce((select array_agg(wp.id::text order by wp.position) from "wallPhoto" wp where wp."commentId"=c.id),'{}'::text[]) as photos,u.name as "authorName",u.email as "authorEmail",u.username as "authorUsername",p.username as "profileUsername" ${from} order by c."createdAt" desc,c.id ${pagination}`,params)).rows;
  if (tab === 'comments') result.comments = (await db.query<AdminReviewCommentEntry>(`select c.id,c."reviewId",c.text,c."createdAt",u.name as "authorName",u.email as "authorEmail",r.brand,r.flavor ${from} order by c."createdAt" desc,c.id ${pagination}`,params)).rows;
  if (tab === 'admins') result.admins = (await db.query<AdminEntry>(`select sa.email,sa."isOwner",sa."createdAt",u.name as "addedByName" ${from} order by sa."isOwner" desc,sa."createdAt",sa.email ${pagination}`,params)).rows;
  return result;
}
