import type { QueryResultRow } from 'pg';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getPool } from '@/db/pool';
import { auth } from '@/lib/auth';
import { normalizeAdminEmail } from '@/lib/admin-fields';

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
