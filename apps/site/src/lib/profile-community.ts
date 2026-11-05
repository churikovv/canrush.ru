import { articleSummary, readingMinutes, type ArticleBlock } from '@/lib/article-fields';
import type { PreparedWallMedia } from '@/lib/wall-media';
import { isCatalogDrink, withWallDrinks } from '@/lib/wall-drinks';
import type { WallDrink } from '@/lib/wall-drink-fields';
import type { ClientPlatform } from '@/lib/client-platform';
import { notBlockedBy } from '@/lib/member-blocks';
import type { WallMediaKind } from '@/lib/wall-media-limits';
import type { RankUpTier } from '@/lib/level-tier';
import { getPool } from '@/db/pool';
import { BADGE_KEYS } from '@/lib/badges';
import { COMMENT_PAUSE_MESSAGE, COMMENT_PAUSE_SECONDS } from '@/lib/comment-pause';
import { getReviewsByAuthorDays, type ReviewData } from '@/lib/reviews';
import { getPublishedTierListsByIds } from '@/lib/tier-lists';
import type { TierListSummary } from '@/lib/tier-list-types';
import { isShopTag } from '@/lib/shop-items';
import { ACHIEVEMENT_METRICS, DETAILED_REVIEW_CHARS, FAN_XP_SINCE, LONG_REVIEW_CHARS, PROFILE_ACHIEVEMENTS, ROLE_TAGS, eligibleAchievements, achievementTier, validateProfileTags, validateWallText, profilePageNumber, type AchievementProgress } from '@/lib/profile-achievements';

export const COMMUNITY_PAGE_SIZE = 20;
export type ConnectionKind = 'friends' | 'followers' | 'following';
export class CommunityError extends Error {}

/** When the member's tags were earned, newest first: the owner's achievements page shows the latest ones. */
export async function getAchievementDates(userId: string, limit = 8) {
  const { rows } = await getPool().query<{ key: string; earnedAt: Date }>('select key, "earnedAt" from "profileAchievement" where "userId" = $1 order by "earnedAt" desc, key limit $2', [userId, limit]);
  return rows;
}

