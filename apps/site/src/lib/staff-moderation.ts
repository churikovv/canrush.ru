import { getPool } from '@/db/pool';
import { isContentId } from '@/lib/profile-report-fields';

/**
 * Content an admin or a moderator can delete right where it is shown («Удалить» in its «⋯» menu), the same deletes the
 * admin panel makes. Market listings and stores are moderated on their own pages; order messages are private.
 */
const STAFF_DELETE = {
  review: { table: 'review', audit: 'review' },
  'review-comment': { table: '"reviewComment"', audit: 'review-comment' },
  'tier-list': { table: '"tierList"', audit: 'tier-list' },
  'tier-comment': { table: '"tierListComment"', audit: 'tier-comment' },
  'wall-post': { table: '"profileComment"', audit: 'wall-comment' },
  'wall-reply': { table: '"wallReply"', audit: 'wall-reply' },
  story: { table: '"story"', audit: 'story' },
  article: { table: 'article', audit: 'article' },
  // A company's reply to a review is keyed by the review (one reply each): the id is the review's.
  'company-reply': { table: '"reviewCompanyReply"', audit: 'company-reply', key: '"reviewId"' },
} as const;
export type StaffDeleteKind = keyof typeof STAFF_DELETE;
export function staffDeleteKind(value: string): StaffDeleteKind | null {
  return Object.hasOwn(STAFF_DELETE, value) ? value as StaffDeleteKind : null;
}

/** For the viewer's interaction data: one InitPlan per query, so the flag costs nothing per row. */
export const VIEWER_IS_STAFF = '(select exists(select 1 from "user" su join "siteAdmin" sa on lower(su.email) = sa.email where su.id = $2))';

/**
 * Deletes one item as staff and writes it to `adminAuditLog`. The role is checked inside the transaction by the
 * member's id, not taken from the caller. Returns false for a non-staff member or an item that is already gone.
 */
export async function staffDeleteContent(userId: string, kind: StaffDeleteKind, id: string): Promise<boolean> {
  if (!isContentId(id)) return false;
  const target = STAFF_DELETE[kind];
  const { table, audit } = target;
  const key = 'key' in target ? target.key : 'id';
  const db = await getPool().connect();
  try {
    await db.query('begin');
    const staff = (await db.query<{ email: string }>('select sa.email from "user" u join "siteAdmin" sa on lower(u.email) = sa.email where u.id = $1', [userId])).rows[0];
    const deleted = staff ? await db.query(`delete from ${table} where ${key} = $1 returning ${key}`, [id]) : null;
    if (!staff || !deleted?.rowCount) { await db.query('rollback'); return false; }
    await db.query('insert into "adminAuditLog" ("adminEmail", action, "targetType", "targetId") values ($1, \'delete\', $2, $3)', [staff.email, audit, id]);
    await db.query('commit');
    return true;
  } catch (error) {
    await db.query('rollback');
    throw error;
  } finally { db.release(); }
}
