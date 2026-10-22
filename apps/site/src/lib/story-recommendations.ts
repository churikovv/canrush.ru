import { canonicalProductFlavor } from '@canrush/shared';
import { tasteTokens, type Preference, type RatedPreference } from '@/lib/profile-compatibility';

/**
 * «Тебе понравится»: a small hybrid recommender.
 *
 * 1. Opinions. Each member's signals become one score per drink in [-1, 1]: the taste rating, half absolute and
 *    half relative to the member's own average (a strict and a generous rater become comparable); a favourite
 *    means «likes it» (≥ 0.8); cans in the drink calendar are an implicit «likes it» when repeated; a dating swipe
 *    is a light «would like» (0.5) or «not for me» (−0.4) when nothing stronger is known.
 * 2. Neighbours. Cosine similarity of opinions on the drinks both have an opinion on, damped when they share few
 *    drinks, plus a little for liking the same brands. Only clearly similar members count, the closest first.
 * 3. Collaborative score. For a drink the viewer has not tried: the neighbours' opinions weighted by similarity,
 *    trusted more the more neighbours have one.
 * 4. Content score. The viewer's own affinity for the drink's brand and flavour families and their sugar-free
 *    habit, so the picks make sense even with few neighbours.
 * 5. Blend, a small bonus for drinks in stock, and at most two drinks of one brand.
 */

export interface TasteProfile { favorites: Preference[]; reviews: RatedPreference[]; drinks: (Preference & { count: number })[]; swipes?: (Preference & { liked: boolean })[] }
export interface CatalogDrink extends Preference { inStock: boolean }
export type RecommendationReason =
  | { kind: 'similar'; fans: number; match: number }
  | { kind: 'brand'; brand: string }
  | { kind: 'flavor'; token: string };
export interface RankedDrink { brand: string; flavor: string; score: number; reason: RecommendationReason }

export const drinkKey = (item: Preference) => JSON.stringify([item.brand, canonicalProductFlavor(item.brand, item.flavor)]);
const isSugarFree = (item: Preference) => canonicalProductFlavor(item.brand, item.flavor).includes('sugarfree');
const clamp = (value: number) => Math.max(-1, Math.min(1, value));

/** Above this similarity a member counts as a neighbour; at most this many neighbours are used. */
const MIN_SIMILARITY = 0.15;
const NEIGHBOURS = 25;
const PER_BRAND = 2;

export type Opinions = Map<string, { item: Preference; score: number }>;

export function opinions(profile: TasteProfile): Opinions {
  const result: Opinions = new Map();
  const tastes = profile.reviews.filter(review => review.taste >= 1 && review.taste <= 10);
  const mean = tastes.length ? tastes.reduce((sum, review) => sum + review.taste, 0) / tastes.length : 5.5;
  const set = (item: Preference, score: number, keep: 'max' | 'replace' = 'max') => {
    const key = drinkKey(item), known = result.get(key);
    result.set(key, { item, score: known && keep === 'max' ? Math.max(known.score, score) : score });
  };
  // Newest review per drink wins (loaders order reviews newest first).
  for (const review of [...tastes].reverse()) set(review, clamp(0.5 * (review.taste - 5.5) / 4.5 + 0.5 * (review.taste - mean) / 3), 'replace');
  for (const favorite of profile.favorites) set(favorite, 0.8);
  for (const drink of profile.drinks) {
    const known = result.get(drinkKey(drink));
    // Drinking it again is a «likes it»; a single can only says «tried», unless nothing else is known.
    if (drink.count >= 3) set(drink, 0.7);
    else if (drink.count === 2) set(drink, 0.5);
    else if (!known) set(drink, 0.2);
  }
  // A swipe is a guess about an untried drink, so it only fills in where there is no stronger signal.
  for (const swipe of profile.swipes ?? []) if (!result.has(drinkKey(swipe))) set(swipe, swipe.liked ? 0.5 : -0.4);
  return result;
}

/** Share of liked drinks per brand, for the small «same brands» part of similarity. */
function brandShares(items: Opinions): Map<string, number> {
  const counts = new Map<string, number>();
  for (const { item, score } of items.values()) if (score > 0.3) counts.set(item.brand, (counts.get(item.brand) ?? 0) + 1);
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  return new Map([...counts].map(([brand, count]) => [brand, count / total]));
}

