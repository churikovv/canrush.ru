import type { PreparedWallMedia } from '@/lib/wall-media';
import type { WallMediaKind } from '@/lib/wall-media-limits';
import type { RankUpTier } from '@/lib/level-tier';
import { getPool } from '@/db/pool';
import { ACHIEVEMENT_METRICS, DETAILED_REVIEW_CHARS, PROFILE_ACHIEVEMENTS, eligibleAchievements, validateProfileTags, validateWallText, profilePageNumber, type AchievementProgress } from '@/lib/profile-achievements';

export const COMMUNITY_PAGE_SIZE = 20;
export type ConnectionKind = 'friends' | 'followers' | 'following';
export class CommunityError extends Error {}

export async function getProfileCommunity(userId: string, viewerId?: string) {
  const db = getPool();
  const result = await db.query<AchievementProgress & {
    following: number; isFollowing: boolean; followsYou: boolean; profileTags: string[]; showOnline: boolean;
  }>(`with r as (
      select brand, flavor, lower(brand) as b, char_length(btrim(text)) >= $3 as detailed,
        exists(select 1 from "reviewPhoto" p where p."reviewId" = review.id) as photo
      from "review" where "userId" = $1
    ), fav as (select brand, lower(brand) as b, flavor from "favorite" where "userId" = $1)
    select u."profileTags", u."showOnline",
    (select count(*)::int from "userFollow" where "userId" = u.id) as following,
    (select count(*)::int from "userFollow" where "targetId" = u.id) as followers,
    (select count(*)::int from "userFollow" f join "userFollow" b on b."userId" = f."targetId" and b."targetId" = f."userId" where f."userId" = u.id) as friends,
    exists(select 1 from "userFollow" where "userId" = $2 and "targetId" = u.id) as "isFollowing",
    exists(select 1 from "userFollow" where "targetId" = $2 and "userId" = u.id) as "followsYou",
    (select count(*)::int from "marketListing" where "sellerId" = u.id) as listings,
    (select count(*)::int from "marketOrder" o join "marketListing" l on l.id = o."listingId" where l."sellerId" = u.id and o.status = 'completed') as sales,
    (select count(*)::int from r) as reviews,
    (select count(*)::int from r where detailed) as "detailedReviews",
    (select count(*)::int from r where photo) as "photoReviews",
    (select count(distinct brand)::int from r) as brands,
    (select count(*)::int from "reviewReaction" x join "review" rv on rv.id = x."reviewId" where rv."userId" = u.id and x."userId" <> u.id and x.value = 1) as "reviewLikes",
    (select count(*)::int from r where b = 'burn') as burn,
    (select count(*)::int from r where b = 'burn' and detailed) as "burnDetailed",
    (select count(*)::int from fav where b = 'burn') as "burnFavorites",
    (select count(*)::int from r where b in ('adrenaline', 'adrenaline rush')) as adrenaline,
    (select count(*)::int from r where b in ('adrenaline', 'adrenaline rush') and detailed) as "adrenalineDetailed",
    (select count(*)::int from fav where b in ('adrenaline', 'adrenaline rush')) as "adrenalineFavorites",
    (select count(*)::int from r where b = 'monster' and split_part(flavor, ':', 1) = 'monster_ultra_white') as "whiteMonster",
    (select count(*)::int from fav where b = 'monster' and split_part(flavor, ':', 1) = 'monster_ultra_white') as "whiteMonsterFavorite",
    (select count(*)::int from r where b = 'flash up') as flash,
    (select count(*)::int from r where b = 'flash up' and detailed) as "flashDetailed",
    (case when exists(select 1 from "siteAdmin" where email = lower(u.email)) then 1 else 0 end) as admin,
    (case when u."telegramChannel" ~* '^[a-z][a-z0-9_]{4,31}$' then 1 else 0 end) as telegram,
    (select count(*)::int from fav) as favorites,
    (select count(distinct brand)::int from fav) as "favoriteBrands",
    (select count(*)::int from "tierList" where "userId" = u.id and status = 'published') as "tierLists",
    (select count(*)::int from "tierListReaction" x join "tierList" t on t.id = x."tierListId" where t."userId" = u.id and t.status = 'published' and x."userId" <> u.id and x.value = 1) as "tierListLikes",
    (select count(*)::int from "monthlyTopAward" where "userId" = u.id) as "monthlyTop",
    -- Given by an admin after the draw (contest-db.ts); the metric only reflects it, so a draw alone never grants it.
    (select count(*)::int from "profileAchievement" where "userId" = u.id and key = 'energizer') as "contestWin",
    -- Numbered on sign-up by the beta_engine_member trigger (0073), while the first 500 places last.
    (select count(*)::int from "betaEngine" where "userId" = u.id) as "betaEngine",
    (select count(*)::int from "drinkLog" where "userId" = u.id) as "drinkLogs",
    (select coalesce(max(n), 0)::int from (select count(*) as n from (select day - (row_number() over (order by day))::int as run
      from (select distinct day from "drinkLog" where "userId" = u.id) d) s group by run) t) as "drinkStreak"
    from "user" u where u.id = $1`, [userId, viewerId ?? null, DETAILED_REVIEW_CHARS]);
  const row = result.rows[0];
  if (!row) throw new CommunityError('Профиль не найден.');
  const progress = Object.fromEntries(ACHIEVEMENT_METRICS.map(metric => [metric, row[metric]])) as AchievementProgress;
  const eligible = eligibleAchievements(progress).filter(key => key !== 'admin');
  if (eligible.length) await db.query(`insert into "profileAchievement" ("userId", "key") select $1, unnest($2::text[]) on conflict do nothing`, [userId, eligible]);
  const earned = (await db.query<{ key: string }>('select "key" from "profileAchievement" where "userId" = $1', [userId])).rows.map(item => item.key).filter(key => key !== 'admin' && PROFILE_ACHIEVEMENTS.some(item => item.key === key));
  if (row.admin) earned.push('admin');
  return { following: row.following, followers: row.followers, friends: row.friends, isFollowing: row.isFollowing, followsYou: row.followsYou,
    tags: row.profileTags.filter(tag => earned.includes(tag)), showOnline: row.showOnline, progress, earned };
}
export type ProfileCommunity = Awaited<ReturnType<typeof getProfileCommunity>>;

