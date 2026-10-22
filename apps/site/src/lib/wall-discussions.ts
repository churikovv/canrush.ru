import { getPool } from '@/db/pool';
import { notBlockedBy } from '@/lib/member-blocks';
import { commentMediaColumn, saveCommentMedia, type CommentMedia } from '@/lib/comment-media';
import type { PreparedWallMedia } from '@/lib/wall-media';
import { PHOTO_ID_PATTERN } from '@/lib/review-photo-limits';
import { profileTagLabel } from '@/lib/profile-achievements';
export class WallDiscussionError extends Error {}
/** `saved` — the viewer bookmarked the record (savedPost). */
export interface WallInteraction { likes: number; dislikes: number; comments: number; vote: number; authenticated: boolean; saved: boolean }
export interface WallCommentData { id: string; text: string; media: CommentMedia[]; createdAt: string; editedAt: string | null; replyTo: { username: string | null; name: string } | null; name: string; username: string | null; avatarId: string | null; tag: string | null; canDelete: boolean; likes: number; liked: boolean }
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
    coalesce((select value from "wallReaction" where "wallPostId"=r.id and "userId"=$2),0)::int as vote,
    exists(select 1 from "savedPost" where "postId"=r.id and "userId"=$2) as saved
    from "profileComment" r where r.id=any($1::uuid[])`, [ids, viewer]);
  return new Map(rows.map(row => [row.id, { likes: row.likes, dislikes: row.dislikes, comments: row.comments, vote: row.vote, authenticated: Boolean(viewer), saved: Boolean(row.saved) }]));
}
/** Bookmarks a wall record for the member (own records too); `saved=false` removes the bookmark. */
export async function setWallSaved(userId: string, id: string, saved: boolean) {
  wallPostId(id);
  if (saved) await getPool().query(`insert into "savedPost" ("userId","postId") select $2,id from "profileComment" where id=$1 on conflict do nothing`, [id, userId]);
  else await getPool().query('delete from "savedPost" where "postId"=$1 and "userId"=$2', [id, userId]);
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
  const { rows } = await getPool().query(`select c.id,c.text,c."createdAt",c."editedAt",${commentMediaColumn('wall')},u.name,u.username,ru.username as "replyToUsername",ru.name as "replyToName",
    c."userId"=$2 as "canDelete",
    (select count(*)::int from "wallReplyLike" where "replyId"=c.id) as likes,
    exists(select 1 from "wallReplyLike" where "replyId"=c.id and "userId"=$2) as liked,
    (select id::text from "profileImage" where "userId"=u.id and kind='avatar') as "avatarId",
    case when u."profileTags"[1]='admin' then case when exists(select 1 from "siteAdmin" where email=lower(u.email)) then 'admin' end
      when exists(select 1 from "profileAchievement" where "userId"=u.id and key=u."profileTags"[1]) then u."profileTags"[1] end as tag
    from "wallReply" c join "user" u on u.id=c."userId" left join "user" ru on ru.id=c."replyToUserId"
    where ${notBlockedBy('$2', 'c."userId"')} and c."wallPostId"=$1 and exists(select 1 from "profileComment" where id=$1) and ($3::uuid is null or (c."createdAt",c.id)<(select "createdAt",id from "wallReply" where id=$3 and "wallPostId"=$1))
    order by c."createdAt" desc,c.id desc limit 21`, [id, viewer, before ?? null]);
  return { items: rows.slice(0,20).map(({ replyToUsername, replyToName, ...row }) => ({ ...row, createdAt: row.createdAt.toISOString(), editedAt: row.editedAt?.toISOString() ?? null, tag: profileTagLabel(row.tag) ?? null, replyTo: replyToName ? { username: replyToUsername, name: replyToName } : null, canDelete: Boolean(row.canDelete), liked: Boolean(row.liked) }) as WallCommentData), hasMore: rows.length > 20 };
}
export async function addWallComment(userId: string, id: string, input: string, replyToId?: string, media: readonly PreparedWallMedia[] = []) {
  if (replyToId) wallPostId(replyToId);
  wallPostId(id);
  const text = input.trim();
  // A comment may be just an attachment; edits still need text (they cannot change attachments).
  if (text.length > 1000) throw new WallDiscussionError('Комментарий должен быть не длиннее 1000 символов.');
  if (!text && !media.length) throw new WallDiscussionError('Напишите комментарий или прикрепите фото, GIF или видео.');
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const target = await client.query(`select id from "profileComment" where id=$1 for share`, [id]);
    if (!target.rowCount) throw new WallDiscussionError('Запись недоступна.');
    const allowed = await client.query(`update "user" set "lastWallReplyAt"=now() where id=$1 and ("lastWallReplyAt" is null or "lastWallReplyAt"<now()-interval '30 seconds') returning id`, [userId]);
    if (!allowed.rowCount) throw new WallDiscussionError('Следующий комментарий можно отправить через 30 секунд.');
    // The addressee comes from the answered comment of the same thread, never from the client.
    let replyToUserId: string | null = null;
    if (replyToId) {
      const target = await client.query<{ userId: string }>('select "userId" from "wallReply" where id=$1 and "wallPostId"=$2', [replyToId, id]);
      if (!target.rows[0]) throw new WallDiscussionError('Комментарий, на который вы отвечаете, удалён.');
      replyToUserId = target.rows[0].userId;
    }
    const inserted = await client.query<{ id: string }>('insert into "wallReply" ("wallPostId","userId",text,"replyToId","replyToUserId") values ($1,$2,$3,$4,$5) returning id', [id,userId,text,replyToId ?? null,replyToUserId]);
    await saveCommentMedia(client, 'wall', inserted.rows[0]!.id, media);
    await client.query('commit');
  } catch(error) { await client.query('rollback'); throw error; }
  finally { client.release(); }
}
export async function deleteWallComment(userId: string, id: string, commentId: string) {
  wallPostId(id); wallPostId(commentId);
  const result = await getPool().query('delete from "wallReply" where id=$1 and "wallPostId"=$2 and "userId"=$3 returning id', [commentId,id,userId]);
  if (!result.rowCount) throw new WallDiscussionError('Комментарий уже удалён или у вас нет доступа.');
}
/** Likes or unlikes a comment under a wall record; returns the fresh count. Own comments cannot be liked. */
export async function setWallCommentLike(userId: string, id: string, commentId: string, liked: boolean) {
  wallPostId(id); wallPostId(commentId);
  const db = getPool();
  if (liked) {
    const target = await db.query('select "userId" from "wallReply" where id=$1 and "wallPostId"=$2', [commentId, id]);
    if (!target.rowCount) throw new WallDiscussionError('Комментарий уже удалён.');
    if (target.rows[0].userId === userId) throw new WallDiscussionError('Нельзя лайкнуть свой комментарий.');
    await db.query('insert into "wallReplyLike" ("replyId","userId") values ($1,$2) on conflict do nothing', [commentId, userId]);
  } else await db.query('delete from "wallReplyLike" where "replyId"=$1 and "userId"=$2', [commentId, userId]);
  const { rows } = await db.query<{ likes: number; liked: boolean }>(`select (select count(*)::int from "wallReplyLike" where "replyId"=$1) as likes,
    exists(select 1 from "wallReplyLike" where "replyId"=$1 and "userId"=$2) as liked`, [commentId, userId]);
  return rows[0] ?? { likes: 0, liked: false };
}
export async function editWallComment(userId: string, id: string, commentId: string, input: string) {
  wallPostId(id); wallPostId(commentId);
  const text = input.trim();
  if (!text || text.length > 1000) throw new WallDiscussionError('Напишите от 1 до 1000 символов.');
  const result = await getPool().query<{ text: string; editedAt: Date }>(`update "wallReply" set text=$4, "editedAt"=now()
    where id=$1 and "wallPostId"=$2 and "userId"=$3 returning text, "editedAt"`, [commentId, id, userId, text]);
  const row = result.rows[0];
  if (!row) throw new WallDiscussionError('Комментарий уже удалён или у вас нет доступа.');
  return { id: commentId, text: row.text, editedAt: row.editedAt.toISOString() };
}
