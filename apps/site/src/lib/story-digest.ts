import type { CatalogGroup } from '@canrush/shared';
import { getPool } from '@/db/pool';
import { catalogGroupSlug, catalogRetailerCount, flavorName } from '@/lib/catalog-query';
import { addDays, moscowDay } from '@/lib/drink-calendar-fields';
import { getDrinkOverview } from '@/lib/drink-calendar';
import type { Preference, RatedPreference } from '@/lib/profile-compatibility';
import { drinkKey, rankRecommendations, type CatalogDrink, type RecommendationReason, type TasteProfile } from '@/lib/story-recommendations';
import { tasteCard, type TasteSignal } from '@/lib/taste-card-fields';

/** «Твоя неделя»: seven days (Moscow) ending with `today`; the home page passes last Sunday, so it is the finished week. */
export interface WeeklyDigest {
  from: string; to: string;
  cans: number; days: number; streak: number; xp: number; reviews: number; newDrinks: number;
  /** Cans per day, oldest first (7 values). */
  daily: number[];
  favorite: { name: string; count: number; brand: string | null; flavor: string | null; cover?: string | null } | null;
  rank: number | null;
  /** Share of members who logged cans this week and logged fewer than the viewer; null without others to compare. */
  ahead: number | null;
}

export async function getWeeklyDigest(userId: string, today = moscowDay()): Promise<WeeklyDigest> {
  const from = addDays(today, -6);
  const db = getPool();
  const [week, perDay, compared, totals, overview] = await Promise.all([
    db.query<{ name: string; brand: string | null; flavor: string | null; count: number }>(
      `select coalesce(nullif(name, ''), brand || ' ' || flavor) as name, brand, flavor, count(*)::int as count
       from "drinkLog" where "userId" = $1 and day between $2::date and $3::date group by 1, 2, 3 order by count desc, name`, [userId, from, today]),
    db.query<{ day: string; count: number }>(
      `select day::text as day, count(*)::int as count from "drinkLog" where "userId" = $1 and day between $2::date and $3::date group by day`, [userId, from, today]),
    db.query<{ ahead: number | null }>(
      `with week as (select "userId", count(*) as cans from "drinkLog" where day between $2::date and $3::date group by "userId")
       select case when count(*) filter (where "userId" <> $1) = 0 then null
         else round(100.0 * count(*) filter (where "userId" <> $1 and cans < coalesce((select cans from week where "userId" = $1), 0)) / count(*) filter (where "userId" <> $1))::int end as ahead
       from week`, [userId, from, today]),
    db.query<{ days: number; xp: number; reviews: number; newDrinks: number; rank: number | null }>(
      `select (select count(distinct day)::int from "drinkLog" where "userId" = $1 and day between $2::date and $3::date) as days,
         (select coalesce(sum(points), 0)::int from "profileExperience" where "userId" = $1 and "createdAt" >= $2::date and "createdAt" < $3::date + 1) as xp,
         (select count(*)::int from review where "userId" = $1 and "createdAt" >= $2::date and "createdAt" < $3::date + 1) as reviews,
         (select count(*)::int from (select distinct brand, flavor from "drinkLog" d where d."userId" = $1 and d.brand is not null and d.day between $2::date and $3::date
            and not exists(select 1 from "drinkLog" e where e."userId" = $1 and e.brand = d.brand and e.flavor = d.flavor and e.day < $2::date)
            and not exists(select 1 from review r where r."userId" = $1 and r.brand = d.brand and r.flavor = d.flavor and r."createdAt" < $2::date)) n) as "newDrinks",
         (select rank from "profileRanking" where id = $1) as rank`, [userId, from, today]),
    getDrinkOverview(userId, today),
  ]);
  const t = totals.rows[0]!;
  const top = week.rows[0];
  const counts = new Map(perDay.rows.map(row => [row.day, row.count]));
  return {
    from, to: today, cans: week.rows.reduce((sum, row) => sum + row.count, 0), days: t.days, streak: overview.current?.length ?? 0,
    xp: t.xp, reviews: t.reviews, newDrinks: t.newDrinks, rank: t.rank, ahead: compared.rows[0]?.ahead ?? null,
    daily: Array.from({ length: 7 }, (_, index) => counts.get(addDays(from, index)) ?? 0),
    favorite: top ? { name: top.brand && top.flavor ? `${top.brand} ${flavorName(top.flavor)}` : top.name, count: top.count, brand: top.brand, flavor: top.flavor } : null,
  };
}

