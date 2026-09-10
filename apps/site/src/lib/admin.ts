import type { QueryResultRow } from 'pg';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getPool } from '@/db/pool';
import { auth } from '@/lib/auth';
import { normalizeAdminEmail, normalizeAdminSearch } from '@/lib/admin-fields';

export interface SiteAdminIdentity {
  userId: string;
  email: string;
  isOwner: boolean;
}

export interface AdminEntry {
  email: string;
  isOwner: boolean;
  createdAt: Date;
  addedByName: string | null;
}

export interface AdminUserEntry {
  id: string;
  name: string;
  email: string;
  username: string | null;
  createdAt: Date;
  blockedAt: Date | null;
  isAdmin: boolean;
  reviewCount: number;
  tierListCount: number;
}

export interface AdminTierListEntry {
  id: string;
  slug: string;
  title: string;
  status: 'draft' | 'published';
  updatedAt: Date;
  userId: string;
  authorName: string;
  authorEmail: string;
  itemCount: number;
}

export interface AdminReviewEntry {
  id: string;
  brand: string;
  flavor: string;
  text: string;
  createdAt: Date;
  userId: string;
  authorName: string;
  authorEmail: string;
  score: number;
}

export interface AdminDashboardData {
  admins: AdminEntry[];
  users: AdminUserEntry[];
  tierLists: AdminTierListEntry[];
  reviews: AdminReviewEntry[];
}

interface SiteAdminRow extends QueryResultRow {
  isOwner: boolean;
}

export async function isSiteAdminEmail(email: string): Promise<boolean> {
  const normalized = normalizeAdminEmail(email);
  const result = await getPool().query(
    'select 1 from "siteAdmin" where "email" = $1 limit 1',
    [normalized],
  );
  return result.rowCount === 1;
}

export async function requireSiteAdmin(): Promise<SiteAdminIdentity> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in');

  const email = normalizeAdminEmail(session.user.email);
  const result = await getPool().query<SiteAdminRow>(
    'select "isOwner" from "siteAdmin" where "email" = $1 limit 1',
    [email],
  );
  const admin = result.rows[0];
  if (!admin) redirect('/profile');

  return { userId: session.user.id, email, isOwner: admin.isOwner };
}

export async function getAdminDashboardData(searchValue?: string): Promise<AdminDashboardData> {
  const search = normalizeAdminSearch(searchValue);
  const pattern = search ? `%${search}%` : null;

  const [admins, users, tierLists, reviews] = await Promise.all([
    getPool().query<AdminEntry & QueryResultRow>(
      `select sa."email", sa."isOwner", sa."createdAt", u."name" as "addedByName"
       from "siteAdmin" sa
       left join "user" u on u."id" = sa."addedByUserId"
       order by sa."isOwner" desc, sa."createdAt", sa."email"`,
    ),
    getPool().query<AdminUserEntry & QueryResultRow>(
      `select u."id", u."name", u."email", u."username", u."createdAt",
              ub."createdAt" as "blockedAt",
              (sa."email" is not null) as "isAdmin",
              coalesce((select count(*)::int from "review" r where r."userId" = u."id"), 0) as "reviewCount",
              coalesce((select count(*)::int from "tierList" tl where tl."userId" = u."id"), 0) as "tierListCount"
       from "user" u
       left join "userBlock" ub on ub."userId" = u."id"
       left join "siteAdmin" sa on sa."email" = lower(u."email")
       where ($1::text is null or u."email" ilike $1 or u."name" ilike $1 or coalesce(u."username", '') ilike $1)
       order by (ub."createdAt" is not null) desc, u."createdAt" desc
       limit 60`,
      [pattern],
    ),
    getPool().query<AdminTierListEntry & QueryResultRow>(
      `select tl."id", tl."slug", tl."title", tl."status", tl."updatedAt", tl."userId",
              u."name" as "authorName", u."email" as "authorEmail",
              count(tli."tierListId")::int as "itemCount"
       from "tierList" tl
       join "user" u on u."id" = tl."userId"
       left join "tierListItem" tli on tli."tierListId" = tl."id"
       where ($1::text is null or tl."title" ilike $1 or u."email" ilike $1 or u."name" ilike $1)
       group by tl."id", u."id"
       order by tl."updatedAt" desc
       limit 60`,
      [pattern],
    ),
    getPool().query<AdminReviewEntry & QueryResultRow>(
      `select r."id", r."brand", r."flavor", r."text", r."createdAt", r."userId",
              u."name" as "authorName", u."email" as "authorEmail",
              ((r."design" + r."taste" + r."composition")::float8 / 3) as "score"
       from "review" r
       join "user" u on u."id" = r."userId"
       where ($1::text is null or r."text" ilike $1 or r."brand" ilike $1 or r."flavor" ilike $1 or u."email" ilike $1 or u."name" ilike $1)
       order by r."createdAt" desc
       limit 60`,
      [pattern],
    ),
  ]);

  return {
    admins: admins.rows,
    users: users.rows.map((row) => ({
      ...row,
      reviewCount: Number(row.reviewCount),
      tierListCount: Number(row.tierListCount),
    })),
    tierLists: tierLists.rows.map((row) => ({ ...row, itemCount: Number(row.itemCount) })),
    reviews: reviews.rows.map((row) => ({ ...row, score: Number(row.score) })),
  };
}
