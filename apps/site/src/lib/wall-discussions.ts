import { getPool } from '@/db/pool';
import { PHOTO_ID_PATTERN } from '@/lib/review-photo-limits';
import { profileTagLabel } from '@/lib/profile-achievements';
export class WallDiscussionError extends Error {}
export interface WallInteraction { likes: number; dislikes: number; comments: number; vote: number; authenticated: boolean }
export interface WallCommentData { id: string; text: string; createdAt: string; name: string; username: string | null; avatarId: string | null; tag: string | null; canDelete: boolean }
export function wallPostId(value: unknown): string {
  if (typeof value !== 'string' || !PHOTO_ID_PATTERN.test(value)) throw new WallDiscussionError('Запись или комментарий не найден.');
  return value;
}
export async function getWallInteractions(ids: string[], viewer: string | null = null): Promise<Map<string, WallInteraction>> {
  if (!ids.length) return new Map();
  const { rows } = await getPool().query(`select r.id,
    (select count(*)::int from "wallReaction" where "wallPostId"=r.id and value=1) as likes,
    (select count(*)::int from "wallReaction" where "wallPostId"=r.id and value=-1) as dislikes,
    (select count(*)::int from "wallReply" where "wallPostId"=r.id) as comments,
    coalesce((select value from "wallReaction" where "wallPostId"=r.id and "userId"=$2),0)::int as vote
    from "profileComment" r where r.id=any($1::uuid[])`, [ids, viewer]);
  return new Map(rows.map(row => [row.id, { likes: row.likes, dislikes: row.dislikes, comments: row.comments, vote: row.vote, authenticated: Boolean(viewer) }]));
}
export async function setWallReaction(userId: string, id: string, value: number) {
  wallPostId(id);
  if (![0, 1, -1].includes(value)) throw new WallDiscussionError('Некорректная реакция.');
  const db = getPool();
  if (value === 0) await db.query('delete from "wallReaction" where "wallPostId"=$1 and "userId"=$2', [id, userId]);
  else {
    const result = await db.query(`insert into "wallReaction" ("wallPostId","userId",value)
      select id,$2,$3 from "profileComment" where id=$1 and "userId"<>$2
      on conflict ("wallPostId","userId") do update set value=excluded.value returning "wallPostId"`, [id, userId, value]);
    if (!result.rowCount) throw new WallDiscussionError('Нельзя оценивать свою запись, либо запись недоступна.');
  }
}
export async function getWallComments(id: string, viewer: string | null, before?: string) {
  wallPostId(id); if (before) wallPostId(before);
  const { rows } = await getPool().query(`select c.id,c.text,c."createdAt",u.name,u.username,
    c."userId"=$2 as "canDelete",
    (select id::text from "profileImage" where "userId"=u.id and kind='avatar') as "avatarId",
    case when u."profileTags"[1]='admin' then case when exists(select 1 from "siteAdmin" where email=lower(u.email)) then 'admin' end
      when exists(select 1 from "profileAchievement" where "userId"=u.id and key=u."profileTags"[1]) then u."profileTags"[1] end as tag
    from "wallReply" c join "user" u on u.id=c."userId"
    where c."wallPostId"=$1 and exists(select 1 from "profileComment" where id=$1) and ($3::uuid is null or (c."createdAt",c.id)<(select "createdAt",id from "wallReply" where id=$3 and "wallPostId"=$1))
    order by c."createdAt" desc,c.id desc limit 21`, [id, viewer, before ?? null]);
  return { items: rows.slice(0,20).map(row => ({ ...row, createdAt: row.createdAt.toISOString(), tag: profileTagLabel(row.tag) ?? null, canDelete: Boolean(row.canDelete) }) as WallCommentData), hasMore: rows.length > 20 };
}
export async function addWallComment(userId: string, id: string, input: string) {
  wallPostId(id);
  const text = input.trim();
  if (!text || text.length > 1000) throw new WallDiscussionError('Напишите от 1 до 1000 символов.');
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const target = await client.query(`select id from "profileComment" where id=$1 for share`, [id]);
    if (!target.rowCount) throw new WallDiscussionError('Запись недоступна.');
    const allowed = await client.query(`update "user" set "lastWallReplyAt"=now() where id=$1 and ("lastWallReplyAt" is null or "lastWallReplyAt"<now()-interval '30 seconds') returning id`, [userId]);
    if (!allowed.rowCount) throw new WallDiscussionError('Следующий комментарий можно отправить через 30 секунд.');
    await client.query('insert into "wallReply" ("wallPostId","userId",text) values ($1,$2,$3)', [id,userId,text]);
    await client.query('commit');
  } catch(error) { await client.query('rollback'); throw error; }
  finally { client.release(); }
}
export async function deleteWallComment(userId: string, id: string, commentId: string) {
  wallPostId(id); wallPostId(commentId);
  const result = await getPool().query('delete from "wallReply" where id=$1 and "wallPostId"=$2 and "userId"=$3 returning id', [commentId,id,userId]);
  if (!result.rowCount) throw new WallDiscussionError('Комментарий уже удалён или у вас нет доступа.');
}