export type PickReason = RecommendationReason | { kind: 'community'; taste: number; reviews: number };
/** A drink of the viewer's own: the full label, and the flavour alone for lines that already name the brand. */
export interface PickDrink { label: string; flavor: string; cover: string | null }
export interface StoryRecommendation {
  brand: string; flavor: string; name: string; href: string; cover: string | null; reason: PickReason;
  /** «Совпадение» 60–98 %; `null` for the community's picks, which say nothing about the viewer. */
  match: number | null;
  /** The viewer's own liked drinks behind the pick. */
  because: PickDrink[];
  /** People with a similar taste who like it openly (a rating or a favourite), with a nickname, not blocked either way. */
  fans: { username: string; avatarId: string | null }[];
  /** The lowest price in the viewer's city and the number of chains; `null` when nobody sells it now. */
  price: number | null; stores: number; sugarfree: boolean;
}
/** What the picks know about the viewer, for the story's first slide. */
export interface PicksProfile {
  /** «Твой вкус» archetype and its line, once there are enough decisions (`tasteCard`). */
  title: string | null; lead: string | null; loves: string[]; brand: string | null; sugarfree: boolean;
  reviews: number; favorites: number; swipes: number;
}
export interface Recommendations { basis: 'similar' | 'community'; items: StoryRecommendation[]; profile: PicksProfile }

const CANDIDATES = 60;

/**
 * «Тебе понравится»: the hybrid recommender in story-recommendations.ts over members who share at least two drinks
 * with the viewer (favourites, reviews or cans in the calendar). Too few picks — the community's best-rated drinks
 * the viewer has not tried. Only drinks in this city's catalog.
 */
/**
 * The viewer's taste profile and those of members who share at least two drinks with them (favourites, reviews,
 * cans in the calendar or liked swipes) — the input of rankRecommendations, shared by the picks and the dating deck.
 */
export async function tasteNeighbourhood(userId: string): Promise<{ viewer: TasteProfile; members: TasteProfile[] }> {
  const db = getPool();
  const profiles = async (ids: string[]) => {
    const [favorites, reviews, drinks, swipes] = await Promise.all([
      db.query<Preference & { userId: string }>('select "userId", brand, flavor from favorite where "userId" = any($1::text[])', [ids]),
      db.query<RatedPreference & { userId: string }>('select "userId", brand, flavor, taste, design from review where "userId" = any($1::text[]) order by "updatedAt" desc', [ids]),
      db.query<Preference & { userId: string; count: number }>('select "userId", brand, flavor, count(*)::int as count from "drinkLog" where "userId" = any($1::text[]) and brand is not null group by 1, 2, 3', [ids]),
      db.query<Preference & { userId: string; liked: boolean }>('select "userId", brand, flavor, liked from "drinkSwipe" where "userId" = any($1::text[])', [ids]),
    ]);
    return new Map(ids.map(id => [id, {
      favorites: favorites.rows.filter(row => row.userId === id),
      reviews: reviews.rows.filter(row => row.userId === id),
      drinks: drinks.rows.filter(row => row.userId === id),
      swipes: swipes.rows.filter(row => row.userId === id),
    } satisfies TasteProfile]));
  };
  const candidates = await db.query<{ userId: string }>(`
    with items as (select "userId", brand, flavor from favorite union select "userId", brand, flavor from review
                   union select "userId", brand, flavor from "drinkLog" where brand is not null
                   union select "userId", brand, flavor from "drinkSwipe" where liked),
    mine as (select brand, flavor from items where "userId" = $1)
    select x."userId" from items x join mine using (brand, flavor)
    where x."userId" <> $1 and not exists(select 1 from "userBlock" b where b."userId" = x."userId")
    group by x."userId" having count(*) >= 2 order by count(*) desc limit ${CANDIDATES}`, [userId]);
  const loaded = await profiles([userId, ...candidates.rows.map(row => row.userId)]);
  return { viewer: loaded.get(userId)!, members: candidates.rows.map(row => ({ ...loaded.get(row.userId)!, userId: row.userId })) };
}

/**
 * «Тебе понравится»: the hybrid recommender in story-recommendations.ts over the viewer's taste neighbourhood.
 * Too few picks — the community's best-rated drinks the viewer has not tried. Only drinks in this city's catalog.
 */
