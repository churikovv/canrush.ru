import { normalizeText } from '@/lib/catalog-query';
import { brandSearchTerms } from '@/lib/search-aliases';
import type { StoreDrinkOption } from '@/lib/store-catalog';

/** Сколько фото магазина смотрит нейросеть: каждое — два запроса, а дальше обычно те же полки. */
export const STORE_SCAN_PHOTOS = 3;
const MAX_OPTIONS = 150;
const MAX_OTHERS = 10;

export interface SeenDrink { brand: string; flavor: string }

/** Бренд — только марка, остальное — вкус: иначе модель писала «Monster Nitro» в бренд и оставляла вкус пустым. Угадывать по рисунку не просим: так она придумывала вкусы. */
export const SEEN_DRINKS_PROMPT = 'На фото витрина или холодильник магазина. Перечисли все разные энергетические напитки, которые видно на фото, каждый по одному разу. Для каждого укажи бренд — только марку, как на банке (Monster, Red Bull, Burn, Flash Up), — и вкус: всё остальное название с банки, линейку и вкус (Ultra Paradise, Juiced Mango Loco, Nitro, Zero Sugar, Тропический). Пиши только то, что читается на банке; если вкус не прочитать, поставь пустую строку. Газировку, соки, чай и пиво не перечисляй. Ответь только JSON-массивом вида [{"brand":"...","flavor":"..."}]. Если энергетиков нет, ответь [].';

/**
 * Второй вопрос уже без фото: на него модель отмечала половину списка. Каждой увиденной банке — один номер или ничего, а банке не из
 * каталога — короткое название: одна и та же банка с двух фото иначе становилась тремя подсказками («Punch Pacific Punch»).
 */
export const matchDrinksPrompt = (seen: readonly SeenDrink[], options: readonly StoreDrinkOption[]) => `Банки с фото магазина:\n${seen.map((drink, index) => `${index + 1}. ${drink.brand} ${drink.flavor}`.trim()).join('\n')}\n\nКаталог напитков:\n${options.map((option, index) => `${index + 1}. ${option.label}`).join('\n')}\n\nДля каждой банки укажи номер этого же напитка в каталоге. Названия могут быть написаны по-разному: Tropical и Тропический, Energy и Оригинальный. Если такого напитка в каталоге нет, поставь 0 и напиши в name короткое название, как его назвал бы покупатель (Monster Pacific Punch); одному напитку — одно name. Если у банки написана только линейка без вкуса (Ultra, Juiced, Punch), поставь 0 и пустое name. Ответь только JSON-массивом вида [{"can":1,"item":12},{"can":2,"item":0,"name":"..."}].`;

/** Ответ модели — данные, а не команда: берём только первый JSON-массив и только нужные поля. */
function jsonArray(reply: string): unknown[] {
  const match = /\[[\s\S]*\]/u.exec(reply);
  if (!match) return [];
  try {
    const value: unknown = JSON.parse(match[0]);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function parseSeenDrinks(reply: string): SeenDrink[] {
  return jsonArray(reply).flatMap(item => {
    if (typeof item !== 'object' || item === null) return [];
    const { brand, flavor } = item as { brand?: unknown; flavor?: unknown };
    if (typeof brand !== 'string' || brand.trim().length < 2) return [];
    return [{ brand: brand.trim().slice(0, 60), flavor: typeof flavor === 'string' ? flavor.trim().slice(0, 60) : '' }];
  });
}

/** Регистр, пробелы и надстрочные знаки («Rosá») не делают банку другой. */
export const seenKey = (value: string) => normalizeText(value).normalize('NFKD').replace(/\p{M}/gu, '').replace(/\s+/gu, ' ');

/** Несколько чтений одного фото — один список: та же банка, написанная иначе, остаётся одной. */
export function mergeSeenDrinks(reads: readonly (readonly SeenDrink[])[]): SeenDrink[] {
  const merged = new Map<string, SeenDrink>();
  for (const drink of reads.flat()) {
    const key = `${seenKey(drink.brand)}|${seenKey(drink.flavor)}`;
    if (!merged.has(key)) merged.set(key, drink);
  }
  return [...merged.values()];
}

/** Пары «банка — номер»: одна запись на банку, всё, чего нет в списках, выбрасываем. */
export function parseMatches(reply: string, cans: number, items: number) {
  const matches = new Map<number, number>();
  for (const entry of jsonArray(reply)) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { can, item } = entry as { can?: unknown; item?: unknown };
    if (Number.isInteger(can) && Number.isInteger(item) && (can as number) >= 1 && (can as number) <= cans && (item as number) >= 1 && (item as number) <= items && !matches.has(can as number)) matches.set(can as number, item as number);
  }
  return matches;
}

/** Названия банок не из каталога по номеру банки; пустое — только линейка без вкуса, такую подсказку не показываем. */
export function parseOtherNames(reply: string, cans: number) {
  const names = new Map<number, string>();
  for (const entry of jsonArray(reply)) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { can, item, name } = entry as { can?: unknown; item?: unknown; name?: unknown };
    if (Number.isInteger(can) && (can as number) >= 1 && (can as number) <= cans && item === 0 && typeof name === 'string' && !names.has(can as number)) names.set(can as number, name.trim().slice(0, 60));
  }
  return names;
}

/** Линейки, которые сами по себе не напиток: «Monster Juiced» в подсказке ничего не говорит, участник выберет вкус сам. */
const BARE_LINES = new Set(['ultra', 'juiced', 'punch', 'rehab', 'reserve', 'energy drink']);
export const isBareLine = (flavor: string) => BARE_LINES.has(seenKey(flavor));

/** Подсказки «+ название» без повторов, не больше десяти. */
export function uniqueNames(names: Iterable<string>) {
  const unique = new Map<string, string>();
  for (const name of names) if (name && !unique.has(seenKey(name))) unique.set(seenKey(name), name);
  return [...unique.values()].slice(0, MAX_OTHERS);
}

/** Подходит ли написанное на банке к бренду каталога: «Flash» — это Flash Up, «Adrenaline» — Adrenaline Rush. */
function sameBrand(seen: string, brand: string) {
  const name = normalizeText(seen);
  if (name.length < 3) return false;
  return brandSearchTerms(brand).map(normalizeText).some(term => term === name || term.startsWith(`${name} `) || name.startsWith(`${term} `));
}

/**
 * Банки брендов из каталога идут во второй вопрос вместе с напитками этих брендов. Банка без вкуса туда не идёт: модель подставляла
 * «Оригинальный» даже там, где на фото был апельсиновый Burn, поэтому такой бренд только показываем участнику.
 */
export function splitSeenDrinks(seen: readonly SeenDrink[], options: readonly StoreDrinkOption[]) {
  const brands = [...new Set(options.map(option => option.brand))];
  const known = new Set<string>();
  const cans: SeenDrink[] = [];
  const unread = new Set<string>();
  const others: string[] = [];
  for (const drink of seen) {
    const matched = brands.filter(brand => sameBrand(drink.brand, brand));
    if (!matched.length) others.push(`${drink.brand} ${drink.flavor}`.trim());
    else if (!drink.flavor) unread.add(matched[0]!);
    else { matched.forEach(brand => known.add(brand)); cans.push(drink); }
  }
  return { cans, unread: [...unread], options: options.filter(option => known.has(option.brand)).slice(0, MAX_OPTIONS), others: [...new Set(others)].slice(0, MAX_OTHERS) };
}
