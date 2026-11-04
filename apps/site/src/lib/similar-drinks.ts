import type { CatalogGroup } from '@canrush/shared';
import { getPool } from '@/db/pool';
import { loadCatalogSnapshot } from '@/lib/catalog';
import { withCatalogDrinks } from '@/lib/catalog-drinks';
import { isCountedCatalogDrink } from '@/lib/home-metrics';
import type { Preference, RatedPreference } from '@/lib/profile-compatibility';
import { getReviewSummaries, type ReviewSummary } from '@/lib/reviews';
import { rankSimilarDrinks, SIMILAR_MIN, type SimilarReason } from '@/lib/similar-drink-fields';
import { drinkKey, opinions, type Opinions, type TasteProfile } from '@/lib/story-recommendations';

/** Every member's opinions and the community's ratings change slowly: read once per process every 10 minutes. */
const TTL_MS = 10 * 60 * 1000;
let cached: { at: number; data: Promise<Signals> } | null = null;

interface Signals {
  members: Map<string, Opinions>;
  /** Ratings per drink (`drinkKey`, without blocked members): the small «well rated» part of the score. */
  ratings: Map<string, ReviewSummary>;
}

async function readSignals(): Promise<Signals> {
  const db = getPool();
  // Members blocked by the site do not shape what others see.
  const active = 'not exists(select 1 from "userBlock" b where b."userId" = t."userId")';
  const [favorites, reviews, drinks, swipes] = await Promise.all([
    db.query<Preference & { userId: string }>(`select "userId", brand, flavor from favorite t where ${active}`),
    db.query<RatedPreference & { userId: string }>(`select "userId", brand, flavor, taste, design from review t where ${active} order by "updatedAt" desc`),
    db.query<Preference & { userId: string; count: number }>(`select "userId", brand, flavor, count(*)::int as count from "drinkLog" t where brand is not null and ${active} group by 1, 2, 3`),
    db.query<Preference & { userId: string; liked: boolean }>(`select "userId", brand, flavor, liked from "drinkSwipe" t where ${active}`),
  ]);
  const profiles = new Map<string, TasteProfile>();
  const profile = (userId: string) => {
    let found = profiles.get(userId);
    if (!found) profiles.set(userId, found = { favorites: [], reviews: [], drinks: [], swipes: [] });
    return found;
  };
  for (const row of favorites.rows) profile(row.userId).favorites.push(row);
  for (const row of reviews.rows) profile(row.userId).reviews.push(row);
  for (const row of drinks.rows) profile(row.userId).drinks.push(row);
  for (const row of swipes.rows) profile(row.userId).swipes!.push(row);

  // Every review counts for the rating, under the drink's canonical identity (old spellings join their drink).
  const totals = new Map<string, { count: number; taste: number; design: number }>();
  for (const row of reviews.rows) {
    const key = drinkKey(row), total = totals.get(key) ?? { count: 0, taste: 0, design: 0 };
    total.count++; total.taste += row.taste; total.design += row.design;
    totals.set(key, total);
  }
  const ratings = new Map([...totals].map(([key, total]) => {
    const taste = total.taste / total.count, design = total.design / total.count;
    return [key, { count: total.count, taste, design, overall: (taste + design) / 2 }];
  }));
  return { members: new Map([...profiles].map(([userId, item]) => [userId, opinions(item)])), ratings };
}

function signals(): Promise<Signals> {
  if (!cached || Date.now() - cached.at > TTL_MS) {
    const data = readSignals();
    cached = { at: Date.now(), data };
    // A failed read is not kept: the next page view tries again.
    data.catch(() => { if (cached?.data === data) cached = null; });
  }
  return cached.data;
}

export interface SimilarDrinkCard { group: CatalogGroup; summary?: ReviewSummary; reason: SimilarReason | null }

/**
 * «Похожее» for a drink page: drinks of the visitor's city catalog (in shops there, or added by members and
 * brands) ranked by `rankSimilarDrinks`. The visitor's own drinks come after the ones they have not tried. Empty when
 * there are too few to be worth a row.
 */
export async function getSimilarDrinks(target: Preference, viewerId: string | null): Promise<SimilarDrinkCard[]> {
  const [{ members, ratings }, snapshot] = await Promise.all([signals(), loadCatalogSnapshot()]);
  const groups = (await withCatalogDrinks(snapshot.groups)).filter(isCountedCatalogDrink);
  const byKey = new Map<string, CatalogGroup>();
  for (const group of groups) if (!byKey.has(drinkKey(group))) byKey.set(drinkKey(group), group);
  const candidates = [...byKey].map(([key, group]) => {
    const rating = ratings.get(key);
    return { brand: group.brand, flavor: group.flavor, inStock: group.variants.length > 0, taste: rating?.taste, reviews: rating?.count };
  });
  const viewer = viewerId ? members.get(viewerId) : undefined;
  const ranked = rankSimilarDrinks(target, candidates, [...members.values()], { tried: new Set(viewer?.keys() ?? []) });
  if (ranked.length < SIMILAR_MIN) return [];
  const shown = ranked.flatMap(item => { const group = byKey.get(drinkKey(item)); return group ? [{ group, reason: item.reason }] : []; });
  // The cards show the same rating as the catalog's.
  const summaries = await getReviewSummaries(shown.map(({ group }) => ({ brand: group.brand, flavor: group.flavor })));
  return shown.map(item => ({ ...item, summary: summaries.get(`${item.group.brand}\u0000${item.group.flavor}`) }));
}
