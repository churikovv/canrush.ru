'use server';

import type { PoolClient, QueryResultRow } from 'pg';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getPool } from '@/db/pool';
import { requireSiteAdmin, type SiteAdminIdentity } from '@/lib/admin';
import { normalizeAdminSearch, validateAdminEmail } from '@/lib/admin-fields';
import { adminTab, adminPage, type AdminTab } from '@/lib/admin-tabs';
import { catalogGroupSlug } from '@/lib/catalog-query';

type AdminNotice =
  | 'report-reviewed'
  | 'admin-added'
  | 'admin-exists'
  | 'admin-removed'
  | 'user-blocked'
  | 'user-unblocked'
  | 'tierlist-deleted'
  | 'review-deleted'
  | 'wall-deleted'
  | 'comment-deleted';

type AdminError = 'invalid-email' | 'protected-admin' | 'invalid-target' | 'operation-failed';

function returnQuery(formData: FormData): { search: string; tab: AdminTab; page: number } {
  return { search: normalizeAdminSearch(String(formData.get('query') ?? '')), tab: adminTab(formData.get('tab')), page: adminPage(formData.get('page')) };
}

function adminLocation(kind: 'notice' | 'error', value: AdminNotice | AdminError, query: ReturnType<typeof returnQuery>): string {
  const params = new URLSearchParams({ [kind]: value });
  if (query.search) params.set('q', query.search);
  params.set('tab', query.tab);
  if (query.page > 1) params.set('page', String(query.page));
  return `/admin?${params.toString()}`;
}

function validTargetId(value: string): boolean {
  return value.length >= 1 && value.length <= 160 && !/[\u0000-\u001f]/u.test(value);
}

