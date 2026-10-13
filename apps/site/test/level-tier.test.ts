import { expect, it } from 'vitest';
import { levelTier } from '../src/lib/level-tier';

it('maps levels to tiers at their thresholds and exposes the next tier', () => {
  expect([0, 1, 2, 3, 4, 5, 7, 8, 11, 12, 19, 20, 99].map(level => levelTier(level).tier.key)).toEqual(['rookie', 'rookie', 'rookie', 'bronze', 'bronze', 'silver', 'silver', 'gold', 'gold', 'platinum', 'platinum', 'legend', 'legend']);
  expect(levelTier(8).next?.key).toBe('platinum');
  expect(levelTier(25).next).toBeNull();
});