export async function getProfileCommunity(userId: string, viewerId?: string) {
  const db = getPool();
  const result = await db.query<AchievementProgress & {
    following: number; isFollowing: boolean; followsYou: boolean; profileTags: string[]; showOnline: boolean;
  }>(`with r as (
      select brand, flavor, lower(brand) as b, char_length(btrim(text)) >= $3 as detailed, char_length(btrim(text)) >= $5 as long,
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
    (select count(*)::int from r where b = 'monster') as monster,
    (select count(*)::int from r where b = 'monster' and detailed) as "monsterDetailed",
    -- Best 7-day run of XP: a window ending at each award sums everything earned in the 7 days before it.
    (select coalesce(max(w), 0)::int from (select sum(points) over (order by "createdAt" range between interval '7 days' preceding and current row) as w
      from "profileExperience" where "userId" = u.id and reason not in ('monthly-top', 'weekly-top', 'achievement') and "createdAt" >= $4::timestamptz) x) as "weeklyXp",
    (select count(*)::int from "marketStore" where "ownerId" = u.id and status = 'published') as "publishedStores",
    (select count(*)::int from "drinkSwipe" where "userId" = u.id) as swipes,
    (select count(*)::int from "catalogDrink" where "ownerId" = u.id and status = 'published') as "publishedDrinks",
    (select count(*)::int from "drinkSwipe" where "userId" = u.id and liked) as "swipeLikes",
    -- «Бумер»: the original flavour of different brands, and time on the site.
    (select count(distinct b)::int from r where split_part(flavor, ':', 1) = 'original') as "classicBrands",
    floor(extract(epoch from now() - u."createdAt") / 86400)::int as "accountDays",
    -- «Душнила»: walls of text and arguments under reviews, tier lists and wall posts.
    (select count(*)::int from r where long) as "longReviews",
    ((select count(*) from "reviewComment" where "userId" = u.id) + (select count(*) from "tierListComment" where "userId" = u.id)
      + (select count(*) from "wallReply" where "userId" = u.id))::int as comments,
    -- «База»: the most liked of the member's reviews, likes from others only.
    (select coalesce(max(n), 0)::int from (select count(*) as n from "reviewReaction" x join "review" rv on rv.id = x."reviewId"
      where rv."userId" = u.id and x."userId" <> u.id and x.value = 1 group by rv.id) t) as "bestReviewLikes",
    -- «Пикми»: avatar, banner and a description (0–3), and posts in the feed or on walls.
    ((select count(*) from "profileImage" where "userId" = u.id) + (case when coalesce(btrim(u.bio), '') <> '' then 1 else 0 end))::int as "profileLook",
    (select count(*)::int from "profileComment" where "userId" = u.id) as "wallPosts",
    (select count(*)::int from r where b = 'red bull') as "redBull",
    (select count(*)::int from fav where b = 'red bull') as "redBullFavorites",
    (select count(*)::int from r where b in ('volt', 'volt energy')) as volt,
    (select count(*)::int from fav where b in ('volt', 'volt energy')) as "voltFavorites",
    (select count(*)::int from r where b = 'flash up') as flash,
    (select count(*)::int from r where b = 'flash up' and detailed) as "flashDetailed",
    (case when exists(select 1 from "siteAdmin" where email = lower(u.email) and role = 'admin') then 1 else 0 end) as admin,
    (case when exists(select 1 from "siteAdmin" where email = lower(u.email) and role = 'moderator') then 1 else 0 end) as moderator,
    (case when u."telegramChannel" ~* '^[a-z][a-z0-9_]{4,31}$' then 1 else 0 end) as telegram,
    (select count(*)::int from fav) as favorites,
    (select count(distinct brand)::int from fav) as "favoriteBrands",
    (select count(*)::int from "tierList" where "userId" = u.id and status = 'published') as "tierLists",
    (select count(*)::int from "tierListReaction" x join "tierList" t on t.id = x."tierListId" where t."userId" = u.id and t.status = 'published' and x."userId" <> u.id and x.value = 1) as "tierListLikes",
    (select count(*)::int from "monthlyTopAward" where "userId" = u.id and place <= 3) as "monthlyTop",
    -- Given by an admin after the draw (contest-db.ts); the metric only reflects it, so a draw alone never grants it.
    (select count(*)::int from "profileAchievement" where "userId" = u.id and key = 'energizer') as "contestWin",
    -- The week tags are given and taken back by settle_weekly_top; these only reflect them.
    (select count(*)::int from "profileAchievement" where "userId" = u.id and key = 'week-hero') as "weekHero",
    (select count(*)::int from "profileAchievement" where "userId" = u.id and key = 'week-best') as "weekBest",
    (select count(*)::int from "profileAchievement" where "userId" = u.id and key = 'week-charge') as "weekCharge",
    -- Claimed on the home page («Первые шаги», first-steps.ts); the metric only reflects it.
    (select count(*)::int from "profileAchievement" where "userId" = u.id and key = 'first-charge') as "firstSteps",
    -- The furthest day of «Лунный цикл» ever taken (daily-rewards.ts), for the two moon tags.
    (select coalesce(max(step), 0)::int from "dailyReward" where "userId" = u.id) as "dailyStep",
    -- Numbered on sign-up by the beta_engine_member trigger (0073), while the first 500 places last.
    (select count(*)::int from "betaEngine" where "userId" = u.id) as "betaEngine",
    (select count(*)::int from "drinkLog" where "userId" = u.id) as "drinkLogs",
    (select coalesce(max(n), 0)::int from (select count(*) as n from (select day - (row_number() over (order by day))::int as run
      from (select distinct day from "drinkStreakDay" where "userId" = u.id) d) s group by run) t) as "drinkStreak"
    from "user" u where u.id = $1`, [userId, viewerId ?? null, DETAILED_REVIEW_CHARS, `${FAN_XP_SINCE}T00:00:00+03:00`, LONG_REVIEW_CHARS]);
  const row = result.rows[0];
  if (!row) throw new CommunityError('Профиль не найден.');
  const progress = Object.fromEntries(ACHIEVEMENT_METRICS.map(metric => [metric, row[metric]])) as AchievementProgress;
  // Role tags are not stored: they follow the current role, so they go away with it.
  const eligible = eligibleAchievements(progress).filter(key => !ROLE_TAGS.has(key));
  // Each earned tag with the highest tier reached; a tier only ever goes up (XP is paid once, on the first insert).
  const reached = eligible.map(key => achievementTier(PROFILE_ACHIEVEMENTS.find(item => item.key === key)!, progress));
  if (eligible.length) await db.query(`insert into "profileAchievement" ("userId", "key", tier) select $1, key, tier from unnest($2::text[], $3::int[]) as reached(key, tier)
    on conflict ("userId", "key") do update set tier = excluded.tier where "profileAchievement".tier < excluded.tier`, [userId, eligible, reached]);
  const stored = (await db.query<{ key: string; tier: number }>('select "key", tier from "profileAchievement" where "userId" = $1', [userId])).rows
    .filter(item => !ROLE_TAGS.has(item.key) && PROFILE_ACHIEVEMENTS.some(achievement => achievement.key === item.key));
  const earned = stored.map(item => item.key);
  const tiers: Record<string, number> = Object.fromEntries(stored.map(item => [item.key, item.tier]));
  if (row.admin) earned.push('admin');
  if (row.moderator) earned.push('moderator');
  // Achievements that are not tags: only those already stored (the achievements screen earns new ones).
  const badges = (await db.query<{ key: string }>('select key from "profileBadge" where "userId" = $1', [userId])).rows.map(item => item.key).filter(key => BADGE_KEYS.has(key));
  // Tags bought in the look shop: worn like earned ones, but they are not achievements.
  const shopTags = (await db.query<{ key: string }>('select key from "shopPurchase" where "userId" = $1', [userId])).rows.map(item => item.key).filter(isShopTag);
  return { following: row.following, followers: row.followers, friends: row.friends, isFollowing: row.isFollowing, followsYou: row.followsYou,
    tags: row.profileTags.filter(tag => earned.includes(tag) || shopTags.includes(tag)), showOnline: row.showOnline, progress, earned, tiers, badges, shopTags };
}
export type ProfileCommunity = Awaited<ReturnType<typeof getProfileCommunity>>;

