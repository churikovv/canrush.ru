import type { Product, SourceName } from '@canrush/shared';

export interface RawProductInput {
  sourceId: string;
  name: string;
  brand?: string;
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

/** Пытается определить бренд из названия товара по списку известных брендов. */
export function detectBrand(name: string, knownBrands: string[]): string | undefined {
  const lowerName = name.toLowerCase();
  return knownBrands.find((brand) => lowerName.includes(brand.toLowerCase()));
}

/** Приводит данные конкретного источника к единой схеме Product. */
export function normalizeProduct(
  source: SourceName,
  raw: RawProductInput,
  knownBrands: string[] = [],
  fetchedAt: string = new Date().toISOString(),
): Product {
  return {
    source,
    sourceId: raw.sourceId,
    name: raw.name.trim(),
    brand: raw.brand ?? detectBrand(raw.name, knownBrands),
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
