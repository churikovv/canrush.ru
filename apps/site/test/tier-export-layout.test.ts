import { describe, expect, it } from 'vitest';
import { tierExportLayout, tierStoryLayout } from '../src/lib/tier-export-layout';
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

describe('tierStoryLayout', () => {
  const area = { width: 900, height: 1110 };
  it('keeps every drink inside the vertical area', () => {
    for (const counts of [[0, 0, 0, 0, 0, 0], [3, 8, 12, 5, 2, 1], [40, 40, 40, 40, 40, 40], [200, 0, 0]]) {
      const layout = tierStoryLayout(counts, area);
      expect(layout.height).toBeLessThanOrEqual(area.height + 0.001);
      expect(layout.labelWidth + layout.inset * 2 + layout.columns * (layout.cell + layout.gap) - layout.gap).toBeLessThanOrEqual(area.width);
      for (const [index, count] of counts.entries()) {
        const lines = Math.max(1, Math.ceil(count / layout.columns));
        expect(layout.inset * 2 + lines * (layout.cell + layout.gap) - layout.gap).toBeLessThanOrEqual(layout.rows[index]!.height + 0.001);
      }
    }
  });
  it('uses large cells for short lists and shrinks them for long ones', () => {
    expect(tierStoryLayout([2, 3, 1, 0, 0, 0], area).cell).toBeGreaterThan(120);
    expect(tierStoryLayout([40, 40, 40, 40, 40, 40], area).cell).toBeLessThan(80);
  });
});
