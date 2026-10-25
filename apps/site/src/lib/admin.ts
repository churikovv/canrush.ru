import type { QueryResultRow } from 'pg';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getPool } from '@/db/pool';
import { auth } from '@/lib/auth';
import { normalizeAdminEmail } from '@/lib/admin-fields';
import type { SiteRole } from '@/lib/admin-roles';

export { SITE_ROLE_LABELS, type SiteRole } from '@/lib/admin-roles';

export interface SiteAdminIdentity {
  userId: string;
  email: string;
  isOwner: boolean;
  role: SiteRole;
}

export interface AdminEntry {
  email: string;
  isOwner: boolean;
  role: SiteRole;
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

interface SiteAdminRow extends QueryResultRow {
  isOwner: boolean;
  role: SiteRole;
}

/** The member's role in the panel, or null for everyone else. */
export async function siteRoleForEmail(email: string): Promise<SiteRole | null> {
  const result = await getPool().query<{ role: SiteRole }>('select role from "siteAdmin" where "email" = $1 limit 1', [normalizeAdminEmail(email)]);
  return result.rows[0]?.role ?? null;
}

/** An administrator (not a moderator): secret tags, the bot's admin summary and everything only admins may do. */
export async function isSiteAdminEmail(email: string): Promise<boolean> {
  return (await siteRoleForEmail(email)) === 'admin';
}

/** Admin or moderator: the panel link in settings and moderating listings and stores on their pages. */
export async function isSiteStaffEmail(email: string): Promise<boolean> {
  return (await siteRoleForEmail(email)) !== null;
}

export async function requireSiteAdmin(): Promise<SiteAdminIdentity> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in');

  const email = normalizeAdminEmail(session.user.email);
  const result = await getPool().query<SiteAdminRow>(
    'select "isOwner", role from "siteAdmin" where "email" = $1 limit 1',
    [email],
  );
  const admin = result.rows[0];
  if (!admin) redirect('/profile');

  return { userId: session.user.id, email, isOwner: admin.isOwner, role: admin.role };
}

/** Pages and actions closed to moderators (administrators, contests, campaigns, store transfers). */
export async function requireFullAdmin(): Promise<SiteAdminIdentity> {
  const admin = await requireSiteAdmin();
  if (admin.role !== 'admin') redirect('/admin?error=forbidden');
  return admin;
}
