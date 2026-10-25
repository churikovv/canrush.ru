'use server';

import type { PoolClient, QueryResultRow } from 'pg';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getPool } from '@/db/pool';
import { requireFullAdmin, requireSiteAdmin, type SiteAdminIdentity, type SiteRole } from '@/lib/admin';
import { normalizeAdminSearch, validateAdminEmail } from '@/lib/admin-fields';
import { adminTab, adminPage, type AdminTab } from '@/lib/admin-tabs';
import { catalogGroupSlug } from '@/lib/catalog-query';
import { parseStoreReference, parseStoreTransferTarget } from '@/lib/store-fields';

type AdminNotice =
  | 'report-reviewed'
  | 'admin-added'
  | 'admin-exists'
  | 'role-changed'
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

const siteRole = (value: FormDataEntryValue | null): SiteRole | null => value === 'admin' || value === 'moderator' ? value : null;

/** Only an administrator adds staff, as an administrator or a moderator (`role`, administrator by default). */
export async function addAdminAction(formData: FormData): Promise<void> {
  const admin = await requireFullAdmin();
  const query = returnQuery(formData);
  const email = validateAdminEmail(String(formData.get('email') ?? ''));
  if (!email) redirect(adminLocation('error', 'invalid-email', query));
  const role = siteRole(formData.get('role') ?? 'admin');
  if (!role) redirect(adminLocation('error', 'invalid-target', query));

  let added: string | null;
  try {
    added = await auditedMutation(admin, 'add', 'admin', email, async (client) => {
      const result = await client.query(
        `insert into "siteAdmin" ("email", "addedByUserId", role)
         values ($1, $2, $3)
         on conflict ("email") do nothing
         returning "email"`,
        [email, admin.userId, role],
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
  const admin = await requireFullAdmin();
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

/** An administrator switches another member of staff between administrator and moderator; the owner stays an administrator. */
export async function setAdminRoleAction(formData: FormData): Promise<void> {
  const admin = await requireFullAdmin();
  const query = returnQuery(formData);
  const email = validateAdminEmail(String(formData.get('email') ?? ''));
  const role = siteRole(formData.get('role'));
  if (!email || !role) redirect(adminLocation('error', 'invalid-target', query));
  if (email === admin.email) redirect(adminLocation('error', 'protected-admin', query));

  let changed: string | null;
  try {
    changed = await auditedMutation(admin, role === 'moderator' ? 'make-moderator' : 'make-admin', 'admin', email, async (client) => {
      const result = await client.query(
        'update "siteAdmin" set role = $2 where "email" = $1 and "isOwner" = false and role <> $2 returning "email"',
        [email, role],
      );
      return result.rowCount === 1 ? email : null;
    });
  } catch {
    redirect(adminLocation('error', 'operation-failed', query));
  }
  if (!changed) redirect(adminLocation('error', 'protected-admin', query));
  revalidatePath('/admin');
  redirect(adminLocation('notice', 'role-changed', query));
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
  const wall = formData.get('kind') === 'wall';
  let deleted: string | null;
  try {
    deleted = await auditedMutation(admin, 'delete', wall ? 'wall-reply' : 'review-comment', id, async client => {
      const result = await client.query(wall ? 'delete from "wallReply" where id=$1 returning id' : 'delete from "reviewComment" where id=$1 returning id', [id]);
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

export interface StoreTransferState { error?: string; success?: string }
/** Hands a store (and its editing) to another member found by email or username; the change is audited. */
export async function transferStoreAction(_previous: StoreTransferState, formData: FormData): Promise<StoreTransferState> {
  const admin = await requireFullAdmin();
  const storeId = parseStoreReference(String(formData.get('store') ?? ''));
  if (!storeId) return { error: 'Вставьте ссылку на магазин или его ID.' };
  const target = parseStoreTransferTarget(String(formData.get('owner') ?? ''));
  if (!target) return { error: 'Укажите почту, @юзернейм или ссылку на профиль участника.' };
  const db = getPool();
  const store = (await db.query<{ name: string; ownerId: string; ownerUsername: string | null }>(
    'select s.name, s."ownerId", u.username as "ownerUsername" from "marketStore" s join "user" u on u.id = s."ownerId" where s.id = $1', [storeId])).rows[0];
  if (!store) return { error: 'Магазин не найден.' };
  const owner = (await db.query<{ id: string; username: string | null; blocked: boolean }>(
    `select u.id, u.username, exists(select 1 from "userBlock" b where b."userId" = u.id) as blocked from "user" u
     where ${target.kind === 'email' ? 'lower(u.email) = $1' : 'u.username = $1'} limit 1`, [target.value])).rows[0];
  if (!owner) return { error: target.kind === 'email' ? 'Участник с такой почтой не найден.' : 'Участник с таким юзернеймом не найден.' };
  if (owner.blocked) return { error: 'Этот участник заблокирован — передать ему магазин нельзя.' };
  if (owner.id === store.ownerId) return { error: 'Магазин уже принадлежит этому участнику.' };
  let moved: string | null;
  try {
    moved = await auditedMutation(admin, 'transfer', 'store', `${storeId}:${owner.id}`, async client => {
      const result = await client.query('update "marketStore" set "ownerId" = $2 where id = $1 and "ownerId" = $3 returning id', [storeId, owner.id, store.ownerId]);
      return result.rowCount === 1 ? storeId : null;
    });
  } catch { return { error: 'Не удалось передать магазин. Попробуйте ещё раз.' }; }
  if (!moved) return { error: 'Владелец магазина только что изменился. Обновите страницу.' };
  revalidatePath('/market/stores', 'layout');
  revalidatePath('/admin/stores');
  const name = (username: string | null) => username ? `@${username}` : 'участник без юзернейма';
  return { success: `Магазин «${store.name}» передан ${name(owner.username)}. Прежний владелец: ${name(store.ownerUsername)}.` };
}
