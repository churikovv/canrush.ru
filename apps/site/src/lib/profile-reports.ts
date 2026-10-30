import type { PoolClient } from 'pg';
import { getPool } from '@/db/pool';
import { contentReportKind, isContentId, reportPagePath, reportReason, type ContentReportKind } from './profile-report-fields';

export type ReportResult = 'sent' | 'duplicate' | 'limited' | 'invalid';
const DAILY_LIMIT = 10;
const EXCERPT_LENGTH = 300;

/**
 * Author and text of reported content, or null when it is gone or not visible to the reporter.
 * A market message is private, so only a participant of its order may report it.
 */
const CONTENT_SOURCES: Record<ContentReportKind, string> = {
  review: 'select "userId" as author, text as excerpt from review where id=$1',
  'review-comment': 'select "userId" as author, text as excerpt from "reviewComment" where id=$1',
  'tier-list': 'select "userId" as author, title as excerpt from "tierList" where id=$1',
  'tier-comment': 'select "userId" as author, text as excerpt from "tierListComment" where id=$1',
  'wall-post': 'select "userId" as author, text as excerpt from "profileComment" where id=$1',
  'wall-reply': 'select "userId" as author, text as excerpt from "wallReply" where id=$1',
  'market-listing': 'select "sellerId" as author, title || E\'\\n\' || description as excerpt from "marketListing" where id=$1',
  'market-message': `select m."senderId" as author, m.text as excerpt from "marketMessage" m
    join "marketOrder" o on o.id=m."orderId" join "marketListing" l on l.id=o."listingId"
    where m.id=$1 and $2 in (o."buyerId", l."sellerId")`,
  store: 'select "ownerId" as author, name || E\'\\n\' || description as excerpt from "marketStore" where id=$1',
  story: 'select "userId" as author, case when caption = \'\' then \'История без подписи\' else caption end as excerpt from "story" where id=$1',
  article: 'select "authorId" as author, case when title = \'\' then \'Статья без названия\' else title end as excerpt from article where id=$1 and status = \'published\'',
  // The author may have left; the company's owner answers for its wall then.
  'business-post': 'select coalesce(p."authorId", b."ownerId") as author, case when p.text = \'\' then p."fileName" else p.text end as excerpt from "businessPost" p join business b on b.id = p."businessId" where p.id=$1',
  'business-award': 'select coalesce(a."authorId", b."ownerId") as author, a.title as excerpt from "businessAward" a join business b on b.id = a."businessId" where a.id=$1',
};

async function submit(
  userId: string,
  findTarget: (client: PoolClient) => Promise<{ targetId: string; excerpt: string } | null>,
  details: { reason: string; comment: string; contentKind: ContentReportKind | null; contentId: string | null; pagePath: string | null },
): Promise<ReportResult> {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    // Serialize submissions per reporter so simultaneous requests cannot bypass the limit.
    const actor = await client.query('select id from "user" where id=$1 for no key update', [userId]);
    const target = actor.rowCount ? await findTarget(client) : null;
    if (!target || target.targetId === userId) { await client.query('rollback'); return 'invalid'; }
    const open = await client.query('select 1 from "profileReport" where "userId"=$1 and "targetId"=$2 and coalesce("contentId"::text,\'\')=$3 and status=\'open\'', [userId, target.targetId, details.contentId ?? '']);
    if (open.rowCount) { await client.query('rollback'); return 'duplicate'; }
    const count = await client.query<{ count: number }>('select count(*)::int as count from "profileReport" where "userId"=$1 and "createdAt">now()-interval \'24 hours\'', [userId]);
    if ((count.rows[0]?.count ?? 0) >= DAILY_LIMIT) { await client.query('rollback'); return 'limited'; }
    await client.query(
      'insert into "profileReport" ("userId","targetId",reason,comment,"contentKind","contentId",excerpt,"pagePath") values ($1,$2,$3,$4,$5,$6,$7,$8)',
      [userId, target.targetId, details.reason, details.comment.trim(), details.contentKind, details.contentId, target.excerpt.trim().slice(0, EXCERPT_LENGTH), details.pagePath],
    );
    await client.query('commit'); return 'sent';
  } catch (error) { await client.query('rollback'); throw error; }
  finally { client.release(); }
}

export async function createProfileReport(userId: string, targetId: string, reason: string, comment: string): Promise<ReportResult> {
  if (!targetId || targetId.length > 160 || userId === targetId || !reportReason(reason) || comment.length > 1000) return 'invalid';
  return submit(userId, async client => (await client.query('select id from "user" where id=$1', [targetId])).rowCount ? { targetId, excerpt: '' } : null,
    { reason, comment, contentKind: null, contentId: null, pagePath: null });
}

/** Who wrote the content and whether the viewer already blocked them — for «Заблокировать» after a report. */
export async function findContentAuthor(viewerId: string, kind: string, contentId: string): Promise<{ id: string; name: string; blocked: boolean } | null> {
  const contentKind = contentReportKind(kind);
  if (!contentKind || !isContentId(contentId)) return null;
  const pool = getPool();
  const row = (await pool.query<{ author: string }>(CONTENT_SOURCES[contentKind], contentKind === 'market-message' ? [contentId, viewerId] : [contentId])).rows[0];
  if (!row || row.author === viewerId) return null;
  const { rows } = await pool.query<{ id: string; name: string; blocked: boolean }>(`select u.id,
    case when u.username is not null then '@' || u.username when trim(u.name) <> '' and u.name not like '%@%' then u.name else 'участника' end as name,
    exists(select 1 from "memberBlock" where "blockerId" = $2 and "blockedId" = u.id) as blocked
    from "user" u where u.id = $1`, [row.author, viewerId]);
  return rows[0] ?? null;
}

/** A report on one review, comment, post, listing, message or store; the queue and limits are shared with profile reports. */
export async function createContentReport(userId: string, kind: string, contentId: string, reason: string, comment: string, pagePath = ''): Promise<ReportResult> {
  const contentKind = contentReportKind(kind);
  if (!contentKind || !isContentId(contentId) || !reportReason(reason) || comment.length > 1000) return 'invalid';
  return submit(userId, async client => {
    const row = (await client.query<{ author: string; excerpt: string }>(CONTENT_SOURCES[contentKind], contentKind === 'market-message' ? [contentId, userId] : [contentId])).rows[0];
    return row ? { targetId: row.author, excerpt: row.excerpt } : null;
  }, { reason, comment, contentKind, contentId, pagePath: reportPagePath(pagePath) });
}
