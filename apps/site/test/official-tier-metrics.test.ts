import { expect, it, vi } from 'vitest';
import type { CatalogGroup } from '@canrush/shared';
vi.mock('../src/lib/reviews', () => ({ getReviewSummaries: vi.fn() }));
import { getReviewSummaries } from '../src/lib/reviews';
import { buildOfficialTierList } from '../src/lib/tier-lists';

it('uses the selected rating with identical store and review thresholds', async () => {
  const groups: CatalogGroup[] = ['original', 'mango', 'peach'].map(flavor => ({
    brand: 'Test', flavor, minPrice: 100,
    variants: flavor === 'peach' ? [] : [{ source: 'edadeal', retailer: 'Store', price: 100, url: 'https://example.com', fetchedAt: new Date().toISOString() }],
  }));
  vi.mocked(getReviewSummaries).mockImplementation(async keys => new Map(keys.map(({ brand, flavor }) =>
    [brand + "\u0000" + flavor, { count: flavor === 'mango' ? 2 : 3, design: 9, taste: 5, overall: 7 }])));
  for (const [metric, tier] of [['overall', 'A'], ['design', 'SS'], ['taste', 'C']] as const) {
    const result = await buildOfficialTierList(groups, metric);
    expect(result.eligibleCount).toBe(2);
    expect(result.placements).toEqual([{ brand: 'Test', flavor: 'original', tier, position: 0 }]);
  }
});
