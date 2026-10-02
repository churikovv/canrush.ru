import type { CatalogGroup, FlavorVariant } from '@canrush/shared';

export interface PriceObservation {
  brand: string;
  flavor: string;
  retailer: string;
  volumeMl: number;
  price: number;
}

const SOURCE_NAMES: Record<FlavorVariant['source'], string> = {
  edadeal: 'Едадил', magnit: 'Магнит', pyaterochka: 'Пятёрочка',
  lenta: 'Лента', ozon: 'Ozon', wildberries: 'Wildberries',
};

function isMultipack(variant: FlavorVariant): boolean {
  // Edadeal preserves the original offer title in its search URL. No request is made.
  let title = '';
  try { title = new URL(variant.url).searchParams.get('text') ?? ''; } catch { return false; }
  if (/упаковк/iu.test(title)) return true;
  const counts = title.matchAll(/(?:^|[^\d])(\d+)\s*(?:шт(?:ук[аи]?)?\.?|банок)(?![а-яё])/giu);
  return [...counts].some(match => Number(match[1]) > 1);
}

export function preparePriceObservations(groups: CatalogGroup[], asOf: string) {
  const cutoff = Date.parse(asOf);
  if (!Number.isFinite(cutoff)) throw new Error('Invalid catalog snapshot date');
  const unique = new Map<string, PriceObservation>();
  let excluded = 0;
  let duplicates = 0;
  for (const group of groups) {
    for (const variant of group.variants) {
      const volume = variant.volumeMl;
      const expired = variant.promoEndsAt && Date.parse(variant.promoEndsAt) < cutoff;
      if (!Number.isFinite(variant.price) || variant.price <= 0 || !Number.isFinite(volume) || !volume || volume <= 0 || volume > 5000 || variant.stale || expired || isMultipack(variant)) {
        excluded++;
        continue;
      }
      const retailer = (variant.retailer || SOURCE_NAMES[variant.source]).trim();
      const key = JSON.stringify([group.brand, group.flavor, volume, retailer.toLocaleLowerCase('ru-RU')]);
      const previous = unique.get(key);
      if (previous) duplicates++;
      if (!previous || variant.price < previous.price) {
        unique.set(key, { brand: group.brand, flavor: group.flavor, retailer, volumeMl: volume, price: variant.price });
      }
    }
  }
  return { observations: [...unique.values()], excluded, duplicates };
}

export function retailerPriceStatistics(observations: PriceObservation[], brand = '', volumeMl?: number) {
  const stores = new Map<string, number[]>();
  for (const row of observations) {
    if ((brand && row.brand !== brand) || (volumeMl !== undefined && row.volumeMl !== volumeMl)) continue;
    const prices = stores.get(row.retailer) ?? [];
    prices.push(row.price * 100 / row.volumeMl);
    stores.set(row.retailer, prices);
  }
  return [...stores].map(([retailer, values]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
    return { retailer, count: values.length, mean: values.reduce((sum, price) => sum + price, 0) / values.length, median };
  });
}

export type PriceSort = 'median' | 'count' | 'retailer' | 'deviation';

export function compareRetailerPrices(observations: PriceObservation[], brand = '', volumeMl?: number, sort: PriceSort = 'median', direction: 'asc' | 'desc' = sort === 'count' ? 'desc' : 'asc') {
  const rows = retailerPriceStatistics(observations, brand, volumeMl);
  const count = rows.reduce((sum, row) => sum + row.count, 0);
  const average = count ? rows.reduce((sum, row) => sum + row.mean * row.count, 0) / count : 0;
  rows.sort((a, b) => {
    const primary = sort === 'retailer' ? a.retailer.localeCompare(b.retailer, 'ru')
      : sort === 'count' ? a.count - b.count : a.median - b.median;
    return primary * (direction === 'asc' ? 1 : -1)
      || (sort === 'count' ? a.median - b.median : b.count - a.count)
      || a.retailer.localeCompare(b.retailer, 'ru');
  });
  return { count, average, rows: rows.map(row => ({ ...row, deviation: average ? Math.round((row.median / average - 1) * 100) : 0 })) };
}
