import { Buffer } from 'node:buffer';
import {
  ENERGY_DRINK_BRAND_ALIASES,
  type CatalogGroup,
  type FlavorVariant,
  type SourceName,
} from '@canrush/shared';

export const CATALOG_SORTS = ['deals', 'brand', 'stores', 'price-desc'] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number];

const SOURCE_NAMES: Record<SourceName, string> = {
  edadeal: 'Едадил',
  wildberries: 'Wildberries',
  ozon: 'Ozon',
  pyaterochka: 'Пятёрочка',
  magnit: 'Магнит',
  lenta: 'Лента',
};

export interface CatalogFilters {
  query: string;
  brand: string;
  flavor: string;
  sort: CatalogSort;
}

const FLAVOR_NAMES: Record<string, string> = {
  original: 'Оригинальный',
  apple: 'Яблоко',
  kiwi: 'Киви',
  tropical: 'Тропический',
  watermelon: 'Арбуз',
  cherry: 'Вишня',
  citrus: 'Цитрус',
  lemon: 'Лимон',
  lime: 'Лайм',
  orange: 'Апельсин',
  mango: 'Манго',
  strawberry: 'Клубника',
  raspberry: 'Малина',
  cola: 'Кола',
  berry: 'Ягодный',
  grape: 'Виноград',
  pineapple: 'Ананас',
  peach: 'Персик',
  melon: 'Дыня',
  mint: 'Мята',
  coconut: 'Кокос',
  vanilla: 'Ваниль',
  guava: 'Гуава',
  pomegranate: 'Гранат',
  blueberry: 'Голубика и черника',
  blue_raspberry: 'Голубая малина',
  passion_fruit: 'Маракуйя',
  calamansi: 'Каламанси',
  irga: 'Ирга',
  yuzu: 'Юдзу',
  barberry: 'Барбарис',
  cactus: 'Кактус',
  pomelo: 'Помело',
  cranberry: 'Клюква',
  banana: 'Банан',
  feijoa: 'Фейхоа',
  lulo: 'Луло',
  bubblegum: 'Жевательная резинка',
  grapefruit: 'Грейпфрут',
  apricot: 'Абрикос',
  plum: 'Слива',
  blackcurrant: 'Чёрная смородина',
  dragonfruit: 'Драконий фрукт',
  pear: 'Груша',
  elderflower: 'Бузина',
  acai: 'Асаи',
  unknown: 'Вкус не указан',
};

export function flavorName(flavor: string): string {
  return FLAVOR_NAMES[flavor] ?? flavor;
}

export function catalogRetailerName(variant: FlavorVariant): string {
  return variant.retailer ?? SOURCE_NAMES[variant.source];
}

export function catalogOffers(group: CatalogGroup): FlavorVariant[] {
  const byRetailerAndVolume = new Map<string, FlavorVariant>();
  for (const variant of group.variants) {
    const key = `${catalogRetailerName(variant).toLocaleLowerCase('ru-RU')}\u0000${variant.volumeMl ?? 'unknown'}`;
    const existing = byRetailerAndVolume.get(key);
    if (!existing || variant.price < existing.price) byRetailerAndVolume.set(key, variant);
  }
  return [...byRetailerAndVolume.values()].sort((left, right) => left.price - right.price);
}

export function catalogOffersByVolume(group: CatalogGroup): { volumeMl: number | undefined; offers: FlavorVariant[] }[] {
  const volumes = new Map<number | undefined, FlavorVariant[]>();
  for (const offer of catalogOffers(group)) {
    const offers = volumes.get(offer.volumeMl) ?? [];
    offers.push(offer);
    volumes.set(offer.volumeMl, offers);
  }
  return [...volumes.entries()]
    .sort(([left], [right]) => (left ?? Infinity) - (right ?? Infinity))
    .map(([volumeMl, offers]) => ({ volumeMl, offers }));
}

function normalizeText(value: string): string {
  return value.toLocaleLowerCase('ru-RU').replace(/ё/gu, 'е').trim();
}

function compactText(value: string): string {
  return normalizeText(value).replace(/[^a-zа-я0-9]+/gu, '');
}

function matchesCatalogQuery(group: CatalogGroup, query: string): boolean {
  const variants = group.variants.flatMap((variant) => {
    const volume = variant.volumeMl;
    return [catalogRetailerName(variant), volume === undefined ? '' : `${volume} мл ${volume / 1000} л`];
  });
  const brandAliases = ENERGY_DRINK_BRAND_ALIASES[group.brand] ?? [];
  const haystack = normalizeText(
    [group.brand, ...brandAliases, group.flavor, flavorName(group.flavor), ...variants].join(' '),
  );
  const compactHaystack = compactText(haystack);
  const compactQuery = compactText(query);
  if (!compactQuery) return true;
  if (compactHaystack.includes(compactQuery)) return true;
  return normalizeText(query)
    .split(/[^a-zа-я0-9]+/gu)
    .filter(Boolean)
    .every((term) => compactHaystack.includes(compactText(term)));
}

export function catalogRetailerCount(group: CatalogGroup): number {
  return new Set(group.variants.map((variant) => variant.retailer ?? variant.source)).size;
}

export function isCatalogSort(value: string): value is CatalogSort {
  return CATALOG_SORTS.includes(value as CatalogSort);
}

export function filterCatalogGroups(groups: CatalogGroup[], filters: CatalogFilters): CatalogGroup[] {
  const filtered = groups.filter((group) => {
    if (filters.brand && group.brand !== filters.brand) return false;
    if (filters.flavor && group.flavor !== filters.flavor) return false;
    return matchesCatalogQuery(group, filters.query);
  });

  return filtered.sort((left, right) => {
    if (filters.sort === 'brand') {
      return left.brand.localeCompare(right.brand, 'ru-RU') || left.flavor.localeCompare(right.flavor, 'ru-RU');
    }
    if (filters.sort === 'stores') {
      return catalogRetailerCount(right) - catalogRetailerCount(left) || left.minPrice - right.minPrice;
    }
    if (filters.sort === 'price-desc') return right.minPrice - left.minPrice;
    return left.minPrice - right.minPrice || catalogRetailerCount(right) - catalogRetailerCount(left);
  });
}

export function catalogGroupSlug(brand: string, flavor: string): string {
  return Buffer.from(JSON.stringify([brand, flavor]), 'utf-8').toString('base64url');
}

export function decodeCatalogGroupSlug(slug: string): { brand: string; flavor: string } | null {
  if (!slug || slug.length > 512) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(slug, 'base64url').toString('utf-8'));
    if (!Array.isArray(parsed) || parsed.length !== 2) return null;
    const [brand, flavor] = parsed;
    if (typeof brand !== 'string' || typeof flavor !== 'string' || !brand || !flavor) return null;
    return { brand, flavor };
  } catch {
    return null;
  }
}
