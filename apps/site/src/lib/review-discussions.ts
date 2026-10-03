import { getPool } from '@/db/pool';
import { PHOTO_ID_PATTERN } from '@/lib/review-photo-limits';
import { profileTagLabel } from '@/lib/profile-achievements';
export class ReviewDiscussionError extends Error {}
export interface ReviewInteraction { likes: number; dislikes: number; comments: number; vote: number; authenticated: boolean }
export interface ReviewCommentData { id: string; text: string; createdAt: string; name: string; username: string | null; avatarId: string | null; tag: string | null; canDelete: boolean }
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
  const { rows } = await getPool().query(`select c.id,c.text,c."createdAt",u.name,u.username,
    c."userId"=$2 as "canDelete",
    (select id::text from "profileImage" where "userId"=u.id and kind='avatar') as "avatarId",
    case when u."profileTags"[1]='admin' then case when exists(select 1 from "siteAdmin" where email=lower(u.email)) then 'admin' end
      when exists(select 1 from "profileAchievement" where "userId"=u.id and key=u."profileTags"[1]) then u."profileTags"[1] end as tag
    from "reviewComment" c join "user" u on u.id=c."userId"
    where c."reviewId"=$1 and ($3::uuid is null or (c."createdAt",c.id)<(select "createdAt",id from "reviewComment" where id=$3 and "reviewId"=$1))
    order by c."createdAt" desc,c.id desc limit 21`, [id, viewer, before ?? null]);
  return { items: rows.slice(0,20).map(row => ({ ...row, createdAt: row.createdAt.toISOString(), tag: profileTagLabel(row.tag) ?? null, canDelete: Boolean(row.canDelete) }) as ReviewCommentData), hasMore: rows.length > 20 };
}
export async function addReviewComment(userId: string, id: string, input: string) {
  reviewId(id);
  const text = input.trim();
  if (!text || text.length > 1000) throw new ReviewDiscussionError('Напишите от 1 до 1000 символов.');
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const allowed = await client.query(`update "user" set "lastReviewCommentAt"=now() where id=$1 and ("lastReviewCommentAt" is null or "lastReviewCommentAt"<now()-interval '30 seconds') returning id`, [userId]);
    if (!allowed.rowCount) throw new ReviewDiscussionError('Следующий комментарий можно отправить через 30 секунд.');
    await client.query('insert into "reviewComment" ("reviewId","userId",text) values ($1,$2,$3)', [id,userId,text]);
    await client.query('commit');
  } catch(error) { await client.query('rollback'); throw error; }
  finally { client.release(); }
}
export async function deleteReviewComment(userId: string, id: string, commentId: string) {
  reviewId(id); reviewId(commentId);
  const result = await getPool().query('delete from "reviewComment" where id=$1 and "reviewId"=$2 and "userId"=$3 returning id', [commentId,id,userId]);
  if (!result.rowCount) throw new ReviewDiscussionError('Комментарий уже удалён или у вас нет доступа.');
}
