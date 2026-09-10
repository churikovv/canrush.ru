import type { BrandAliases, FlavorAliases, Product, SourceName } from '@canrush/shared';

export interface RawProductInput {
  sourceId: string;
  name: string;
  brand?: string;
  /** Вкус, если источник предоставляет его явно (иначе извлекается из name) */
  flavor?: string;
  price: number;
  oldPrice?: number;
  url: string;
  imageUrl?: string;
  category?: string;
}

/** Пытается извлечь объём в мл из названия товара, например "Red Bull 0.355л" -> 355 */
export function extractVolumeMl(name: string): number | undefined {
  // ВАЖНО: \b в JS-регулярках без флага u не считает кириллицу "word char",
  // поэтому \b после «л»/«мл» не срабатывает на конце строки. Используем
  // негативный lookahead по буквам, чтобы не матчить «л» внутри «литра» и т.п.
  const literValue = name.match(/(\d+(?:[.,]\d+)?)\s*л(?![a-zа-яё])/i)?.[1];
  if (literValue) {
    return Math.round(parseFloat(literValue.replace(',', '.')) * 1000);
  }
  const mlValue = name.match(/(\d+(?:[.,]\d+)?)\s*мл(?![a-zа-яё])/i)?.[1];
  if (mlValue) {
    return Math.round(parseFloat(mlValue.replace(',', '.')));
  }
  return undefined;
}

function normalizeBrandText(value: string): string {
  return value
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gu, ' ')
    .trim();
}

function brandCandidates(knownBrands: string[], aliases: BrandAliases): Array<{ alias: string; canonical: string }> {
  return knownBrands
    .flatMap((canonical) => [canonical, ...(aliases[canonical] ?? [])].map((alias) => ({ alias, canonical })))
    .sort((a, b) => normalizeBrandText(b.alias).length - normalizeBrandText(a.alias).length);
}

/** Пытается определить бренд из названия товара по списку известных брендов. */
export function detectBrand(
  name: string,
  knownBrands: string[],
  aliases: BrandAliases = {},
): string | undefined {
  const normalizedName = ` ${normalizeBrandText(name)} `;
  return brandCandidates(knownBrands, aliases).find(({ alias }) =>
    normalizedName.includes(` ${normalizeBrandText(alias)} `),
  )?.canonical;
}

export function canonicalizeBrand(brand: string, knownBrands: string[], aliases: BrandAliases = {}): string {
  const normalizedBrand = normalizeBrandText(brand);
  return (
    brandCandidates(knownBrands, aliases).find(({ alias }) => normalizeBrandText(alias) === normalizedBrand)?.canonical ??
    brand.trim()
  );
}

function flavorCandidates(
  knownFlavors: string[],
  aliases: FlavorAliases,
): Array<{ alias: string; canonical: string }> {
  return knownFlavors
    .flatMap((canonical) => [canonical, ...(aliases[canonical] ?? [])].map((alias) => ({ alias, canonical })))
    .sort(
      (a, b) =>
        Number(a.canonical === 'original') - Number(b.canonical === 'original') ||
        normalizeBrandText(b.alias).length - normalizeBrandText(a.alias).length,
    );
}

/** Пытается определить вкус из названия товара по списку известных вкусов и алиасов. */
export function detectFlavor(
  name: string,
  knownFlavors: string[],
  aliases: FlavorAliases = {},
): string | undefined {
  const normalizedName = ` ${normalizeBrandText(name)} `;
  return flavorCandidates(knownFlavors, aliases).find(({ alias }) =>
    normalizedName.includes(` ${normalizeBrandText(alias)} `),
  )?.canonical;
}

/** Приводит вкус от источника к каноническому названию, неизвестные — сохраняет как есть. */
export function canonicalizeFlavor(
  flavor: string,
  knownFlavors: string[],
  aliases: FlavorAliases = {},
): string {
  const normalized = normalizeBrandText(flavor);
  return (
    flavorCandidates(knownFlavors, aliases).find(({ alias }) => normalizeBrandText(alias) === normalized)?.canonical ??
    flavor.trim()
  );
}

/** Приводит данные конкретного источника к единой схеме Product. */
export function normalizeProduct(
  source: SourceName,
  raw: RawProductInput,
  knownBrands: string[] = [],
  fetchedAt: string = new Date().toISOString(),
  brandAliases: BrandAliases = {},
  knownFlavors: string[] = [],
  flavorAliases: FlavorAliases = {},
): Product {
  return {
    source,
    sourceId: raw.sourceId,
    name: raw.name.trim(),
    brand: raw.brand
      ? canonicalizeBrand(raw.brand, knownBrands, brandAliases)
      : detectBrand(raw.name, knownBrands, brandAliases),
    flavor: raw.flavor
      ? canonicalizeFlavor(raw.flavor, knownFlavors, flavorAliases)
      : detectFlavor(raw.name, knownFlavors, flavorAliases),
    volumeMl: extractVolumeMl(raw.name),
    price: raw.price,
    oldPrice: raw.oldPrice,
    currency: 'RUB',
    url: raw.url,
    imageUrl: raw.imageUrl,
    category: raw.category,
    fetchedAt,
  };
}

/** Убирает дубликаты по паре (source, sourceId), оставляя последнюю запись. */
export function dedupeProducts(products: Product[]): Product[] {
  const map = new Map<string, Product>();
  for (const product of products) {
    map.set(`${product.source}:${product.sourceId}`, product);
  }
  return [...map.values()];
}
