/**
 * Подсказки поиска каталога, пока человек печатает: только бренды. «Adrena» → Adrenaline Rush; «манго» → бренды, у
 * которых есть манго, и выбор такого бренда ищет «Burn манго». Без базы: индекс строит `search-suggest.ts`, сюда
 * приходят только напитки и их популярность.
 *
 * Бренд находится по любому своему написанию (`brandSearchTerms`: имя, псевдонимы парсера и поиска, транслитерация):
 * сначала то, что начинается с набранного, потом то, где каждое слово запроса — начало какого-то слова, потом опечатки.
 * Потом — бренды, чьи напитки подходят по вкусу или полному названию. Набранное в другой раскладке («фвкутф») тоже
 * находится, если обычный запрос ничего не дал.
 */
import { flavorName } from '@/lib/catalog-query';
import { brandSearchTerms, transliterate } from '@/lib/search-aliases';
import { searchMatches } from '@/lib/search-match';

export const SUGGEST_BRANDS = 6;
export const SUGGEST_MAX_QUERY = 40;

export interface SuggestDrink { brand: string; flavor: string; cover?: string; fullName?: string }
/**
 * Бренд в подсказках: всего напитков, сколько подходит под набранное (0 — подошло само название бренда) и что искать
 * по нажатию — имя бренда или бренд вместе с набранным вкусом.
 */
export interface Suggestion { brand: string; drinks: number; matched: number; query: string; cover?: string }

interface BrandEntry { brand: string; phrases: string[]; words: string[]; drinks: number; weight: number; cover?: string }
interface DrinkEntry { brand: string; flavor: string; name: string; nameKey: string; cover?: string; brandWords: string[]; words: string[]; weight: number }
export interface SuggestIndex { brands: BrandEntry[]; drinks: DrinkEntry[] }

export const normalizeQuery = (value: string) => value.toLocaleLowerCase('ru-RU').replace(/ё/gu, 'е').replace(/[^a-zа-я0-9]+/gu, ' ').trim();
const wordsOf = (values: readonly string[]) => [...new Set(values.flatMap(value => normalizeQuery(value).split(' ')).filter(Boolean))];

/**
 * Индекс: бренды с числом напитков и обложкой самого популярного, напитки с их словами. `popularity` — сколько раз
 * напиток смотрели и оценивали; он решает порядок при равном совпадении.
 */
export function buildSuggestIndex(drinks: readonly SuggestDrink[], popularity: ReadonlyMap<string, number> = new Map()): SuggestIndex {
  const weightOf = (drink: SuggestDrink) => popularity.get(JSON.stringify([drink.brand, drink.flavor])) ?? 0;
  const byBrand = new Map<string, SuggestDrink[]>();
  for (const drink of drinks) byBrand.set(drink.brand, [...(byBrand.get(drink.brand) ?? []), drink]);
  const brands = [...byBrand].map(([brand, items]): BrandEntry => {
    const terms = brandSearchTerms(brand);
    const top = [...items].sort((a, b) => weightOf(b) - weightOf(a)).find(item => item.cover);
    return { brand, phrases: terms.map(normalizeQuery), words: wordsOf(terms), drinks: items.length, weight: items.reduce((sum, item) => sum + weightOf(item), 0), cover: top?.cover };
  });
  const brandWords = new Map(brands.map(entry => [entry.brand, entry.words]));
  return {
    brands,
    drinks: drinks.map(drink => {
      const name = flavorName(drink.flavor);
      const own = [name, transliterate(name), drink.flavor.replace(/[:_+]/g, ' '), ...(drink.fullName ? [drink.fullName, transliterate(drink.fullName)] : [])];
      return { brand: drink.brand, flavor: drink.flavor, name, nameKey: normalizeQuery(name), cover: drink.cover, brandWords: brandWords.get(drink.brand) ?? [], words: wordsOf(own), weight: weightOf(drink) };
    }),
  };
}

/** Начало слова; длинному слову прощается опечатка в набранном начале. */
function prefixOf(term: string, word: string): boolean {
  if (word.startsWith(term)) return true;
  if (term.length < 5) return false;
  return searchMatches(word.slice(0, term.length), term);
}

/** Насколько бренд подходит: 3 — написание начинается с набранного, 2 — каждое слово запроса начинает слово, 1 — опечатка. */
function brandScore(entry: BrandEntry, query: string, terms: readonly string[]): number {
  if (entry.phrases.some(phrase => phrase.startsWith(query))) return 3;
  if (terms.every(term => entry.words.some(word => word.startsWith(term)))) return 2;
  if (query.length >= 4 && terms.every(term => entry.words.some(word => prefixOf(term, word)))) return 1;
  return 0;
}

