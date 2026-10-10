import { getPool } from '@/db/pool';
import { PHOTO_ID_PATTERN } from '@/lib/review-photo-limits';
import { profileTagLabel } from '@/lib/profile-achievements';
export class TierDiscussionError extends Error {}
export interface TierInteraction { likes: number; dislikes: number; comments: number; vote: number; authenticated: boolean }
export interface TierCommentData { id: string; text: string; createdAt: string; name: string; username: string | null; avatarId: string | null; tag: string | null; canDelete: boolean }
export function tierListId(value: unknown): string {
  if (typeof value !== 'string' || !PHOTO_ID_PATTERN.test(value)) throw new TierDiscussionError('Тирлист или комментарий не найден.');
  return value;
}
export async function getTierInteractions(ids: string[], viewer: string | null = null): Promise<Map<string, TierInteraction>> {
  if (!ids.length) return new Map();
  const { rows } = await getPool().query(`select r.id,
    (select count(*)::int from "tierListReaction" where "tierListId"=r.id and value=1) as likes,
    (select count(*)::int from "tierListReaction" where "tierListId"=r.id and value=-1) as dislikes,
    (select count(*)::int from "tierListComment" where "tierListId"=r.id) as comments,
    coalesce((select value from "tierListReaction" where "tierListId"=r.id and "userId"=$2),0)::int as vote
    from "tierList" r where r.status='published' and r.id=any($1::uuid[])`, [ids, viewer]);
  return new Map(rows.map(row => [row.id, { likes: row.likes, dislikes: row.dislikes, comments: row.comments, vote: row.vote, authenticated: Boolean(viewer) }]));
}
export async function setTierReaction(userId: string, id: string, value: number) {
  tierListId(id);
  if (![0, 1, -1].includes(value)) throw new TierDiscussionError('Некорректная реакция.');
  const db = getPool();
  if (value === 0) await db.query('delete from "tierListReaction" where "tierListId"=$1 and "userId"=$2', [id, userId]);
  else {
    const result = await db.query(`insert into "tierListReaction" ("tierListId","userId",value)
      select id,$2,$3 from "tierList" where id=$1 and status='published' and "userId"<>$2
      on conflict ("tierListId","userId") do update set value=excluded.value returning "tierListId"`, [id, userId, value]);
    if (!result.rowCount) throw new TierDiscussionError('Нельзя оценивать свой тирлист, либо тирлист недоступен.');
  }
}
export async function getTierComments(id: string, viewer: string | null, before?: string) {
  tierListId(id); if (before) tierListId(before);
  const { rows } = await getPool().query(`select c.id,c.text,c."createdAt",u.name,u.username,
    c."userId"=$2 as "canDelete",
    (select id::text from "profileImage" where "userId"=u.id and kind='avatar') as "avatarId",
    case when u."profileTags"[1]='admin' then case when exists(select 1 from "siteAdmin" where email=lower(u.email)) then 'admin' end
      when exists(select 1 from "profileAchievement" where "userId"=u.id and key=u."profileTags"[1]) then u."profileTags"[1] end as tag
    from "tierListComment" c join "user" u on u.id=c."userId"
    where c."tierListId"=$1 and exists(select 1 from "tierList" where id=$1 and status='published') and ($3::uuid is null or (c."createdAt",c.id)<(select "createdAt",id from "tierListComment" where id=$3 and "tierListId"=$1))
    order by c."createdAt" desc,c.id desc limit 21`, [id, viewer, before ?? null]);
  return { items: rows.slice(0,20).map(row => ({ ...row, createdAt: row.createdAt.toISOString(), tag: profileTagLabel(row.tag) ?? null, canDelete: Boolean(row.canDelete) }) as TierCommentData), hasMore: rows.length > 20 };
}
export async function addTierComment(userId: string, id: string, input: string) {
  tierListId(id);
  const text = input.trim();
  if (!text || text.length > 1000) throw new TierDiscussionError('Напишите от 1 до 1000 символов.');
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const target = await client.query(`select id from "tierList" where id=$1 and status='published' for share`, [id]);
    if (!target.rowCount) throw new TierDiscussionError('Тирлист недоступен.');
    const allowed = await client.query(`update "user" set "lastTierCommentAt"=now() where id=$1 and ("lastTierCommentAt" is null or "lastTierCommentAt"<now()-interval '30 seconds') returning id`, [userId]);
    if (!allowed.rowCount) throw new TierDiscussionError('Следующий комментарий можно отправить через 30 секунд.');
    await client.query('insert into "tierListComment" ("tierListId","userId",text) values ($1,$2,$3)', [id,userId,text]);
    await client.query('commit');
  } catch(error) { await client.query('rollback'); throw error; }
  finally { client.release(); }
}
export async function deleteTierComment(userId: string, id: string, commentId: string) {
  tierListId(id); tierListId(commentId);
  const result = await getPool().query('delete from "tierListComment" where id=$1 and "tierListId"=$2 and "userId"=$3 returning id', [commentId,id,userId]);
  if (!result.rowCount) throw new TierDiscussionError('Комментарий уже удалён или у вас нет доступа.');
}
