import { describe, expect, it } from 'vitest';
import type { CatalogGroup, FlavorVariant } from '@canrush/shared';
import { preparePriceObservations, retailerPriceStatistics, type PriceObservation } from '../src/lib/price-statistics';
const asOf = '2026-09-09T12:00:00Z';
const variant = (overrides: Partial<FlavorVariant> = {}): FlavorVariant => ({ source: 'edadeal', retailer: 'Магнит', price: 100, volumeMl: 500, fetchedAt: asOf, url: 'https://example.com', ...overrides });
const group = (variants: FlavorVariant[]): CatalogGroup => ({ brand: 'Burn', flavor: 'original', minPrice: 100, variants });
const row = (price: number, volumeMl = 500, brand = 'Burn'): PriceObservation => ({ brand, flavor: 'original', retailer: 'Магнит', price, volumeMl });
describe('retailer price comparison', () => {
  it('normalizes each offer before calculating mean and odd/even median', () => {
    expect(retailerPriceStatistics([row(100), row(100, 250), row(300)])[0]).toMatchObject({ count: 3, mean: 40, median: 40 });
    expect(retailerPriceStatistics([row(100), row(200), row(300), row(1000)])[0]).toMatchObject({ mean: 80, median: 50 });
  });
  it('uses can prices for an exact volume and filters brand', () => {
    expect(retailerPriceStatistics([row(100), row(200, 250), row(300, 500, 'Other')], 'Burn', 500)[0]).toMatchObject({ count: 1, mean: 100, median: 100 });
    expect(retailerPriceStatistics([row(100)], 'missing')).toEqual([]);
  });
  it('deduplicates a store/product/volume using the cheapest offer without mutating input', () => {
    const groups = [group([variant(), variant({ price: 80 }), variant({ volumeMl: 449 })])];
    const copy = structuredClone(groups);
    const result = preparePriceObservations(groups, asOf);
    expect(result.duplicates).toBe(1);
    expect(result.observations.map(r => r.price)).toEqual([80, 100]);
    expect(groups).toEqual(copy);
  });
  it('excludes expired-at-snapshot, stale, unknown volume, invalid prices and recognized multipacks', () => {
    const variants = [variant({ promoEndsAt: '2026-09-08' }), variant({ stale: true }), variant({ volumeMl: undefined }), variant({ price: 0 }), variant({ price: NaN }), variant({ volumeMl: 450000 }), variant({ url: 'https://example.com?text=Burn+12+шт' }), variant({ promoEndsAt: '2026-09-10' })];
    const result = preparePriceObservations([group(variants)], asOf);
    expect(result.excluded).toBe(7);
    expect(result.observations).toHaveLength(1);
  });
});
