import { getPool } from '@/db/pool';
import { notBlockedBy } from '@/lib/member-blocks';
import { MAX_STORIES_PER_DAY, MAX_STORY_CAPTION, STORY_HOURS } from '@/lib/story-limits';
import type { PreparedWallMedia } from '@/lib/wall-media';
import type { WallMediaKind } from '@/lib/wall-media-limits';


export class StoryError extends Error {}

/** `likes` and `liked` — hearts from members; `views` is told only to the author (0 for everyone else). */
export interface StoryItem { id: string; kind: WallMediaKind; caption: string; createdAt: string; seen: boolean; likes: number; liked: boolean; views: number }
export interface StoryLiker { username: string; name: string; avatarId: string | null }
export interface StoryAuthor { id: string; username: string; name: string; avatarId: string | null }
export interface StoryGroup { author: StoryAuthor; stories: StoryItem[]; own: boolean; seen: boolean }

const ACTIVE = `s."createdAt" > now() - interval '${STORY_HOURS} hours'`;

/** One story: exactly one photo, GIF or video (prepared by prepareWallMedia) and an optional caption. */
export async function publishStory(userId: string, caption: string, media: PreparedWallMedia[]): Promise<string> {
  const text = caption.replace(/\s+/gu, ' ').trim();
  if (media.length !== 1) throw new StoryError('Добавьте одно фото, GIF или видео.');
  if (text.length > MAX_STORY_CAPTION) throw new StoryError(`Подпись — до ${MAX_STORY_CAPTION} символов.`);
  const item = media[0]!;
  const client = await getPool().connect();
  try {
    await client.query('begin');
    // Serialize publishing per author so parallel requests cannot pass the daily limit.
    const author = (await client.query<{ username: string | null; blocked: boolean }>(
      `select username, exists(select 1 from "userBlock" where "userId" = u.id) as blocked from "user" u where id = $1 for no key update`, [userId])).rows[0];
    if (!author || author.blocked) throw new StoryError('Ваш аккаунт заблокирован для публикаций.');
    if (!author.username) throw new StoryError('Выберите ник в настройках профиля, чтобы публиковать истории.');
    const count = (await client.query<{ count: number }>(`select count(*)::int as count from "story" s where "userId" = $1 and ${ACTIVE}`, [userId])).rows[0]!.count;
    if (count >= MAX_STORIES_PER_DAY) throw new StoryError(`Не больше ${MAX_STORIES_PER_DAY} историй за ${STORY_HOURS} часа.`);
    const { rows } = await client.query<{ id: string }>(
      `insert into "story"("userId", kind, mime, data, thumbnail, caption) values($1, $2, $3, $4, $5, $6) returning id`,
      [userId, item.kind, item.mime, item.data, item.thumbnail, text]);
    await client.query(`delete from "story" where "createdAt" < now() - interval '7 days'`);
    await client.query('commit');
    return rows[0]!.id;
  } catch (error) { await client.query('rollback'); throw error; }
  finally { client.release(); }
}

export async function deleteStory(userId: string, id: string): Promise<void> {
  const result = await getPool().query('delete from "story" where id = $1 and "userId" = $2', [id, userId]);
  if (!result.rowCount) throw new StoryError('История не найдена.');
}

/** Marks other people's active stories as seen; own stories and unknown ids are ignored. */
export async function markStoriesViewed(userId: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  await getPool().query(`insert into "storyView"("storyId", "userId")
    select s.id, $1 from "story" s where s.id = any($2::uuid[]) and s."userId" <> $1 and ${ACTIVE}
    on conflict do nothing`, [userId, ids.slice(0, 50)]);
}

/**
 * Active stories grouped by author: the viewer's own first, then people they follow, then everyone else;
 * unseen groups before seen ones, newest first. Blocked accounts and authors the viewer blocked are left out.
 */
