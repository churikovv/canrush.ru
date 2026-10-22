import type { CatalogGroup } from '@canrush/shared';
import { getPool } from '@/db/pool';
import { catalogGroupSlug, flavorName } from '@/lib/catalog-query';
import { addDays, moscowDay } from '@/lib/drink-calendar-fields';
import { getDrinkOverview } from '@/lib/drink-calendar';
import type { Preference, RatedPreference } from '@/lib/profile-compatibility';
import { drinkKey, rankRecommendations, type CatalogDrink, type RecommendationReason, type TasteProfile } from '@/lib/story-recommendations';

/** «Твоя неделя»: the last seven days (Moscow), today included. */
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
         (select coalesce(sum(points), 0)::int from "profileExperience" where "userId" = $1 and "createdAt" >= $2::date) as xp,
         (select count(*)::int from review where "userId" = $1 and "createdAt" >= $2::date) as reviews,
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
export interface StoryRecommendation { brand: string; name: string; href: string; cover: string | null; reason: PickReason }
export interface Recommendations { basis: 'similar' | 'community'; items: StoryRecommendation[] }

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
  return { viewer: loaded.get(userId)!, members: candidates.rows.map(row => loaded.get(row.userId)!) };
}

/**
 * «Тебе понравится»: the hybrid recommender in story-recommendations.ts over the viewer's taste neighbourhood.
 * Too few picks — the community's best-rated drinks the viewer has not tried. Only drinks in this city's catalog.
 */
export async function getRecommendations(userId: string, groups: CatalogGroup[]): Promise<Recommendations> {
  const db = getPool();
  const byKey = new Map(groups.map(group => [drinkKey(group), group]));
  const { viewer, members } = await tasteNeighbourhood(userId);
  const toItem = (brand: string, flavor: string, reason: PickReason): StoryRecommendation | null => {
    const group = byKey.get(drinkKey({ brand, flavor }));
    return group ? { brand: group.brand, name: flavorName(group.flavor), href: `/catalog/${catalogGroupSlug(group.brand, group.flavor)}`, cover: group.coverImageUrl ?? null, reason } : null;
  };

  const catalog: CatalogDrink[] = groups.map(group => ({ brand: group.brand, flavor: group.flavor, inStock: group.variants.length > 0 }));
  const items = rankRecommendations(viewer, members, catalog).flatMap(drink => toItem(drink.brand, drink.flavor, drink.reason) ?? []);
  if (items.length >= 3) return { basis: 'similar', items };

  const tried = new Set([...viewer.favorites, ...viewer.reviews, ...viewer.drinks, ...(viewer.swipes ?? [])].map(drinkKey));
  const { rows } = await db.query<{ brand: string; flavor: string; count: number; taste: number }>(
    `select brand, flavor, count(*)::int as count, avg(taste)::float as taste from review group by brand, flavor having count(*) >= 2 order by avg(taste) desc, count(*) desc limit 40`);
  const popular = rows.filter(row => !tried.has(drinkKey(row)))
    .flatMap(row => toItem(row.brand, row.flavor, { kind: 'community', taste: Math.round(row.taste * 10) / 10, reviews: row.count }) ?? []).slice(0, 5);
  return { basis: 'community', items: popular };
}
