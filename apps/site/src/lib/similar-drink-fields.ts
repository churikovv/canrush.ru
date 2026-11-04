import { canonicalProductFlavor } from '@canrush/shared';
import { FLAVOR_TOKENS } from '@/lib/pick-reason';
import { tasteTokens, type Preference } from '@/lib/profile-compatibility';
import { drinkKey, type Opinions } from '@/lib/story-recommendations';

/**
 * «Похожее» under a drink: drinks like this one, from the site's own data. No database here — the loader is
 * `similar-drinks.ts`.
 *
 * 1. Fans. Members' opinions (the same `opinions` as «Тебе понравится»: taste ratings, favourites, repeated cans in the
 *    tracker, dating swipes). For every member with a clear opinion of this drink, their opinion of another drink
 *    counts with the sign of this one: liked both, or disliked both, pulls it up; liked one and not the other pushes
 *    it down. A weighted mean, pulled towards 0 while few members know both.
 * 2. Content. The same flavour families (`tasteTokens`: mango, cherry…), or the same flavour at another brand; the
 *    same brand a little; sugar-free next to sugar-free.
 * 3. A little for how the community rates it, and for being in shops.
 *
 * The viewer's own drinks (tried, rated, swiped) go after the ones they do not know yet; at most three of one brand.
 */

export const SIMILAR_LIMIT = 10;
/** Fewer than this many and the block is not shown. */
export const SIMILAR_MIN = 3;
const PER_BRAND = 3;
/** Opinions closer to 0 than this say nothing about the drink. */
const CLEAR = 0.2;
const LIKES = 0.3;

export interface SimilarCandidate extends Preference { inStock: boolean; taste?: number; reviews?: number }
export type SimilarReason =
  | { kind: 'fans'; fans: number }
  | { kind: 'version'; label: 'без сахара' | 'с сахаром' | 'с соком' | 'без сока' | null }
  | { kind: 'flavor'; token: string }
  | { kind: 'same' }
  | { kind: 'sugarfree' }
  | { kind: 'brand'; brand: string }
  | { kind: 'rated'; taste: number };
export interface SimilarDrink extends Preference { score: number; reason: SimilarReason | null }

const flavorOf = (item: Preference) => canonicalProductFlavor(item.brand, item.flavor);
const isSugarFree = (flavor: string) => /:(sugarfree|sweetener)\b/.test(flavor) || flavor === 'sugarfree';
const hasJuice = (flavor: string) => /:juice\b/.test(flavor);
/**
 * The flavour without its sugar and juice marks: `mango:juice:sugarfree` and `mango` are one taste. A bare `sugarfree`
 * card («Без сахара») is the brand's original without sugar.
 */
const baseFlavor = (flavor: string) => flavor === 'sugarfree' ? 'original' : flavor.replace(/:(sugarfree|sweetener|juice)\b/g, '');

/** How many flavours a key mixes: `blend:apricot+mango` is two. */
const components = (base: string) => base.replace(/^blend:/, '').split('+').length;

function versionLabel(target: string, other: string): Extract<SimilarReason, { kind: 'version' }>['label'] {
  if (isSugarFree(other) !== isSugarFree(target)) return isSugarFree(other) ? 'без сахара' : 'с сахаром';
  if (hasJuice(other) !== hasJuice(target)) return hasJuice(other) ? 'с соком' : 'без сока';
  return null;
}

/** For every other drink: how members who know this one feel about it, signed by how they feel about this one. */
function fanScores(targetKey: string, members: Opinions[]) {
  const result = new Map<string, { sum: number; weight: number; fans: number }>();
  for (const opinions of members) {
    const mine = opinions.get(targetKey)?.score;
    if (mine === undefined || Math.abs(mine) < CLEAR) continue;
    for (const [key, { score }] of opinions) {
      if (key === targetKey || Math.abs(score) < CLEAR / 2) continue;
      const entry = result.get(key) ?? { sum: 0, weight: 0, fans: 0 };
      entry.sum += mine * score; entry.weight += Math.abs(mine);
      if (mine > LIKES && score > LIKES) entry.fans++;
      result.set(key, entry);
    }
  }
  return result;
}