async function auditedMutation<T>(
  admin: SiteAdminIdentity,
  action: string,
  targetType: string,
  targetId: string,
  operation: (client: PoolClient) => Promise<T | null>,
): Promise<T | null> {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const result = await operation(client);
    if (result === null) {
      await client.query('rollback');
      return null;
    }
    await client.query(
      `insert into "adminAuditLog" ("adminEmail", "action", "targetType", "targetId")
       values ($1, $2, $3, $4)`,
      [admin.email, action, targetType, targetId],
    );
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function addAdminAction(formData: FormData): Promise<void> {
  const admin = await requireSiteAdmin();
  const query = returnQuery(formData);
  const email = validateAdminEmail(String(formData.get('email') ?? ''));
  if (!email) redirect(adminLocation('error', 'invalid-email', query));

  let added: string | null;
  try {
    added = await auditedMutation(admin, 'add', 'admin', email, async (client) => {
      const result = await client.query(
        `insert into "siteAdmin" ("email", "addedByUserId")
         values ($1, $2)
         on conflict ("email") do nothing
         returning "email"`,
        [email, admin.userId],
      );
      if (result.rowCount !== 1) return null;
      await client.query(
        `delete from "userBlock"
         where "userId" in (select "id" from "user" where lower("email") = $1)`,
        [email],
      );
      return email;
    });
  } catch {
    redirect(adminLocation('error', 'operation-failed', query));
  }
  revalidatePath('/admin');
  redirect(adminLocation('notice', added ? 'admin-added' : 'admin-exists', query));
}

export async function removeAdminAction(formData: FormData): Promise<void> {
  const admin = await requireSiteAdmin();
  const query = returnQuery(formData);
  const email = validateAdminEmail(String(formData.get('email') ?? ''));
  if (!email) redirect(adminLocation('error', 'invalid-target', query));
  if (email === admin.email) redirect(adminLocation('error', 'protected-admin', query));

  let removed: string | null;
  try {
    removed = await auditedMutation(admin, 'remove', 'admin', email, async (client) => {
      const result = await client.query(
        'delete from "siteAdmin" where "email" = $1 and "isOwner" = false returning "email"',
        [email],
      );
      return result.rowCount === 1 ? email : null;
    });
  } catch {
    redirect(adminLocation('error', 'operation-failed', query));
  }
  if (!removed) redirect(adminLocation('error', 'protected-admin', query));
  revalidatePath('/admin');
  redirect(adminLocation('notice', 'admin-removed', query));
}

export async function blockUserAction(formData: FormData): Promise<void> {
  const admin = await requireSiteAdmin();
  const query = returnQuery(formData);
  const userId = String(formData.get('userId') ?? '');
  if (!validTargetId(userId) || userId === admin.userId) {
    redirect(adminLocation('error', 'invalid-target', query));
  }

  let blocked: string | null;
  try {
    blocked = await auditedMutation(admin, 'block', 'user', userId, async (client) => {
      const result = await client.query(
        `insert into "userBlock" ("userId", "blockedByUserId")
         select u."id", $2
         from "user" u
         where u."id" = $1
           and not exists (select 1 from "siteAdmin" sa where sa."email" = lower(u."email"))
         on conflict ("userId") do nothing
         returning "userId"`,
        [userId, admin.userId],
      );
      return result.rowCount === 1 ? userId : null;
    });
  } catch {
    redirect(adminLocation('error', 'operation-failed', query));
  }
  if (!blocked) redirect(adminLocation('error', 'invalid-target', query));
  revalidatePath('/admin');
  redirect(adminLocation('notice', 'user-blocked', query));
}

export async function unblockUserAction(formData: FormData): Promise<void> {
  const admin = await requireSiteAdmin();
  const query = returnQuery(formData);
  const userId = String(formData.get('userId') ?? '');
  if (!validTargetId(userId)) redirect(adminLocation('error', 'invalid-target', query));

  try {
    await auditedMutation(admin, 'unblock', 'user', userId, async (client) => {
      const result = await client.query(
        'delete from "userBlock" where "userId" = $1 returning "userId"',
        [userId],
      );
      return result.rowCount === 1 ? userId : null;
    });
  } catch {
    redirect(adminLocation('error', 'operation-failed', query));
  }
  revalidatePath('/admin');
  redirect(adminLocation('notice', 'user-unblocked', query));
}

export async function deleteAdminTierListAction(formData: FormData): Promise<void> {
  const admin = await requireSiteAdmin();
  const query = returnQuery(formData);
  const slug = String(formData.get('slug') ?? '').trim();
  if (!/^[a-z0-9-]{8,100}$/u.test(slug)) redirect(adminLocation('error', 'invalid-target', query));

  let deleted: string | null;
  try {
    deleted = await auditedMutation(admin, 'delete', 'tier-list', slug, async (client) => {
      const result = await client.query('delete from "tierList" where "slug" = $1 returning "slug"', [slug]);
      return result.rowCount === 1 ? slug : null;
    });
  } catch {
    redirect(adminLocation('error', 'operation-failed', query));
  }
  if (!deleted) redirect(adminLocation('error', 'invalid-target', query));
  revalidatePath('/admin');
  revalidatePath('/tierlists');
  revalidatePath(`/tierlists/${slug}`);
  revalidatePath('/profile');
  revalidatePath('/profile/tierlists');
  redirect(adminLocation('notice', 'tierlist-deleted', query));
}

interface DeletedReviewRow extends QueryResultRow {
  brand: string;
  flavor: string;
}

export async function deleteAdminReviewAction(formData: FormData): Promise<void> {
  const admin = await requireSiteAdmin();
  const query = returnQuery(formData);
  const reviewId = String(formData.get('reviewId') ?? '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(reviewId)) {
    redirect(adminLocation('error', 'invalid-target', query));
  }

  let deleted: DeletedReviewRow | null;
  try {
    deleted = await auditedMutation(admin, 'delete', 'review', reviewId, async (client) => {
      const result = await client.query<DeletedReviewRow>(
        'delete from "review" where "id" = $1 returning "brand", "flavor"',
        [reviewId],
      );
      return result.rows[0] ?? null;
    });
  } catch {
    redirect(adminLocation('error', 'operation-failed', query));
  }
  if (!deleted) redirect(adminLocation('error', 'invalid-target', query));
  revalidatePath('/admin');
  revalidatePath('/catalog');
  revalidatePath('/profile');
  if (deleted) revalidatePath(`/catalog/${catalogGroupSlug(deleted.brand, deleted.flavor)}`);
  redirect(adminLocation('notice', 'review-deleted', query));
}

export async function deleteAdminWallAction(formData: FormData): Promise<void> {
  const admin = await requireSiteAdmin();
  const query = returnQuery(formData);
  const id = String(formData.get('commentId') ?? '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(id)) redirect(adminLocation('error', 'invalid-target', query));
  let deleted: string | null;
  try {
    deleted = await auditedMutation(admin, 'delete', 'wall-comment', id, async client => {
      const result = await client.query('delete from "profileComment" where id=$1 returning id', [id]);
      return result.rows[0]?.id ?? null;
    });
  } catch { redirect(adminLocation('error', 'operation-failed', query)); }
  if (!deleted) redirect(adminLocation('error', 'invalid-target', query));
  revalidatePath('/admin');
  revalidatePath('/profile', 'layout');
  redirect(adminLocation('notice', 'wall-deleted', query));
}

export async function deleteAdminCommentAction(formData: FormData): Promise<void> {
  const admin = await requireSiteAdmin();
  const query = returnQuery(formData);
  const id = String(formData.get('commentId') ?? '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(id)) redirect(adminLocation('error', 'invalid-target', query));
  let deleted: string | null;
  try {
    deleted = await auditedMutation(admin, 'delete', 'review-comment', id, async client => {
      const result = await client.query('delete from "reviewComment" where id=$1 returning id', [id]);
      return result.rows[0]?.id ?? null;
    });
  } catch { redirect(adminLocation('error', 'operation-failed', query)); }
  if (!deleted) redirect(adminLocation('error', 'invalid-target', query));
  revalidatePath('/admin'); revalidatePath('/catalog', 'layout'); revalidatePath('/profile', 'layout');
  redirect(adminLocation('notice', 'comment-deleted', query));
}

export async function reviewProfileReportAction(formData: FormData): Promise<void> {
  const admin = await requireSiteAdmin();
  const query = returnQuery(formData);
  const id = String(formData.get('reportId') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || !['resolved','dismissed'].includes(status)) redirect(adminLocation('error','invalid-target',query));
  let updated;
  try {
    updated = await auditedMutation(admin, status, 'profile-report', id, async client => {
      const result = await client.query('update "profileReport" set status=$2,"reviewedAt"=now(),"reviewedBy"=$3 where id=$1 and status=\'open\' returning id', [id,status,admin.userId]);
      return result.rows[0] ?? null;
    });
  } catch { redirect(adminLocation('error','operation-failed',query)); }
  if (!updated) redirect(adminLocation('error','invalid-target',query));
  revalidatePath('/admin');
  redirect(adminLocation('notice','report-reviewed',query));
}