export async function setProfileTags(userId: string, input: unknown) {
  const community = await getProfileCommunity(userId);
  const tags = validateProfileTags(input, community.earned);
  if (!tags) throw new CommunityError('Выберите один полученный тег.');
  await getPool().query('update "user" set "profileTags" = $2 where id = $1', [userId, tags]);
}

export async function setFollowing(userId: string, targetId: string, following: boolean) {
  if (!targetId || targetId.length > 200 || userId === targetId) throw new CommunityError('Нельзя подписаться на себя.');
  if (following) {
    const result = await getPool().query(`insert into "userFollow" ("userId", "targetId")
      select $1, id from "user" where id = $2 and username is not null
      on conflict do nothing returning "targetId"`, [userId, targetId]);
    if (!result.rowCount && !(await getPool().query('select 1 from "userFollow" where "userId" = $1 and "targetId" = $2', [userId, targetId])).rowCount)
      throw new CommunityError('Профиль не найден.');
    await getProfileCommunity(userId);
    await getProfileCommunity(targetId);
  } else await getPool().query('delete from "userFollow" where "userId" = $1 and "targetId" = $2', [userId, targetId]);
}

export async function getConnections(userId: string, kind: ConnectionKind, page = 1) {
  const condition = kind === 'followers' ? 'f."targetId" = $1' : 'f."userId" = $1';
  const join = kind === 'followers' ? 'f."userId"' : 'f."targetId"';
  const mutual = kind === 'friends' ? 'and exists(select 1 from "userFollow" b where b."userId" = f."targetId" and b."targetId" = f."userId")' : '';
  const from = `from "userFollow" f join "user" u on u.id = ${join} where ${condition} ${mutual} and u.username is not null`;
  const [count, data] = await Promise.all([
    getPool().query<{ count: number }>(`select count(*)::int as count ${from}`, [userId]),
    getPool().query<{ username: string; name: string; avatarId: string | null }>(`select u.username, u.name, (select id::text from "profileImage" where "userId" = u.id and kind = 'avatar') as "avatarId" ${from} order by f."createdAt" desc, u.id limit $2 offset $3`, [userId, COMMUNITY_PAGE_SIZE, (profilePageNumber(page) - 1) * COMMUNITY_PAGE_SIZE]),
  ]);
  return { count: count.rows[0]?.count ?? 0, users: data.rows };
}

