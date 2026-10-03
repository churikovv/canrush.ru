import type { PreparedReviewPhoto } from '@/lib/review-photos';
import { getPool } from '@/db/pool';
import { PROFILE_ACHIEVEMENTS, eligibleAchievements, validateProfileTags, validateWallText, profilePageNumber, type AchievementProgress } from '@/lib/profile-achievements';

export const COMMUNITY_PAGE_SIZE = 20;
export type ConnectionKind = 'friends' | 'followers' | 'following';
export class CommunityError extends Error {}

export async function getProfileCommunity(userId: string, viewerId?: string) {
  const db = getPool();
  const result = await db.query<{
    following: number; followers: number; friends: number; isFollowing: boolean; followsYou: boolean;
    burn: number; adrenaline: number; admin: number; telegram: number; profileTags: string[]; showOnline: boolean; reviews: number; brands: number; favorites: number; tierLists: number;
  }>(`select u."profileTags", u."showOnline",
    (select count(*)::int from "userFollow" where "userId" = u.id) as following,
    (select count(*)::int from "userFollow" where "targetId" = u.id) as followers,
    (select count(*)::int from "userFollow" f join "userFollow" b on b."userId" = f."targetId" and b."targetId" = f."userId" where f."userId" = u.id) as friends,
    exists(select 1 from "userFollow" where "userId" = $2 and "targetId" = u.id) as "isFollowing",
    exists(select 1 from "userFollow" where "targetId" = $2 and "userId" = u.id) as "followsYou",
    (select count(*)::int from "review" where "userId" = u.id) as reviews,
    (select count(*)::int from "review" where "userId" = u.id and lower(brand) = 'burn') as burn,
    (select count(*)::int from "review" where "userId" = u.id and lower(brand) in ('adrenaline', 'adrenaline rush')) as adrenaline,
    (case when exists(select 1 from "siteAdmin" where email = lower(u.email)) then 1 else 0 end) as admin,
    (case when u."telegramChannel" ~* '^[a-z][a-z0-9_]{4,31}$' then 1 else 0 end) as telegram,
    (select count(distinct brand)::int from "review" where "userId" = u.id) as brands,
    (select count(*)::int from "favorite" where "userId" = u.id) as favorites,
    (select count(*)::int from "tierList" where "userId" = u.id and status = 'published') as "tierLists"
    from "user" u where u.id = $1`, [userId, viewerId ?? null]);
  const row = result.rows[0];
  if (!row) throw new CommunityError('Профиль не найден.');
  const progress: AchievementProgress = { reviews: row.reviews, brands: row.brands, favorites: row.favorites, tierLists: row.tierLists, friends: row.friends, burn: row.burn, adrenaline: row.adrenaline, admin: row.admin, telegram: row.telegram };
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

export async function getProfileWall(profileId: string, page = 1) {
  const [count, comments] = await Promise.all([
    getPool().query<{ count: number }>('select count(*)::int as count from "profileComment" where "profileId" = $1', [profileId]),
    getPool().query<{ id: string; userId: string; text: string; createdAt: Date; username: string | null; name: string; avatarId: string | null; tag: string | null; xp: number; photos: string[] }>(`select c.id, c."userId", c.text, c."createdAt", coalesce((select array_agg(p.id::text order by p.position) from "wallPhoto" p where p."commentId"=c.id), '{}'::text[]) as photos, u.username, u.name,
      (select id::text from "profileImage" where "userId"=u.id and kind='avatar') as "avatarId",
      coalesce((select xp from "profileRanking" where id=u.id),0) as xp,
      case when u."profileTags"[1]='admin' then case when exists(select 1 from "siteAdmin" where email=lower(u.email)) then 'admin' end
      when exists(select 1 from "profileAchievement" where "userId"=u.id and key=u."profileTags"[1]) then u."profileTags"[1] end as tag
      from "profileComment" c join "user" u on u.id = c."userId" where c."profileId" = $1 order by c."createdAt" desc, c.id desc limit $2 offset $3`,
    [profileId, COMMUNITY_PAGE_SIZE, (profilePageNumber(page) - 1) * COMMUNITY_PAGE_SIZE]),
  ]);
  return { count: count.rows[0]?.count ?? 0, comments: comments.rows };
}

export async function addProfileComment(userId: string, profileId: string, input: unknown, photos: PreparedReviewPhoto[] = []) {
  if (photos.length > 5) throw new CommunityError('Можно добавить не более 5 фотографий.');
  const text = validateWallText(input);
  if (!text) throw new CommunityError('Напишите от 1 до 1000 символов.');
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const allowed = await client.query(`update "user" set "lastWallPostAt" = now() where id = $1 and ("lastWallPostAt" is null or "lastWallPostAt" < now() - interval '30 seconds') returning id`, [userId]);
    if (!allowed.rowCount) throw new CommunityError('Следующий комментарий можно отправить через 30 секунд.');
    const result = await client.query<{ id: string }>('insert into "profileComment" ("profileId", "userId", text) values ($1, $2, $3) returning id', [profileId, userId, text]);
    for (const [position, photo] of photos.entries()) {
      await client.query('insert into "wallPhoto" ("commentId", position, data, thumbnail) values ($1, $2, $3, $4)', [result.rows[0]!.id, position, photo.data, photo.thumbnail]);
    }
    await client.query('commit');
    return result.rows[0]!.id;
  } catch (error) { await client.query('rollback'); throw error; }
  finally { client.release(); }
}

export async function deleteProfileComment(userId: string, commentId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(commentId)) throw new CommunityError('Комментарий не найден.');
  // A wall owner or the author can remove a comment. An unrelated user cannot.
  const result = await getPool().query('delete from "profileComment" where id = $1 and ("userId" = $2 or "profileId" = $2) returning "profileId"', [commentId, userId]);
  if (!result.rowCount) throw new CommunityError('Нет доступа к этому комментарию.');
}

export async function touchPresence(userId: string) {
  await getPool().query(`update "user" set "lastSeenAt" = now() where id = $1 and "showOnline" and ("lastSeenAt" is null or "lastSeenAt" < now() - interval '30 seconds')`, [userId]);
}
export async function getPresence(userId: string): Promise<'online' | 'offline' | 'hidden'> {
  const result = await getPool().query<{ status: 'online' | 'offline' | 'hidden' }>(`select case when not "showOnline" then 'hidden'
    when "lastSeenAt" > now() - interval '2 minutes' and exists(select 1 from session s where s."userId" = u.id and s."expiresAt" > now()) then 'online'
    else 'offline' end as status from "user" u where id = $1`, [userId]);
  return result.rows[0]?.status ?? 'hidden';
}
export async function setPresenceVisibility(userId: string, visible: boolean) {
  await getPool().query('update "user" set "showOnline" = $2, "lastSeenAt" = null where id = $1', [userId, visible]);
}
