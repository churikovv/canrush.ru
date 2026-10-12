import { canonicalProductFlavor, isResolvedFlavor } from '@canrush/shared';

export interface Preference { brand: string; flavor: string }
export interface RatedPreference extends Preference { taste: number; design: number }
export interface PreferenceProfile { favorites: Preference[]; reviews: RatedPreference[] }
export interface CompatibilityPart { label: string; score: number | null; weight: number; count: number }
const key = (item: Preference) => JSON.stringify([item.brand, canonicalProductFlavor(item.brand, item.flavor)]);
const unique = <T extends Preference>(items: T[]) => [...new Map(items.filter(item => isResolvedFlavor(canonicalProductFlavor(item.brand, item.flavor))).map(item => [key(item), item])).values()];
// Only explicit flavor tokens; an edition name or “original” is not a taste family.
const flavors = new Set(['apple', 'mango', 'peach', 'pear', 'lychee', 'cherry', 'berry', 'blueberry', 'raspberry', 'strawberry', 'watermelon', 'grapefruit', 'lemon', 'lime', 'citrus', 'orange', 'pineapple', 'guava', 'passion_fruit', 'pomegranate', 'grape', 'coconut']);
function tasteTokens(item: Preference) {
  const flavor = canonicalProductFlavor(item.brand, item.flavor).replace(':sugarfree', '').replace('passion_fruit', 'passionfruit');
  return [...new Set(flavor.split(/[^a-z]+/).map(token => token === 'passionfruit' ? 'passion_fruit' : token).filter(token => flavors.has(token)))];
}
function distribution(items: Preference[], tokens: (item: Preference) => string[]) {
  const counts = new Map<string, number>();
  for (const item of items) { const values = tokens(item); for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1 / values.length); }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  return new Map([...counts].map(([name, count]) => [name, count / total]));
}
function overlap(a: Map<string, number>, b: Map<string, number>) {
  return [...a].reduce((sum, [name, share]) => sum + Math.min(share, b.get(name) ?? 0), 0) * 100;
}
/** Symmetric descriptive similarity, not a prediction or a probability. Missing signals have no weight. */
export function profileCompatibility(left: PreferenceProfile, right: PreferenceProfile) {
  const a = unique(left.favorites), b = unique(right.favorites);
  // For legacy duplicates keep the newest review (the data loader orders by updatedAt descending).
  const reviews = (items: RatedPreference[]) => unique([...items].reverse()).filter(item => [item.taste, item.design].every(n => Number.isFinite(n) && n >= 1 && n <= 10));
  const ar = reviews(left.reviews), br = new Map(reviews(right.reviews).map(item => [key(item), item]));
  const pairs = ar.flatMap(item => { const other = br.get(key(item)); return other ? [[item, other] as const] : []; });
  const bKeys = new Set(b.map(key));
  const common = a.filter(item => bKeys.has(key(item))).length;
  const enoughFavorites = Math.min(a.length, b.length) >= 3;
  const ta = a.filter(item => tasteTokens(item).length), tb = b.filter(item => tasteTokens(item).length);
  const ratingScore = (field: 'taste' | 'design') => pairs.length >= 3 ? 100 * (1 - pairs.reduce((sum, [x, y]) => sum + Math.abs(x[field] - y[field]), 0) / (pairs.length * 9)) : null;
  const parts: CompatibilityPart[] = [
    { label: 'Общие избранные напитки', score: enoughFavorites ? 200 * common / (a.length + b.length) : null, weight: 40, count: common },
    { label: 'Любимые бренды', score: enoughFavorites ? overlap(distribution(a, item => [item.brand]), distribution(b, item => [item.brand])) : null, weight: 15, count: Math.min(a.length, b.length) },
    { label: 'Вкусы в избранном', score: Math.min(ta.length, tb.length) >= 3 ? overlap(distribution(ta, tasteTokens), distribution(tb, tasteTokens)) : null, weight: 15, count: Math.min(ta.length, tb.length) },
    { label: 'Оценки вкуса', score: ratingScore('taste'), weight: 20, count: pairs.length },
    { label: 'Оценки дизайна', score: ratingScore('design'), weight: 10, count: pairs.length },
  ];
  const available = parts.filter(part => part.score !== null);
  const weight = available.reduce((sum, part) => sum + part.weight, 0);
  return {
    score: weight ? Math.round(available.reduce((sum, part) => sum + part.score! * part.weight, 0) / weight) : null,
    parts, common, sharedReviews: pairs.length, favoriteCounts: [a.length, b.length],
    confidence: enoughFavorites && Math.min(a.length, b.length) >= 10 && pairs.length >= 5 ? 'Данных достаточно' : 'Предварительное сравнение',
  };
}
