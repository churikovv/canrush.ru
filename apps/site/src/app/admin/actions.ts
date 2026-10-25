'use server';

import type { PoolClient } from 'pg';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getPool } from '@/db/pool';
import { requireFullAdmin, requireSiteAdmin, type SiteAdminIdentity, type SiteRole } from '@/lib/admin';
import { normalizeAdminSearch, validateAdminEmail } from '@/lib/admin-fields';
import { adminTab, adminPage, type AdminTab } from '@/lib/admin-tabs';
import { parseStoreReference, parseStoreTransferTarget } from '@/lib/store-fields';

type AdminNotice =
  | 'report-reviewed'
  | 'admin-added'
  | 'admin-exists'
  | 'role-changed'
  | 'admin-removed'
  | 'user-blocked'
  | 'user-unblocked'
  | 'user-frozen'
  | 'user-unfrozen'
  | 'tierlists-purged'
  | 'comments-purged'
  | 'user-deleted';

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

/**
 * One action on a member from the «⋯» menu of «Участники»: runs in a transaction with an audit row, never on a member
 * of the team (admins and moderators), never on oneself. `full` — only administrators (deleting an account).
 */
async function memberAction(formData: FormData, options: { full?: boolean; action: string; notice: AdminNotice; run: (client: PoolClient, userId: string, admin: SiteAdminIdentity) => Promise<boolean> }): Promise<void> {
  const admin = options.full ? await requireFullAdmin() : await requireSiteAdmin();
  const query = returnQuery(formData);
  const userId = String(formData.get('userId') ?? '');
  if (!validTargetId(userId) || userId === admin.userId) redirect(adminLocation('error', 'invalid-target', query));
  let done: string | null;
  try {
    done = await auditedMutation(admin, options.action, 'user', userId, async client => {
      const staff = await client.query('select 1 from "user" t join "siteAdmin" sa on sa.email = lower(t.email) where t.id = $1', [userId]);
      if (staff.rowCount) return null;
      return await options.run(client, userId, admin) ? userId : null;
    });
  } catch {
    redirect(adminLocation('error', 'operation-failed', query));
  }
  if (!done) redirect(adminLocation('error', 'invalid-target', query));
  revalidatePath('/', 'layout');
  redirect(adminLocation('notice', options.notice, query));
}

const FREEZE_DAYS = [1, 7, 30] as const;

/** «Заморозить на сутки / неделю / месяц»: a temporary ban on posting ("userFreeze", 0108); a new freeze replaces the old. */
export async function freezeUserAction(formData: FormData): Promise<void> {
  const days = FREEZE_DAYS.find(value => value === Number(formData.get('days'))) ?? 1;
  await memberAction(formData, { action: `freeze-${days}d`, notice: 'user-frozen', run: async (client, userId, admin) => (await client.query(
    `insert into "userFreeze" ("userId", until, "frozenBy") select id, now() + make_interval(days => $2), $3 from "user" where id = $1
     on conflict ("userId") do update set until = excluded.until, "frozenBy" = excluded."frozenBy", "createdAt" = now()`, [userId, days, admin.userId])).rowCount === 1 });
}

export async function unfreezeUserAction(formData: FormData): Promise<void> {
  await memberAction(formData, { action: 'unfreeze', notice: 'user-unfrozen', run: async (client, userId) => (await client.query('delete from "userFreeze" where "userId" = $1', [userId])).rowCount === 1 });
}

/** Every tier list of the member, drafts included. */
export async function purgeUserTierListsAction(formData: FormData): Promise<void> {
  await memberAction(formData, { action: 'purge-tierlists', notice: 'tierlists-purged', run: async (client, userId) => {
    await client.query('delete from "tierList" where "userId" = $1', [userId]);
    return true;
  } });
}

/** Comments under reviews, tier lists and wall posts, and the member's own wall posts (the feed shows them). */
export async function purgeUserCommentsAction(formData: FormData): Promise<void> {
  await memberAction(formData, { action: 'purge-comments', notice: 'comments-purged', run: async (client, userId) => {
    for (const table of ['"reviewComment"', '"tierListComment"', '"wallReply"', '"profileComment"']) await client.query(`delete from ${table} where "userId" = $1`, [userId]);
    return true;
  } });
}

/** The account and everything tied to it, as when the member deletes it themselves (deleteAccountAction). Admins only. */
export async function deleteUserAction(formData: FormData): Promise<void> {
  await memberAction(formData, { full: true, action: 'delete-account', notice: 'user-deleted', run: async (client, userId) => {
    await client.query(`delete from "telegramChat" where "telegramId"::text in
      (select "accountId" from account where "userId" = $1 and "providerId" = 'telegram')`, [userId]);
    return (await client.query('delete from "user" where id = $1', [userId])).rowCount === 1;
  } });
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