export async function getProfileRatings(userId: string) {
  const [summary, buckets] = await Promise.all([
    getPool().query<{ count: number; design: number; taste: number; overall: number }>(`select count(*)::int as count,
      coalesce(avg(design), 0)::float8 as design, coalesce(avg(taste), 0)::float8 as taste,
      coalesce(avg((design + taste)::float8 / 2), 0)::float8 as overall from review where "userId" = $1`, [userId]),
    getPool().query<{ score: number; count: number }>(`select round((design + taste)::numeric / 2)::int as score, count(*)::int as count
      from review where "userId" = $1 group by score`, [userId]),
  ]);
  return { ...summary.rows[0]!, histogram: [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(score => ({ score, count: buckets.rows.find(row => row.score === score)?.count ?? 0 })) };
}
export type ProfileRatings = Awaited<ReturnType<typeof getProfileRatings>>;

export interface WallPostRow { id: string; profileId: string; userId: string; text: string; createdAt: Date; editedAt: Date | null; username: string | null; name: string; avatarId: string | null; tag: string | null; xp: number; photos: string[]; mediaKinds: WallMediaKind[] }
export interface FeedPostRow extends WallPostRow { ownerUsername: string | null; ownerName: string; ownerAvatarId: string | null }
export type FeedScope = 'all' | 'following';

export interface RankUpRow { id: string; userId: string; tier: RankUpTier; degree: number; createdAt: Date; username: string; name: string; avatarId: string | null; tag: string | null; xp: number }
/** A feed entry: a wall record or the moment a member reached a high level tier (migration 0079). */
export type FeedItem = { kind: 'post'; post: FeedPostRow } | { kind: 'rank-up'; rankUp: RankUpRow };

// The author `u` as every timeline row shows them: avatar, XP and the selected tag.
const AUTHOR_COLUMNS = `u.username, u.name,
      (select id::text from "profileImage" where "userId"=u.id and kind='avatar') as "avatarId",
      coalesce((select xp from "profileRanking" where id=u.id),0) as xp,
      case when u."profileTags"[1]='admin' then case when exists(select 1 from "siteAdmin" where email=lower(u.email)) then 'admin' end
      when exists(select 1 from "profileAchievement" where "userId"=u.id and key=u."profileTags"[1]) then u."profileTags"[1] end as tag`;
// One record serves both the wall it was written on and the feed, so both views select the same columns.
const WALL_POST_COLUMNS = `c.id, c."profileId", c."userId", c.text, c."createdAt", c."editedAt", coalesce((select array_agg(p.id::text order by p.position) from "wallPhoto" p where p."commentId"=c.id), '{}'::text[]) as photos, coalesce((select array_agg(p.kind order by p.position) from "wallPhoto" p where p."commentId"=c.id), '{}'::text[]) as "mediaKinds", ${AUTHOR_COLUMNS}`;

export async function getProfileWall(profileId: string, page = 1) {
  const [count, comments] = await Promise.all([
    getPool().query<{ count: number }>('select count(*)::int as count from "profileComment" where "profileId" = $1', [profileId]),
    getPool().query<WallPostRow>(`select ${WALL_POST_COLUMNS}
      from "profileComment" c join "user" u on u.id = c."userId" where c."profileId" = $1 order by c."createdAt" desc, c.id desc limit $2 offset $3`,
    [profileId, COMMUNITY_PAGE_SIZE, (profilePageNumber(page) - 1) * COMMUNITY_PAGE_SIZE]),
  ]);
  return { count: count.rows[0]?.count ?? 0, comments: comments.rows };
}

/**
 * All walls merged into one timeline, together with members reaching a high level tier. `following` keeps the
 * viewer's own entries and those written by, on the walls of, or about people the viewer follows.
 */
export async function getFeed(viewerId: string | null, scope: FeedScope = 'all', page = 1) {
  const following = scope === 'following' && viewerId !== null;
  const { rows: entries } = await getPool().query<{ id: string; kind: FeedItem['kind']; total: number }>(`select id, kind, count(*) over()::int as total from (
        select c.id::text, 'post' as kind, c."createdAt" from "profileComment" c
        where not $1::boolean or c."userId" = $2 or c."profileId" = $2
          or exists(select 1 from "userFollow" f where f."userId" = $2 and f."targetId" in (c."userId", c."profileId"))
        union all
        select r.id::text, 'rank-up', r."createdAt" from "rankUp" r join "user" u on u.id = r."userId"
        where u.username is not null and not exists(select 1 from "userBlock" b where b."userId" = u.id)
          and (not $1::boolean or r."userId" = $2 or exists(select 1 from "userFollow" f where f."userId" = $2 and f."targetId" = r."userId"))
      ) entry order by "createdAt" desc, id desc limit $3 offset $4`,
  [following, viewerId, COMMUNITY_PAGE_SIZE, (profilePageNumber(page) - 1) * COMMUNITY_PAGE_SIZE]);
  const total = entries[0]?.total ?? 0;
  const idsOf = (kind: FeedItem['kind']) => entries.filter(entry => entry.kind === kind).map(entry => entry.id);
  const [posts, rankUps] = await Promise.all([
    getPool().query<FeedPostRow>(`select ${WALL_POST_COLUMNS}, o.username as "ownerUsername", o.name as "ownerName",
      (select id::text from "profileImage" where "userId"=o.id and kind='avatar') as "ownerAvatarId"
      from "profileComment" c join "user" u on u.id = c."userId" join "user" o on o.id = c."profileId" where c.id = any($1::uuid[])`, [idsOf('post')]),
    getPool().query<RankUpRow>(`select r.id, r."userId", r.tier, r.degree, r."createdAt", ${AUTHOR_COLUMNS}
      from "rankUp" r join "user" u on u.id = r."userId" where r.id = any($1::uuid[])`, [idsOf('rank-up')]),
  ]);
  const postById = new Map(posts.rows.map(post => [post.id, post]));
  const rankUpById = new Map(rankUps.rows.map(rankUp => [rankUp.id, rankUp]));
  const items = entries.flatMap((entry): FeedItem[] => {
    const post = entry.kind === 'post' ? postById.get(entry.id) : undefined;
    if (post) return [{ kind: 'post', post }];
    const rankUp = entry.kind === 'rank-up' ? rankUpById.get(entry.id) : undefined;
    return rankUp ? [{ kind: 'rank-up', rankUp }] : [];
  });
  const pages = Math.ceil(total / COMMUNITY_PAGE_SIZE);
  return { items, posts: items.flatMap(item => item.kind === 'post' ? [item.post] : []), pages, hasMore: profilePageNumber(page) < pages };
}

export async function addProfileComment(userId: string, profileId: string, input: unknown, photos: PreparedWallMedia[] = []) {
  if (photos.length > 5) throw new CommunityError('Можно добавить не более 5 вложений.');
  // A record may be just attachments; then its text is empty.
  const text = typeof input === 'string' && !input.trim() && photos.length ? '' : validateWallText(input);
  if (text === null) throw new CommunityError(photos.length ? 'Запись должна быть не длиннее 1000 символов.' : 'Напишите запись или прикрепите фото, GIF или видео.');
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const allowed = await client.query(`update "user" set "lastWallPostAt" = now() where id = $1 and ("lastWallPostAt" is null or "lastWallPostAt" < now() - interval '30 seconds') returning id`, [userId]);
    if (!allowed.rowCount) throw new CommunityError('Следующий комментарий можно отправить через 30 секунд.');
    const result = await client.query<{ id: string }>('insert into "profileComment" ("profileId", "userId", text) values ($1, $2, $3) returning id', [profileId, userId, text]);
    for (const [position, photo] of photos.entries()) {
      await client.query('insert into "wallPhoto" ("commentId", position, kind, mime, data, thumbnail) values ($1, $2, $3, $4, $5, $6)', [result.rows[0]!.id, position, photo.kind, photo.mime, photo.data, photo.thumbnail]);
    }
    await client.query('commit');
    return result.rows[0]!.id;
  } catch (error) { await client.query('rollback'); throw error; }
  finally { client.release(); }
}

