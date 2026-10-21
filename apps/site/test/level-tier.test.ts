import { expect, it } from 'vitest';
import { experienceLevel } from '../src/lib/experience-level';
import { LEVEL_TIERS, RANK_UP_TIERS, levelTier } from '../src/lib/level-tier';

it('maps levels to tiers at their thresholds and exposes the next tier', () => {
  expect([0, 1, 2, 3, 4, 5, 7, 8, 11, 12, 19, 20, 99].map(level => levelTier(level).tier.key)).toEqual(['rookie', 'rookie', 'rookie', 'bronze', 'bronze', 'silver', 'silver', 'gold', 'gold', 'platinum', 'platinum', 'legend', 'legend']);
  expect(levelTier(8).next?.key).toBe('platinum');
  expect(levelTier(25).next).toBeNull();
});

it('keeps the rank-up thresholds of migration 0079 in step with the level formula', () => {
  const thresholds = { gold: 2800, platinum: 6600, legend: 19000 };
  for (const key of RANK_UP_TIERS) {
    const min = LEVEL_TIERS.find(tier => tier.key === key)!.min;
    expect(experienceLevel(thresholds[key]).level).toBe(min);
    expect(experienceLevel(thresholds[key] - 1).level).toBe(min - 1);
  }
});