export function similarity(viewer: Opinions, other: Opinions): number {
  let dot = 0, left = 0, right = 0, shared = 0;
  for (const [key, mine] of viewer) {
    const theirs = other.get(key);
    if (!theirs) continue;
    shared++; dot += mine.score * theirs.score; left += mine.score ** 2; right += theirs.score ** 2;
  }
  const cosine = shared && left && right ? dot / Math.sqrt(left * right) : 0;
  const a = brandShares(viewer), b = brandShares(other);
  const brands = [...a].reduce((sum, [brand, share]) => sum + Math.min(share, b.get(brand) ?? 0), 0);
  return 0.75 * cosine * Math.min(shared, 6) / 6 + 0.25 * brands;
}

/** The viewer's mean opinion of a group of drinks, pulled towards 0 when they know few of them. */
function affinity(items: { score: number }[]) {
  return items.reduce((sum, item) => sum + item.score, 0) / (items.length + 0.5);
}

export function rankRecommendations(viewer: TasteProfile, members: TasteProfile[], catalog: CatalogDrink[], limit = 5): RankedDrink[] {
  const mine = opinions(viewer);
  const neighbours = members.map(member => { const theirs = opinions(member); return { theirs, weight: similarity(mine, theirs) }; })
    .filter(neighbour => neighbour.weight > MIN_SIMILARITY)
    .sort((a, b) => b.weight - a.weight).slice(0, NEIGHBOURS);

  const known = [...mine.values()];
  const byBrand = new Map<string, number>();
  for (const brand of new Set(known.map(entry => entry.item.brand))) byBrand.set(brand, affinity(known.filter(entry => entry.item.brand === brand)));
  const byToken = new Map<string, number>();
  for (const token of new Set(known.flatMap(entry => tasteTokens(entry.item)))) byToken.set(token, affinity(known.filter(entry => tasteTokens(entry.item).includes(token))));
  const liked = known.filter(entry => entry.score > 0.3);
  const sugarFree = liked.length ? liked.filter(entry => isSugarFree(entry.item)).length / liked.length : 0;

  const ranked: RankedDrink[] = [];
  for (const drink of catalog) {
    const key = drinkKey(drink);
    if (mine.has(key)) continue;
    let sum = 0, weights = 0, support = 0, fans = 0, fanWeight = 0;
    for (const { theirs, weight } of neighbours) {
      const opinion = theirs.get(key);
      if (!opinion) continue;
      sum += weight * opinion.score; weights += weight; support++;
      if (opinion.score > 0.3) { fans++; fanWeight += weight; }
    }
    const collaborative = weights ? (sum / weights) * support / (support + 1.5) : 0;
    const brand = byBrand.get(drink.brand) ?? 0;
    const tokens = tasteTokens(drink).map(token => ({ token, value: byToken.get(token) ?? 0 })).sort((a, b) => b.value - a.value);
    const flavor = tokens[0]?.value ?? 0;
    // Sugar-free regulars get sugar-free picks, the rest are not pushed towards them.
    const sugar = isSugarFree(drink) ? (sugarFree >= 0.5 ? 0.15 : -0.1) : 0;
    const content = 0.6 * brand + 0.4 * flavor + sugar;
    const score = 0.7 * collaborative + 0.3 * content + (drink.inStock ? 0.05 : 0);
    // Without neighbours' support a drink needs a clear match with the viewer's own brands or flavours.
    if (score <= 0.1 || (collaborative <= 0.05 && content <= 0.18)) continue;
    const reason: RecommendationReason = fans >= 2 || (fans && collaborative >= content)
      ? { kind: 'similar', fans, match: Math.round(100 * fanWeight / fans) }
      : brand >= flavor && brand > 0.2 ? { kind: 'brand', brand: drink.brand }
      : tokens[0] && flavor > 0.2 ? { kind: 'flavor', token: tokens[0].token }
      : { kind: 'similar', fans, match: fans ? Math.round(100 * fanWeight / fans) : 0 };
    ranked.push({ brand: drink.brand, flavor: drink.flavor, score, reason });
  }

  ranked.sort((a, b) => b.score - a.score || a.brand.localeCompare(b.brand, 'ru'));
  const perBrand = new Map<string, number>();
  return ranked.filter(drink => {
    const count = perBrand.get(drink.brand) ?? 0;
    if (count >= PER_BRAND) return false;
    perBrand.set(drink.brand, count + 1);
    return true;
  }).slice(0, limit);
}