export async function getStoryGroups(viewerId: string | null): Promise<StoryGroup[]> {
  const { rows } = await getPool().query<{ id: string; kind: WallMediaKind; caption: string; createdAt: Date; seen: boolean; userId: string; username: string; name: string; avatarId: string | null; followed: boolean; likes: number; liked: boolean; views: number }>(`
    select s.id, s.kind, s.caption, s."createdAt", s."userId", u.username, u.name,
      (select count(*)::int from "storyLike" l where l."storyId" = s.id) as likes,
      ($1::text is not null and exists(select 1 from "storyLike" l where l."storyId" = s.id and l."userId" = $1)) as liked,
      case when s."userId" = $1 then (select count(*)::int from "storyView" v where v."storyId" = s.id) else 0 end as views,
      (select id::text from "profileImage" where "userId" = u.id and kind = 'avatar') as "avatarId",
      ($1::text is not null and exists(select 1 from "storyView" v where v."storyId" = s.id and v."userId" = $1)) as seen,
      ($1::text is not null and exists(select 1 from "userFollow" f where f."userId" = $1 and f."targetId" = s."userId")) as followed
    from "story" s join "user" u on u.id = s."userId"
    where ${ACTIVE} and u.username is not null and not exists(select 1 from "userBlock" b where b."userId" = u.id)
      and ($1::text is null or ${notBlockedBy('$1::text', 's."userId"')})
    order by s."createdAt" asc`, [viewerId]);
  const groups = new Map<string, StoryGroup & { followed: boolean; latest: number }>();
  for (const row of rows) {
    const own = row.userId === viewerId;
    const group = groups.get(row.userId) ?? { author: { id: row.userId, username: row.username, name: row.name, avatarId: row.avatarId }, stories: [], own, seen: true, followed: row.followed, latest: 0 };
    group.stories.push({ id: row.id, kind: row.kind, caption: row.caption, createdAt: row.createdAt.toISOString(), seen: own || row.seen, likes: row.likes, liked: row.liked, views: row.views });
    group.seen &&= own || row.seen;
    group.latest = row.createdAt.getTime();
    groups.set(row.userId, group);
  }
  return [...groups.values()]
    .sort((a, b) => Number(b.own) - Number(a.own) || Number(a.seen) - Number(b.seen) || Number(b.followed) - Number(a.followed) || b.latest - a.latest)
    .map(({ followed: _followed, latest: _latest, ...group }) => group);
}

/**
 * Likes or unlikes someone else's active story and returns its new count. Not one's own story, not for blocked
 * accounts, and not between members where either blocked the other.
 */
export async function setStoryLike(userId: string, id: string, like: boolean): Promise<number> {
  const db = getPool();
  const allowed = `s.id = $1 and ${ACTIVE} and s."userId" <> $2
    and not exists(select 1 from "userBlock" b where b."userId" in ($2, s."userId"))
    and not exists(select 1 from "memberBlock" mb where (mb."blockerId", mb."blockedId") in ((s."userId", $2), ($2, s."userId")))`;
  const story = await db.query(`select 1 from "story" s where ${allowed}`, [id, userId]);
  if (!story.rowCount) throw new StoryError('История недоступна.');
  if (like) await db.query('insert into "storyLike"("storyId", "userId") values ($1, $2) on conflict do nothing', [id, userId]);
  else await db.query('delete from "storyLike" where "storyId" = $1 and "userId" = $2', [id, userId]);
  const { rows } = await db.query<{ likes: number }>('select count(*)::int as likes from "storyLike" where "storyId" = $1', [id]);
  return rows[0]?.likes ?? 0;
}

/** Who liked a story, newest first — only for its author. */
export async function getStoryLikers(userId: string, id: string): Promise<StoryLiker[]> {
  const { rows } = await getPool().query<StoryLiker>(`select u.username, u.name, (select id::text from "profileImage" where "userId" = u.id and kind = 'avatar') as "avatarId"
    from "storyLike" l join "story" s on s.id = l."storyId" join "user" u on u.id = l."userId"
    where l."storyId" = $1 and s."userId" = $2 and u.username is not null and not exists(select 1 from "userBlock" b where b."userId" = u.id)
    order by l."createdAt" desc limit 100`, [id, userId]);
  return rows;
}

/** Whether /api/story-media may serve this story: it is still active and its author is not blocked. */
export async function isStoryVisible(id: string): Promise<boolean> {
  const { rowCount } = await getPool().query(`select 1 from "story" s where s.id = $1 and ${ACTIVE}
    and not exists(select 1 from "userBlock" b where b."userId" = s."userId")`, [id]);
  return Boolean(rowCount);
}