export function rankSimilarDrinks(target: Preference, candidates: SimilarCandidate[], members: Opinions[], { limit = SIMILAR_LIMIT, tried = new Set<string>() }: { limit?: number; tried?: ReadonlySet<string> } = {}): SimilarDrink[] {
  const targetKey = drinkKey(target);
  const targetFlavor = flavorOf(target), targetBase = baseFlavor(targetFlavor), targetTokens = tasteTokens(target);
  const brand = target.brand.toLocaleLowerCase('ru');
  const fans = fanScores(targetKey, members);
  const seen = new Set([targetKey]);
  const ranked: (SimilarDrink & { tried: boolean; reviews: number })[] = [];

  for (const candidate of candidates) {
    const key = drinkKey(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    const flavor = flavorOf(candidate), tokens = tasteTokens(candidate);
    const sameBrand = candidate.brand.toLocaleLowerCase('ru') === brand;
    const sameBase = baseFlavor(flavor) === targetBase;
    const shared = targetTokens.filter(token => tokens.includes(token));
    // A mix shares only part of its taste: «Абрикос + Манго» is half a mango drink, even when apricot is no family.
    const parts = Math.max(new Set([...targetTokens, ...tokens]).size, components(targetBase), components(baseFlavor(flavor)));
    const flavorMatch = sameBase ? 1 : shared.length ? shared.length / parts : 0;
    const sugar = isSugarFree(flavor) && isSugarFree(targetFlavor) ? 0.1 : isSugarFree(flavor) !== isSugarFree(targetFlavor) ? -0.05 : 0;
    const content = 0.7 * flavorMatch + 0.2 * Number(sameBrand) + sugar;

    const fan = fans.get(key);
    const collaborative = fan ? fan.sum / (fan.weight + 1.5) : 0;
    const reviews = candidate.reviews ?? 0;
    const quality = reviews && candidate.taste ? (candidate.taste - 6) / 4 * reviews / (reviews + 3) : 0;
    const score = 0.5 * collaborative + 0.4 * content + 0.1 * quality + (candidate.inStock ? 0.05 : 0);
    // Disliked by those who like this one, or nothing in common at all: not a suggestion.
    if (score <= 0.02) continue;

    const reason: SimilarReason | null = sameBrand && sameBase ? { kind: 'version', label: versionLabel(targetFlavor, flavor) }
      // Two members who like both are already worth saying; one needs a clearer lead.
      : fan && fan.fans >= 2 && collaborative > 0.08 ? { kind: 'fans', fans: fan.fans }
      : shared[0] ? { kind: 'flavor', token: shared[0] }
      : sameBase ? { kind: 'same' }
      : isSugarFree(flavor) && isSugarFree(targetFlavor) ? { kind: 'sugarfree' }
      : sameBrand ? { kind: 'brand', brand: candidate.brand }
      : fan && fan.fans >= 1 && collaborative > 0.15 ? { kind: 'fans', fans: fan.fans }
      : reviews >= 3 && candidate.taste ? { kind: 'rated', taste: Math.round(candidate.taste * 10) / 10 }
      : null;
    ranked.push({ brand: candidate.brand, flavor: candidate.flavor, score, reason, tried: tried.has(key), reviews });
  }

  // Not tried yet first; within each, the closest match, then the better-known drink.
  ranked.sort((a, b) => Number(a.tried) - Number(b.tried) || b.score - a.score || b.reviews - a.reviews || a.flavor.localeCompare(b.flavor));
  const perBrand = new Map<string, number>();
  return ranked.filter(drink => {
    const name = drink.brand.toLocaleLowerCase('ru'), count = perBrand.get(name) ?? 0;
    if (count >= PER_BRAND) return false;
    perBrand.set(name, count + 1);
    return true;
  }).slice(0, limit).map(({ brand, flavor, score, reason }) => ({ brand, flavor, score, reason }));
}

/** The line under a suggested drink, in the site's words. */
export function similarReasonText(reason: SimilarReason): string {
  switch (reason.kind) {
    case 'fans': return 'Нравится тем, кому нравится этот';
    case 'version': return reason.label ? `Этот же вкус ${reason.label}` : 'Другая версия этого вкуса';
    case 'flavor': return `Тоже с ${FLAVOR_TOKENS[reason.token] ?? reason.token}`;
    case 'same': return 'Тот же вкус';
    case 'sugarfree': return 'Тоже без сахара';
    case 'brand': return `Ещё от ${reason.brand}`;
    case 'rated': return `Вкус на ${reason.taste.toLocaleString('ru-RU')} из 10`;
  }
}