/** Only the author edits a wall record (the wall owner may delete it, not rewrite it). Photos stay as they are. */
export async function editProfileComment(userId: string, commentId: string, input: unknown) {
  if (!/^[0-9a-f-]{36}$/i.test(commentId)) throw new CommunityError('Запись не найдена.');
  const text = validateWallText(input);
  if (!text) throw new CommunityError('Напишите от 1 до 1000 символов.');
  const result = await getPool().query<{ text: string; editedAt: Date }>('update "profileComment" set text = $3, "editedAt" = now() where id = $1 and "userId" = $2 returning text, "editedAt"', [commentId, userId, text]);
  const row = result.rows[0];
  if (!row) throw new CommunityError('Нет доступа к этой записи.');
  return { text: row.text, editedAt: row.editedAt.toISOString() };
}

export async function deleteProfileComment(userId: string, commentId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(commentId)) throw new CommunityError('Комментарий не найден.');
  // A wall owner or the author can remove a comment. An unrelated user cannot.
  const result = await getPool().query('delete from "profileComment" where id = $1 and ("userId" = $2 or "profileId" = $2) returning "profileId"', [commentId, userId]);
  if (!result.rowCount) throw new CommunityError('Нет доступа к этому комментарию.');
}

export async function touchPresence(userId: string) {
  // The same heartbeat marks the member in the current 5-minute window of the admin online chart and,
  // even with a hidden status, in today's row of the admin activity totals.
  await getPool().query(`with active as (
      insert into "activityDay" (day, "userId") values ((now() at time zone 'Europe/Moscow')::date, $1) on conflict do nothing
    ), seen as (
      update "user" set "lastSeenAt" = now() where id = $1 and "showOnline" and ("lastSeenAt" is null or "lastSeenAt" < now() - interval '30 seconds') returning id
    ) insert into "presenceSample" (bucket, "userId") select date_bin('5 minutes', now(), timestamptz '2000-01-01'), id from seen on conflict do nothing`, [userId]);
}
export async function getPresence(userId: string): Promise<'online' | 'offline' | 'hidden'> {
  const result = await getPool().query<{ status: 'online' | 'offline' | 'hidden' }>(`select case when not "showOnline" then 'hidden'
    when "lastSeenAt" > now() - interval '2 minutes' and exists(select 1 from session s where s."userId" = u.id and s."expiresAt" > now()) then 'online'
    else 'offline' end as status from "user" u where id = $1`, [userId]);
  return result.rows[0]?.status ?? 'hidden';
}
/** Last heartbeat for the profile chip, only while the member shows their status (hiding it also clears the time). */
export async function getLastSeen(userId: string): Promise<string | null> {
  const result = await getPool().query<{ lastSeenAt: Date | null }>('select "lastSeenAt" from "user" where id = $1 and "showOnline"', [userId]);
  return result.rows[0]?.lastSeenAt?.toISOString() ?? null;
}
export async function setPresenceVisibility(userId: string, visible: boolean) {
  await getPool().query('update "user" set "showOnline" = $2, "lastSeenAt" = null where id = $1', [userId, visible]);
}