/**
 * Подходит ли напиток: каждое слово запроса — начало слова бренда или вкуса, и хотя бы одно — из вкуса (иначе это
 * просто бренд). `leads` — вкус начинается с набранного («Манго», а не «Абрикос + Манго»).
 */
function drinkMatch(entry: DrinkEntry, terms: readonly string[]): { brand: boolean; leads: boolean } | null {
  let brand = false, flavor = false;
  for (const term of terms) {
    const inFlavor = entry.words.some(word => prefixOf(term, word));
    const inBrand = entry.brandWords.some(word => prefixOf(term, word));
    if (!inFlavor && !inBrand) return null;
    flavor ||= inFlavor; brand ||= inBrand;
  }
  return flavor ? { brand, leads: terms.some(term => entry.nameKey.startsWith(term)) } : null;
}

const LATIN_KEYS = 'qwertyuiop[]asdfghjkl;\'zxcvbnm,.`';
const CYRILLIC_KEYS = 'йцукенгшщзхъфывапролджэячсмитьбюё';
/** Тот же набор клавиш в другой раскладке: «фвкутф» → «adrena», «ghbdtn» → «привет». */
export function swapLayout(value: string): string {
  return [...value.toLocaleLowerCase('ru-RU')].map(char => {
    const latin = LATIN_KEYS.indexOf(char);
    if (latin >= 0) return CYRILLIC_KEYS[latin]!;
    const cyrillic = CYRILLIC_KEYS.indexOf(char);
    return cyrillic >= 0 ? LATIN_KEYS[cyrillic]! : char;
  }).join('');
}

function rank(index: SuggestIndex, raw: string): Suggestion[] {
  const query = normalizeQuery(raw);
  const terms = query.split(' ').filter(Boolean);
  if (!terms.length) return [];
  const typed = raw.trim().replace(/\s+/g, ' ');
  const named = index.brands.map(entry => ({ entry, score: brandScore(entry, query, terms) })).filter(item => item.score > 0)
    // Equal matches: the more viewed and reviewed brand first, its number of drinks as a small head start.
    .sort((a, b) => b.score - a.score || (b.entry.weight + b.entry.drinks) - (a.entry.weight + a.entry.drinks) || a.entry.brand.localeCompare(b.entry.brand, 'ru'));
  const result: Suggestion[] = named.map(({ entry }) => ({ brand: entry.brand, drinks: entry.drinks, matched: 0, query: entry.brand, ...(entry.cover ? { cover: entry.cover } : {}) }));

  // Brands whose drinks fit by flavour: the most matching drinks first, a flavour that leads before a mix that has it.
  const byBrand = new Map<string, { matched: number; leads: number; weight: number; named: boolean; cover?: string; coverWeight: number }>();
  for (const entry of index.drinks) {
    if (named.some(item => item.entry.brand === entry.brand)) continue;
    const match = drinkMatch(entry, terms);
    if (!match) continue;
    const hit = byBrand.get(entry.brand) ?? { matched: 0, leads: 0, weight: 0, named: false, coverWeight: -1 };
    hit.matched++; hit.leads += Number(match.leads); hit.weight += entry.weight; hit.named ||= match.brand;
    if (entry.cover && entry.weight > hit.coverWeight) { hit.cover = entry.cover; hit.coverWeight = entry.weight; }
    byBrand.set(entry.brand, hit);
  }
  const total = new Map(index.brands.map(entry => [entry.brand, entry.drinks]));
  const byFlavor = [...byBrand].sort(([a, x], [b, y]) => Number(y.named) - Number(x.named) || y.leads - x.leads || y.matched - x.matched || y.weight - x.weight || a.localeCompare(b, 'ru'));
  for (const [brand, hit] of byFlavor) result.push({
    brand, drinks: total.get(brand) ?? hit.matched, matched: hit.matched,
    // «adre ман» already names the brand; «манго» gets it in front, so the search lands on that brand's mango.
    query: hit.named ? typed : `${brand} ${typed}`, ...(hit.cover ? { cover: hit.cover } : {}),
  });
  return result.slice(0, SUGGEST_BRANDS);
}

/** Подсказки к набранному; пусто — попытка в другой раскладке. */
export function suggest(index: SuggestIndex, raw: string): Suggestion[] {
  const value = raw.slice(0, SUGGEST_MAX_QUERY);
  const found = rank(index, value);
  return found.length ? found : rank(index, swapLayout(value));
}