export async function setProfileTags(userId: string, input: unknown) {
  const community = await getProfileCommunity(userId);
  const tags = validateProfileTags(input, [...community.earned, ...community.shopTags]);
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

export interface WallPostRow { id: string; profileId: string; userId: string; text: string; createdAt: Date; editedAt: Date | null; username: string | null; name: string; avatarId: string | null; tag: string | null; verified: boolean; xp: number; photos: string[]; mediaKinds: WallMediaKind[];
  /** A catalog drink attached to the record (`withWallDrinks` adds `drink`, the name, cover and link). */
  drinkBrand: string | null; drinkFlavor: string | null; drink?: WallDrink | null }
export interface FeedPostRow extends WallPostRow { ownerUsername: string | null; ownerName: string; ownerAvatarId: string | null }
/** `saved` — records the viewer bookmarked (savedPost), without rank-up events. */
export type FeedScope = 'all' | 'following' | 'saved';

export interface RankUpRow { id: string; userId: string; tier: RankUpTier; degree: number; createdAt: Date; username: string; name: string; avatarId: string | null; tag: string | null; verified: boolean; xp: number }
/** A member's reviews of one Moscow day, shown as one «оценил напитки» event so a run of reviews does not flood the feed. */
export interface FeedReviewGroup { key: string; createdAt: Date; reviews: ReviewData[] }
/**
 * A feed entry: a wall record, the moment a member reached a high level tier (migration 0079), a published tier
 * list, a day of a member's reviews or an article from «Новости».
 */
export type FeedItem = { kind: 'post'; post: FeedPostRow } | { kind: 'rank-up'; rankUp: RankUpRow }
  | { kind: 'tierlist'; tierList: TierListSummary } | { kind: 'reviews'; group: FeedReviewGroup } | { kind: 'gacha'; pull: FeedGachaRow }
  | { kind: 'article'; article: FeedArticleRow } | { kind: 'question'; question: FeedQuestionRow };
/** Вопрос о напитке со страницы напитка: та же строка `drinkQuestion`, ответы — там же. */
export interface FeedQuestionRow { id: string; userId: string; brand: string; flavor: string; text: string; createdAt: Date; answers: number; username: string; name: string; avatarId: string | null; xp: number; tag: string | null; verified: boolean }
/** Опубликованная статья из «Новостей»: та же строка `article`, поэтому лайк общий со страницей статьи. */
export interface FeedArticleRow { id: string; userId: string; title: string; summary: string; minutes: number; coverId: string | null; publishedAt: Date; likes: number; liked: boolean; username: string; name: string; avatarId: string | null; xp: number; tag: string | null; verified: boolean }
/** Лучшая эпическая или легендарная банка, которую участник вытащил из Банкомата за московский день (`count` — сколько таких за день). */
export interface FeedGachaRow { key: string; userId: string; brand: string; flavor: string; rarity: 'epic' | 'legendary'; count: number; createdAt: Date; username: string; name: string; avatarId: string | null; xp: number; tag: string | null; verified: boolean }

// The author `u` as every timeline row shows them: avatar, XP and the selected tag.
export const AUTHOR_COLUMNS = `u.username, u.name,
      (select id::text from "profileImage" where "userId"=u.id and kind='avatar') as "avatarId",
      coalesce((select sum(points) from "profileExperience" where "userId" = u.id), 0)::int as xp,
      case when u."profileTags"[1] in ('admin', 'moderator') then case when exists(select 1 from "siteAdmin" where email = lower(u.email) and role = u."profileTags"[1]) then u."profileTags"[1] end
      when exists(select 1 from "profileAchievement" where "userId"=u.id and key=u."profileTags"[1]) then u."profileTags"[1] end as tag, u."verifiedAt" is not null as verified`;
// One record serves both the wall it was written on and the feed, so both views select the same columns.
const WALL_POST_COLUMNS = `c.id, c."profileId", c."userId", c.text, c."createdAt", c."editedAt", c."drinkBrand", c."drinkFlavor", coalesce((select array_agg(p.id::text order by p.position) from "wallPhoto" p where p."commentId"=c.id), '{}'::text[]) as photos, coalesce((select array_agg(p.kind order by p.position) from "wallPhoto" p where p."commentId"=c.id), '{}'::text[]) as "mediaKinds", ${AUTHOR_COLUMNS}`;

export async function getProfileWall(profileId: string, page = 1, viewerId: string | null = null) {
  const [count, comments] = await Promise.all([
    getPool().query<{ count: number }>('select count(*)::int as count from "profileComment" where "profileId" = $1', [profileId]),
    getPool().query<WallPostRow>(`select ${WALL_POST_COLUMNS}
      from "profileComment" c join "user" u on u.id = c."userId" where c."profileId" = $1 and ${notBlockedBy('$4::text', 'c."userId"')} order by c."createdAt" desc, c.id desc limit $2 offset $3`,
    [profileId, COMMUNITY_PAGE_SIZE, (profilePageNumber(page) - 1) * COMMUNITY_PAGE_SIZE, viewerId]),
  ]);
  return { count: count.rows[0]?.count ?? 0, comments: await withWallDrinks(comments.rows) };
}

/**
 * All walls merged into one timeline, together with members reaching a high level tier. `following` keeps the
 * viewer's own entries and those written by, on the walls of, or about people the viewer follows.
 */
// Events (rank-ups, tier lists, reviews) come from members with a nickname who are not blocked by the site or the viewer;
// «Подписки» keeps the viewer's own and those of people they follow.
const FEED_EVENT_AUTHOR = (author: string) => `u.username is not null and not exists(select 1 from "userBlock" b where b."userId" = u.id)
          and ${notBlockedBy('$2::text', author)}
          and (not $1::boolean or ${author} = $2 or exists(select 1 from "userFollow" f where f."userId" = $2 and f."targetId" = ${author}))`;

export async function getFeed(viewerId: string | null, scope: FeedScope = 'all', page = 1) {
  const following = scope === 'following' && viewerId !== null;
  const saved = scope === 'saved' && viewerId !== null;
  const { rows: entries } = await getPool().query<{ id: string; kind: FeedItem['kind']; total: number }>(`select id, kind, count(*) over()::int as total from (
        select c.id::text, 'post' as kind, c."createdAt" from "profileComment" c
        where (not $1::boolean or c."userId" = $2 or c."profileId" = $2
          or exists(select 1 from "userFollow" f where f."userId" = $2 and f."targetId" in (c."userId", c."profileId")))
          and ${notBlockedBy('$2::text', 'c."userId"')}
          and (not $5::boolean or exists(select 1 from "savedPost" s where s."postId" = c.id and s."userId" = $2))
        union all
        select r.id::text, 'rank-up', r."createdAt" from "rankUp" r join "user" u on u.id = r."userId"
        where not $5::boolean and ${FEED_EVENT_AUTHOR('r."userId"')}
        union all
        select t.id::text, 'tierlist', t."publishedAt" from "tierList" t join "user" u on u.id = t."userId"
        where not $5::boolean and t.status = 'published' and t."publishedAt" is not null and ${FEED_EVENT_AUTHOR('t."userId"')}
        union all
        select r."userId" || '|' || to_char((r."createdAt" at time zone 'Europe/Moscow')::date, 'YYYY-MM-DD'), 'reviews', max(r."createdAt")
        from review r join "user" u on u.id = r."userId"
        where not $5::boolean and ${FEED_EVENT_AUTHOR('r."userId"')}
        group by r."userId", (r."createdAt" at time zone 'Europe/Moscow')::date
        union all
        select p."userId" || '|' || to_char((p."createdAt" at time zone 'Europe/Moscow')::date, 'YYYY-MM-DD'), 'gacha', max(p."createdAt")
        from "gachaPull" p join "user" u on u.id = p."userId"
        where not $5::boolean and p.rarity in ('epic', 'legendary') and ${FEED_EVENT_AUTHOR('p."userId"')}
        group by p."userId", (p."createdAt" at time zone 'Europe/Moscow')::date
        union all
        select a.id::text, 'article', a."publishedAt" from article a join "user" u on u.id = a."authorId"
        where not $5::boolean and a.status = 'published' and a."publishedAt" is not null and ${FEED_EVENT_AUTHOR('a."authorId"')}
        union all
        select q.id::text, 'question', q."createdAt" from "drinkQuestion" q join "user" u on u.id = q."userId"
        where not $5::boolean and ${FEED_EVENT_AUTHOR('q."userId"')}
      ) entry order by "createdAt" desc, id desc limit $3 offset $4`,
  [following, viewerId, COMMUNITY_PAGE_SIZE, (profilePageNumber(page) - 1) * COMMUNITY_PAGE_SIZE, saved]);
  const total = entries[0]?.total ?? 0;
  const idsOf = (kind: FeedItem['kind']) => entries.filter(entry => entry.kind === kind).map(entry => entry.id);
  const [posts, rankUps, tierLists, reviewDays, gachaDays, articles, questions] = await Promise.all([
    getPool().query<FeedPostRow>(`select ${WALL_POST_COLUMNS}, o.username as "ownerUsername", o.name as "ownerName",
      (select id::text from "profileImage" where "userId"=o.id and kind='avatar') as "ownerAvatarId"
      from "profileComment" c join "user" u on u.id = c."userId" join "user" o on o.id = c."profileId" where c.id = any($1::uuid[])`, [idsOf('post')]),
    getPool().query<RankUpRow>(`select r.id, r."userId", r.tier, r.degree, r."createdAt", ${AUTHOR_COLUMNS}
      from "rankUp" r join "user" u on u.id = r."userId" where r.id = any($1::uuid[])`, [idsOf('rank-up')]),
    getPublishedTierListsByIds(idsOf('tierlist')),
    getReviewsByAuthorDays(idsOf('reviews')),
    idsOf('gacha').length ? getPool().query<FeedGachaRow>(`select distinct on (p.key) p.key, p."userId", p.brand, p.flavor, p.rarity, p."createdAt",
        (select count(*) from "gachaPull" q where q."userId" = p."userId" and q.rarity in ('epic', 'legendary')
          and (q."createdAt" at time zone 'Europe/Moscow')::date = (p."createdAt" at time zone 'Europe/Moscow')::date)::int as count, ${AUTHOR_COLUMNS}
      from (select *, "userId" || '|' || to_char(("createdAt" at time zone 'Europe/Moscow')::date, 'YYYY-MM-DD') as key from "gachaPull" where rarity in ('epic', 'legendary')) p
      join "user" u on u.id = p."userId" where p.key = any($1::text[])
      order by p.key, case p.rarity when 'legendary' then 0 else 1 end, p."createdAt"`, [idsOf('gacha')]).then(result => result.rows) : Promise.resolve([] as FeedGachaRow[]),
    idsOf('article').length ? getPool().query<Omit<FeedArticleRow, 'summary' | 'minutes'> & { blocks: ArticleBlock[] }>(`select a.id, a."authorId" as "userId", a.title, a.blocks, a."coverId", a."publishedAt",
        (select count(*)::int from "articleLike" l where l."articleId" = a.id) as likes,
        exists(select 1 from "articleLike" l where l."articleId" = a.id and l."userId" = $2) as liked, ${AUTHOR_COLUMNS}
      from article a join "user" u on u.id = a."authorId" where a.id = any($1::uuid[])`, [idsOf('article'), viewerId])
      .then(result => result.rows.map(({ blocks, ...row }) => ({ ...row, summary: articleSummary(blocks), minutes: readingMinutes(blocks) }))) : Promise.resolve([] as FeedArticleRow[]),
    idsOf('question').length ? getPool().query<FeedQuestionRow>(`select q.id, q."userId", q.brand, q.flavor, q.text, q."createdAt",
        (select count(*)::int from "drinkAnswer" a where a."questionId" = q.id) as answers, ${AUTHOR_COLUMNS}
      from "drinkQuestion" q join "user" u on u.id = q."userId" where q.id = any($1::uuid[])`, [idsOf('question')]).then(result => result.rows) : Promise.resolve([] as FeedQuestionRow[]),
  ]);
  const questionById = new Map(questions.map(question => [question.id, question]));
  const articleById = new Map(articles.map(article => [article.id, article]));
  const gachaByKey = new Map(gachaDays.map(row => [row.key, row]));
  const tierListById = new Map(tierLists.map(list => [list.id, list]));
  const postById = new Map((await withWallDrinks(posts.rows)).map(post => [post.id, post]));
  const rankUpById = new Map(rankUps.rows.map(rankUp => [rankUp.id, rankUp]));
  const items = entries.flatMap((entry): FeedItem[] => {
    const post = entry.kind === 'post' ? postById.get(entry.id) : undefined;
    if (post) return [{ kind: 'post', post }];
    const rankUp = entry.kind === 'rank-up' ? rankUpById.get(entry.id) : undefined;
    if (rankUp) return [{ kind: 'rank-up', rankUp }];
    const tierList = entry.kind === 'tierlist' ? tierListById.get(entry.id) : undefined;
    if (tierList) return [{ kind: 'tierlist', tierList }];
    const pull = entry.kind === 'gacha' ? gachaByKey.get(entry.id) : undefined;
    if (pull) return [{ kind: 'gacha', pull }];
    const article = entry.kind === 'article' ? articleById.get(entry.id) : undefined;
    if (article) return [{ kind: 'article', article }];
    const question = entry.kind === 'question' ? questionById.get(entry.id) : undefined;
    if (question) return [{ kind: 'question', question }];
    const reviews = entry.kind === 'reviews' ? reviewDays.get(entry.id) : undefined;
    return reviews?.length ? [{ kind: 'reviews', group: { key: entry.id, createdAt: reviews[0]!.createdAt, reviews } }] : [];
  });
  const pages = Math.ceil(total / COMMUNITY_PAGE_SIZE);
  return { items, posts: items.flatMap(item => item.kind === 'post' ? [item.post] : []), pages, hasMore: profilePageNumber(page) < pages };
}

export async function addProfileComment(userId: string, profileId: string, input: unknown, photos: PreparedWallMedia[] = [], drink: { brand: string; flavor: string } | null = null) {
  if (photos.length > 5) throw new CommunityError('Можно добавить не более 5 вложений.');
  // A record may be just attachments or a drink; then its text is empty.
  const attached = photos.length > 0 || drink !== null;
  const text = typeof input === 'string' && !input.trim() && attached ? '' : validateWallText(input);
  if (text === null) throw new CommunityError(attached ? 'Запись должна быть не длиннее 1000 символов.' : 'Напишите запись или прикрепите фото, GIF, видео или напиток.');
  if (drink && !await isCatalogDrink(drink.brand, drink.flavor)) throw new CommunityError('Этого напитка нет в каталоге.');
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const allowed = await client.query(`update "user" set "lastWallPostAt" = now() where id = $1 and ("lastWallPostAt" is null or "lastWallPostAt" < now() - interval '${COMMENT_PAUSE_SECONDS} seconds') returning id`, [userId]);
    if (!allowed.rowCount) throw new CommunityError(COMMENT_PAUSE_MESSAGE);
    const result = await client.query<{ id: string }>('insert into "profileComment" ("profileId", "userId", text, "drinkBrand", "drinkFlavor") values ($1, $2, $3, $4, $5) returning id', [profileId, userId, text, drink?.brand ?? null, drink?.flavor ?? null]);
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

export async function touchPresence(userId: string, platform: ClientPlatform = 'web') {
  // The same heartbeat marks the member in the current 5-minute window of the admin online chart and,
  // even with a hidden status, in today's row of the admin activity totals and of the platform they came from.
  await getPool().query(`with active as (
      insert into "activityDay" (day, "userId") values ((now() at time zone 'Europe/Moscow')::date, $1) on conflict do nothing
    ), platform as (
      insert into "platformDay" (day, "userId", platform) values ((now() at time zone 'Europe/Moscow')::date, $1, $2) on conflict do nothing
    ), seen as (
      update "user" set "lastSeenAt" = now() where id = $1 and "showOnline" and ("lastSeenAt" is null or "lastSeenAt" < now() - interval '30 seconds') returning id
    ) insert into "presenceSample" (bucket, "userId") select date_bin('5 minutes', now(), timestamptz '2000-01-01'), id from seen on conflict do nothing`, [userId, platform]);
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
