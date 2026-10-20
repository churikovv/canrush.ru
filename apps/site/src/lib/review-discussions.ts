import { getPool } from '@/db/pool';
import { commentMediaColumn, saveCommentMedia, type CommentMedia } from '@/lib/comment-media';
import type { PreparedWallMedia } from '@/lib/wall-media';
import { PHOTO_ID_PATTERN } from '@/lib/review-photo-limits';
import { profileTagLabel } from '@/lib/profile-achievements';
export class ReviewDiscussionError extends Error {}
export interface ReviewInteraction { likes: number; dislikes: number; comments: number; vote: number; authenticated: boolean }
export interface ReviewCommentData { id: string; text: string; media: CommentMedia[]; createdAt: string; editedAt: string | null; replyTo: { username: string | null; name: string } | null; name: string; username: string | null; avatarId: string | null; tag: string | null; canDelete: boolean }
export function reviewId(value: unknown): string {
  if (typeof value !== 'string' || !PHOTO_ID_PATTERN.test(value)) throw new ReviewDiscussionError('Отзыв или комментарий не найден.');
  return value;
}
export async function getReviewInteractions(ids: string[], viewer: string | null = null): Promise<Map<string, ReviewInteraction>> {
  if (!ids.length) return new Map();
  const { rows } = await getPool().query(`select r.id,
    (select count(*)::int from "reviewReaction" where "reviewId"=r.id and value=1) as likes,
    (select count(*)::int from "reviewReaction" where "reviewId"=r.id and value=-1) as dislikes,
    (select count(*)::int from "reviewComment" where "reviewId"=r.id) as comments,
    coalesce((select value from "reviewReaction" where "reviewId"=r.id and "userId"=$2),0)::int as vote
    from review r where r.id=any($1::uuid[])`, [ids, viewer]);
  return new Map(rows.map(row => [row.id, { likes: row.likes, dislikes: row.dislikes, comments: row.comments, vote: row.vote, authenticated: Boolean(viewer) }]));
}
export async function setReviewReaction(userId: string, id: string, value: number) {
  reviewId(id);
  if (![0, 1, -1].includes(value)) throw new ReviewDiscussionError('Некорректная реакция.');
  const db = getPool();
  if (value === 0) await db.query('delete from "reviewReaction" where "reviewId"=$1 and "userId"=$2', [id, userId]);
  else {
    const result = await db.query(`insert into "reviewReaction" ("reviewId","userId",value)
      select id,$2,$3 from review where id=$1 and "userId"<>$2
      on conflict ("reviewId","userId") do update set value=excluded.value returning "reviewId"`, [id, userId, value]);
    if (!result.rowCount) throw new ReviewDiscussionError('Нельзя оценивать свой отзыв, либо отзыв уже удалён.');
  }
}
export async function getReviewComments(id: string, viewer: string | null, before?: string) {
  reviewId(id); if (before) reviewId(before);
  const { rows } = await getPool().query(`select c.id,c.text,c."createdAt",c."editedAt",${commentMediaColumn('review')},u.name,u.username,ru.username as "replyToUsername",ru.name as "replyToName",
    c."userId"=$2 as "canDelete",
    (select id::text from "profileImage" where "userId"=u.id and kind='avatar') as "avatarId",
    case when u."profileTags"[1]='admin' then case when exists(select 1 from "siteAdmin" where email=lower(u.email)) then 'admin' end
      when exists(select 1 from "profileAchievement" where "userId"=u.id and key=u."profileTags"[1]) then u."profileTags"[1] end as tag
    from "reviewComment" c join "user" u on u.id=c."userId" left join "user" ru on ru.id=c."replyToUserId"
    where c."reviewId"=$1 and ($3::uuid is null or (c."createdAt",c.id)<(select "createdAt",id from "reviewComment" where id=$3 and "reviewId"=$1))
    order by c."createdAt" desc,c.id desc limit 21`, [id, viewer, before ?? null]);
  return { items: rows.slice(0,20).map(({ replyToUsername, replyToName, ...row }) => ({ ...row, createdAt: row.createdAt.toISOString(), editedAt: row.editedAt?.toISOString() ?? null, tag: profileTagLabel(row.tag) ?? null, replyTo: replyToName ? { username: replyToUsername, name: replyToName } : null, canDelete: Boolean(row.canDelete) }) as ReviewCommentData), hasMore: rows.length > 20 };
}
export async function addReviewComment(userId: string, id: string, input: string, replyToId?: string, media: readonly PreparedWallMedia[] = []) {
  if (replyToId) reviewId(replyToId);
  reviewId(id);
  const text = input.trim();
  if (!text || text.length > 1000) throw new ReviewDiscussionError('Напишите от 1 до 1000 символов.');
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const allowed = await client.query(`update "user" set "lastReviewCommentAt"=now() where id=$1 and ("lastReviewCommentAt" is null or "lastReviewCommentAt"<now()-interval '30 seconds') returning id`, [userId]);
    if (!allowed.rowCount) throw new ReviewDiscussionError('Следующий комментарий можно отправить через 30 секунд.');
    // The addressee comes from the answered comment of the same thread, never from the client.
    let replyToUserId: string | null = null;
    if (replyToId) {
      const target = await client.query<{ userId: string }>('select "userId" from "reviewComment" where id=$1 and "reviewId"=$2', [replyToId, id]);
      if (!target.rows[0]) throw new ReviewDiscussionError('Комментарий, на который вы отвечаете, удалён.');
      replyToUserId = target.rows[0].userId;
    }
    const inserted = await client.query<{ id: string }>('insert into "reviewComment" ("reviewId","userId",text,"replyToId","replyToUserId") values ($1,$2,$3,$4,$5) returning id', [id,userId,text,replyToId ?? null,replyToUserId]);
    await saveCommentMedia(client, 'review', inserted.rows[0]!.id, media);
    await client.query('commit');
  } catch(error) { await client.query('rollback'); throw error; }
  finally { client.release(); }
}
export async function deleteReviewComment(userId: string, id: string, commentId: string) {
  reviewId(id); reviewId(commentId);
  const result = await getPool().query('delete from "reviewComment" where id=$1 and "reviewId"=$2 and "userId"=$3 returning id', [commentId,id,userId]);
  if (!result.rowCount) throw new ReviewDiscussionError('Комментарий уже удалён или у вас нет доступа.');
}
export async function editReviewComment(userId: string, id: string, commentId: string, input: string) {
  reviewId(id); reviewId(commentId);
  const text = input.trim();
  if (!text || text.length > 1000) throw new ReviewDiscussionError('Напишите от 1 до 1000 символов.');
  const result = await getPool().query<{ text: string; editedAt: Date }>(`update "reviewComment" set text=$4, "editedAt"=now()
    where id=$1 and "reviewId"=$2 and "userId"=$3 returning text, "editedAt"`, [commentId, id, userId, text]);
  const row = result.rows[0];
  if (!row) throw new ReviewDiscussionError('Комментарий уже удалён или у вас нет доступа.');
  return { id: commentId, text: row.text, editedAt: row.editedAt.toISOString() };
}
