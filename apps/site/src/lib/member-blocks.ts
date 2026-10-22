import { getPool } from '@/db/pool';

/** Raised by prevent_blocked_interaction() (migration 0086) when one member has blocked the other. */
export const MEMBER_BLOCKED_CODE = 'CR001';
export const MEMBER_BLOCKED_MESSAGE = 'Недоступно: один из вас заблокировал другого.';

export function isMemberBlockedError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === MEMBER_BLOCKED_CODE;
}

/** SQL condition hiding rows by members the viewer blocked; `author` is the column, `viewer` the parameter. */
export function notBlockedBy(viewer: string, author: string): string {
  return `not exists(select 1 from "memberBlock" mb where mb."blockerId" = ${viewer} and mb."blockedId" = ${author})`;
}

const USER_ID = /^[A-Za-z0-9_-]{1,160}$/u;

/** Blocks a member and drops follows both ways, so neither keeps the other in «Подписки». */
export async function blockMember(blockerId: string, blockedId: string): Promise<boolean> {
  if (!USER_ID.test(blockedId) || blockerId === blockedId) return false;
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const inserted = await client.query(`insert into "memberBlock" ("blockerId", "blockedId")
      select $1, id from "user" where id = $2 on conflict do nothing returning "blockedId"`, [blockerId, blockedId]);
    const exists = inserted.rowCount || (await client.query('select 1 from "memberBlock" where "blockerId"=$1 and "blockedId"=$2', [blockerId, blockedId])).rowCount;
    if (!exists) { await client.query('rollback'); return false; }
    await client.query('delete from "userFollow" where ("userId"=$1 and "targetId"=$2) or ("userId"=$2 and "targetId"=$1)', [blockerId, blockedId]);
    await client.query('commit');
    return true;
  } catch (error) { await client.query('rollback'); throw error; }
  finally { client.release(); }
}

export async function unblockMember(blockerId: string, blockedId: string): Promise<void> {
  await getPool().query('delete from "memberBlock" where "blockerId"=$1 and "blockedId"=$2', [blockerId, blockedId]);
}

export async function isBlockedByViewer(viewerId: string | null, userId: string): Promise<boolean> {
  if (!viewerId) return false;
  return Boolean((await getPool().query('select 1 from "memberBlock" where "blockerId"=$1 and "blockedId"=$2', [viewerId, userId])).rowCount);
}

export interface BlockedMember { id: string; name: string; username: string | null; blockedAt: Date }

export async function getBlockedMembers(viewerId: string): Promise<BlockedMember[]> {
  const { rows } = await getPool().query<BlockedMember>(`select u.id, u.name, u.username, b."createdAt" as "blockedAt"
    from "memberBlock" b join "user" u on u.id = b."blockedId" where b."blockerId" = $1 order by b."createdAt" desc`, [viewerId]);
  return rows;
}
