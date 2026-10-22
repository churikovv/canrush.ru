import { isResolvedFlavor, type CatalogGroup } from '@canrush/shared';
import { getPool } from '@/db/pool';
import { catalogGroupSlug, flavorName } from '@/lib/catalog-query';
import { PROFILE_ACHIEVEMENTS } from '@/lib/profile-achievements';
import { getReviewSummaries } from '@/lib/reviews';
import { tasteNeighbourhood } from '@/lib/story-digest';
import { drinkKey, rankRecommendations, type RecommendationReason } from '@/lib/story-recommendations';

export class SwipeError extends Error {}

/** One card of the dating deck. */
export interface SwipeCard {
  brand: string; flavor: string; name: string; href: string; cover: string;
  minPrice: number | null;
  taste: number | null; reviews: number;
  likes: number;
  /** Set when the recommender put the drink first, to show why. */
  reason: RecommendationReason | null;
}
export interface SwipeCounts { liked: number; skipped: number }

/** XP for each of the first swipes, once per drink (migration 0092 pays it from a trigger on "drinkSwipe"). */
export const SWIPE_XP = 2;
export const SWIPE_XP_LIMIT = 30;
/** «Люблю <3» — the «Свидание» achievement for the dating deck. */
const DATE_TAG = PROFILE_ACHIEVEMENTS.find(item => item.key === 'date');
export interface SwipeReward { xp: number; tag: { key: string; label: string } | null }

const DECK = 30;
const PICKS = 12;

/**
 * Records a decision; swiping the same drink again replaces it. Only drinks of the catalog can be swiped.
 * Returns the XP it paid and «Люблю <3» when this swipe completed it, so the deck can say so at once.
 */
export async function recordSwipe(userId: string, groups: CatalogGroup[], brand: string, flavor: string, liked: boolean): Promise<SwipeReward> {
  if (!groups.some(group => group.brand === brand && group.flavor === flavor)) throw new SwipeError('Этого напитка нет в каталоге.');
  const client = await getPool().connect();
  let xp = 0;
  try {
    await client.query('begin');
    const result = await client.query(`insert into "drinkSwipe"("userId", brand, flavor, liked)
      select $1, $2, $3, $4 where not exists(select 1 from "userBlock" where "userId" = $1)
      on conflict ("userId", brand, flavor) do update set liked = excluded.liked, "createdAt" = now()`, [userId, brand, flavor, liked]);
    if (!result.rowCount) throw new SwipeError('Ваш аккаунт заблокирован.');
    // The trigger's award carries this transaction's now(), so it is told apart from an earlier swipe of the drink.
    xp = (await client.query<{ points: number }>(`select points from "profileExperience"
      where "userId" = $1 and reason = 'swipe' and "sourceKey" = $2 and "createdAt" = now()`, [userId, `${brand}:${flavor}`])).rows[0]?.points ?? 0;
    await client.query('commit');
  } catch (error) { await client.query('rollback'); throw error; }
  finally { client.release(); }
  return { xp, tag: await grantDateTag(userId) };
}

/** Grants «Люблю <3» right away instead of on the next profile view; the tag's own XP comes from its trigger. */
async function grantDateTag(userId: string): Promise<SwipeReward['tag']> {
  if (!DATE_TAG) return null;
  const { rows } = await getPool().query<{ swipes: number; swipeLikes: number; has: boolean }>(`select
    (select count(*)::int from "drinkSwipe" where "userId" = $1) as swipes,
    (select count(*)::int from "drinkSwipe" where "userId" = $1 and liked) as "swipeLikes",
    exists(select 1 from "profileAchievement" where "userId" = $1 and key = $2) as has`, [userId, DATE_TAG.key]);
  const row = rows[0];
  if (!row || row.has || !DATE_TAG.steps.every(step => (step.metric === 'swipes' ? row.swipes : row.swipeLikes) >= step.goal)) return null;
  const inserted = await getPool().query('insert into "profileAchievement" ("userId", key) values ($1, $2) on conflict do nothing', [userId, DATE_TAG.key]);
  return inserted.rowCount ? { key: DATE_TAG.key, label: DATE_TAG.label } : null;
}

/** How many swipes still pay XP for the member. */
export async function swipeXpLeft(userId: string): Promise<number> {
  const { rows } = await getPool().query<{ paid: number }>(`select count(*)::int as paid from "profileExperience" where "userId" = $1 and reason = 'swipe'`, [userId]);
  return Math.max(0, SWIPE_XP_LIMIT - (rows[0]?.paid ?? 0));
}

/** «Вернуть»: forgets the decision so the card comes back. */
export async function undoSwipe(userId: string, brand: string, flavor: string): Promise<void> {
  await getPool().query('delete from "drinkSwipe" where "userId" = $1 and brand = $2 and flavor = $3', [userId, brand, flavor]);
}