export async function getRecommendations(userId: string, groups: CatalogGroup[]): Promise<Recommendations> {
  const db = getPool();
  const byKey = new Map(groups.map(group => [drinkKey(group), group]));
  const { viewer, members } = await tasteNeighbourhood(userId);
  const drink = (item: { brand: string; flavor: string }): PickDrink => {
    const group = byKey.get(drinkKey(item));
    return group ? { label: `${group.brand} ${flavorName(group.flavor)}`, flavor: flavorName(group.flavor), cover: group.coverImageUrl ?? null }
      : { label: `${item.brand} ${flavorName(item.flavor)}`, flavor: flavorName(item.flavor), cover: null };
  };
  const toItem = (brand: string, flavor: string, reason: PickReason, extra: Pick<StoryRecommendation, 'match' | 'because' | 'fans'>): StoryRecommendation | null => {
    const group = byKey.get(drinkKey({ brand, flavor }));
    if (!group) return null;
    const selling = group.variants.length > 0;
    return {
      brand: group.brand, flavor: group.flavor, name: flavorName(group.flavor), href: `/catalog/${catalogGroupSlug(group.brand, group.flavor)}`, cover: group.coverImageUrl ?? null, reason,
      ...extra, price: selling && group.minPrice > 0 ? group.minPrice : null, stores: selling ? catalogRetailerCount(group) : 0, sugarfree: /(^|:)(sugarfree|sweetener)\b/.test(group.flavor),
    };
  };

  // The same decisions as the «Твой вкус» card in dating: liked swipes and favourites, clear taste ratings.
  const signals: TasteSignal[] = [
    ...(viewer.swipes ?? []).map(item => ({ brand: item.brand, flavor: item.flavor, liked: item.liked, source: 'swipe' as const })),
    ...viewer.favorites.map(item => ({ brand: item.brand, flavor: item.flavor, liked: true, source: 'favorite' as const })),
    ...viewer.reviews.filter(review => review.taste >= 7 || review.taste <= 4).map(review => ({ brand: review.brand, flavor: review.flavor, liked: review.taste >= 7, source: 'review' as const })),
  ];
  const card = tasteCard(signals);
  const profile: PicksProfile = {
    title: card?.title ?? null, lead: card?.lead ?? null, loves: card?.loves.map(item => item.label) ?? [], brand: card?.brand?.name ?? null, sugarfree: card?.sugarfree === 'loves',
    reviews: new Set(viewer.reviews.map(drinkKey)).size, favorites: viewer.favorites.length, swipes: viewer.swipes?.length ?? 0,
  };

  const catalog: CatalogDrink[] = groups.map(group => ({ brand: group.brand, flavor: group.flavor, inStock: group.variants.length > 0 }));
  const ranked = rankRecommendations(viewer, members, catalog);
  // Fans are shown by nickname only when they are on the site openly: a nickname, no site block, no block either way.
  const fanIds = [...new Set(ranked.flatMap(item => item.publicFans))];
  const fans = fanIds.length ? new Map((await db.query<{ id: string; username: string; avatarId: string | null }>(
    `select u.id, u.username, (select id::text from "profileImage" where "userId" = u.id and kind = 'avatar') as "avatarId" from "user" u
      where u.id = any($2::text[]) and u.username is not null and not exists(select 1 from "userBlock" b where b."userId" = u.id)
        and not exists(select 1 from "memberBlock" m where (m."blockerId" = $1 and m."blockedId" = u.id) or (m."blockerId" = u.id and m."blockedId" = $1))`,
    [userId, fanIds])).rows.map(row => [row.id, { username: row.username, avatarId: row.avatarId }])) : new Map<string, { username: string; avatarId: string | null }>();
  const items = ranked.flatMap(item => toItem(item.brand, item.flavor, item.reason, {
    match: item.match, because: item.because.map(drink),
    fans: item.publicFans.flatMap(id => fans.get(id) ?? []),
  }) ?? []);
  if (items.length >= 3) return { basis: 'similar', items, profile };

  const tried = new Set([...viewer.favorites, ...viewer.reviews, ...viewer.drinks, ...(viewer.swipes ?? [])].map(drinkKey));
  const { rows } = await db.query<{ brand: string; flavor: string; count: number; taste: number }>(
    `select brand, flavor, count(*)::int as count, avg(taste)::float as taste from review group by brand, flavor having count(*) >= 2 order by avg(taste) desc, count(*) desc limit 40`);
  const popular = rows.filter(row => !tried.has(drinkKey(row)))
    .flatMap(row => toItem(row.brand, row.flavor, { kind: 'community', taste: Math.round(row.taste * 10) / 10, reviews: row.count }, { match: null, because: [], fans: [] }) ?? []).slice(0, 5);
  return { basis: 'community', items: popular, profile };
}
