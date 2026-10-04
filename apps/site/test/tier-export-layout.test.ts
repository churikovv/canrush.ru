import { expect, it } from 'vitest';
import { tierExportLayout } from '../src/lib/tier-export-layout';
it('lays out 300 products in a wide image even if all occupy one tier', () => {
  for (const counts of [[300, 0, 0, 0, 0], [60, 60, 60, 60, 60]]) {
    const layout = tierExportLayout(counts);
    expect(layout.columns).toBe(24);
    expect(layout.width).toBeGreaterThan(layout.height);
    counts.forEach((count, index) => {
      expect(layout.rows[index]!.height).toBeGreaterThanOrEqual(Math.ceil(count / layout.columns) * (layout.cell + layout.gap) - layout.gap);
    });
  }
});
it('keeps empty tiers visible and avoids overlaps', () => {
  const layout = tierExportLayout([0, 1, 13, 0, 2]);
  expect(layout.rows.every(row => row.height > 0)).toBe(true);
  for (let i = 1; i < layout.rows.length; i++) expect(layout.rows[i]!.y).toBe(layout.rows[i - 1]!.y + layout.rows[i - 1]!.height);
});