export async function getSwipeCounts(brand: string, flavor: string): Promise<SwipeCounts> {
  const { rows } = await getPool().query<SwipeCounts>(`select count(*) filter (where liked)::int as liked, count(*) filter (where not liked)::int as skipped
    from "drinkSwipe" s where brand = $1 and flavor = $2 and not exists(select 1 from "userBlock" b where b."userId" = s."userId")`, [brand, flavor]);
  return rows[0] ?? { liked: 0, skipped: 0 };
}

/** Drinks the member liked in dating, newest first — «Твои мэтчи». */
export async function getLikedSwipes(userId: string, groups: CatalogGroup[], limit = 12): Promise<SwipeCard[]> {
  const { rows } = await getPool().query<{ brand: string; flavor: string }>(
    'select brand, flavor from "drinkSwipe" where "userId" = $1 and liked order by "createdAt" desc limit $2', [userId, limit * 2]);
  const byKey = new Map(groups.map(group => [`${group.brand}\u0000${group.flavor}`, group]));
  return rows.flatMap(row => { const group = byKey.get(`${row.brand}\u0000${row.flavor}`); return group?.coverImageUrl ? [card(group, null, null, 0)] : []; }).slice(0, limit);
}

function card(group: CatalogGroup, summary: { taste: number; count: number } | null | undefined, reason: RecommendationReason | null, likes: number): SwipeCard {
  return {
    brand: group.brand, flavor: group.flavor, name: flavorName(group.flavor), href: `/catalog/${catalogGroupSlug(group.brand, group.flavor)}`,
    cover: group.coverImageUrl!, minPrice: group.minPrice > 0 ? group.minPrice : null,
    taste: summary?.count ? Math.round(summary.taste * 10) / 10 : null, reviews: summary?.count ?? 0, likes, reason,
  };
}

/** Same order all day for a member, a new one tomorrow: a cheap hash of the drink, the member and the day. */
function dailyRank(key: string, seed: string): number {
  let hash = 2166136261;
  for (const char of `${seed}|${key}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

/**
 * The deck: drinks with a photo the member has not swiped, reviewed or favourited. Signed in, the recommender's
 * picks come first (with their reason), then the rest in a daily shuffle; a guest gets the shuffle.
 */
export async function getSwipeDeck(userId: string | null, groups: CatalogGroup[]): Promise<SwipeCard[]> {
  const db = getPool();
  const pool = groups.filter(group => group.coverImageUrl && isResolvedFlavor(group.flavor));
  let first: { group: CatalogGroup; reason: RecommendationReason | null }[] = [];
  let rest = pool;
  if (userId) {
    const [{ viewer, members }, swiped] = await Promise.all([
      tasteNeighbourhood(userId),
      db.query<{ brand: string; flavor: string }>('select brand, flavor from "drinkSwipe" where "userId" = $1', [userId]),
    ]);
    const seen = new Set([...viewer.favorites, ...viewer.reviews, ...swiped.rows].map(drinkKey));
    rest = pool.filter(group => !seen.has(drinkKey(group)));
    const byKey = new Map(rest.map(group => [drinkKey(group), group]));
    first = rankRecommendations(viewer, members, rest.map(group => ({ brand: group.brand, flavor: group.flavor, inStock: group.variants.length > 0 })), PICKS)
      .flatMap(pick => { const group = byKey.get(drinkKey(pick)); return group ? [{ group, reason: pick.reason }] : []; });
    const picked = new Set(first.map(item => drinkKey(item.group)));
    rest = rest.filter(group => !picked.has(drinkKey(group)));
  }
  const seed = `${userId ?? 'guest'}:${new Date().toISOString().slice(0, 10)}`;
  const deck = [...first, ...rest.map(group => ({ group, reason: null }))
    .sort((a, b) => dailyRank(drinkKey(a.group), seed) - dailyRank(drinkKey(b.group), seed))].slice(0, DECK);
  if (!deck.length) return [];
  const [summaries, likes] = await Promise.all([
    getReviewSummaries(deck.map(item => item.group)),
    db.query<{ brand: string; flavor: string; likes: number }>(`select brand, flavor, count(*)::int as likes from "drinkSwipe"
      where liked and (brand, flavor) in (select * from unnest($1::text[], $2::text[])) group by brand, flavor`,
      [deck.map(item => item.group.brand), deck.map(item => item.group.flavor)]),
  ]);
  const likeCount = new Map(likes.rows.map(row => [`${row.brand}\u0000${row.flavor}`, row.likes]));
  return deck.map(({ group, reason }) => card(group, summaries.get(`${group.brand}\u0000${group.flavor}`), reason, likeCount.get(`${group.brand}\u0000${group.flavor}`) ?? 0));
}
