import { describe, expect, it } from 'vitest';
import { nextLevelRewards, rewardsAtLevel } from '../src/lib/level-rewards.js';

describe('level rewards', () => {
  it('lists the rank, cosmetics and the feed post a level opens', () => {
    expect(rewardsAtLevel(8).map(reward => reward.kind)).toEqual(['rank', 'feed', 'theme', 'frame']);
    expect(rewardsAtLevel(8)[0]).toMatchObject({ title: 'Золото I', tier: 'gold' });
    expect(rewardsAtLevel(9).map(reward => reward.kind)).toEqual(['rank']);
    expect(rewardsAtLevel(1)).toEqual([]);
  });
  it('skips levels without rewards and keeps going past Legend', () => {
    expect(nextLevelRewards(10)).toMatchObject({ level: 12 });
    expect(nextLevelRewards(20).level).toBe(25);
    expect(nextLevelRewards(20).rewards.map(reward => reward.kind)).toEqual(['rank', 'feed']);
  });
});
