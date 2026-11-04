import { describe, expect, it } from 'vitest';
import { achievementSummary, TROPHY_POINTS } from '@/lib/achievement-summary';
import { BADGE_ACHIEVEMENTS, BADGE_METRICS, earnedBadges, type BadgeProgress } from '@/lib/badges';
import { ACHIEVEMENT_ICONS } from '@/lib/achievement-icons';
import { ACHIEVEMENT_METRICS, PROFILE_ACHIEVEMENTS, validateProfileTags, type AchievementProgress, type ProfileAchievement } from '@/lib/profile-achievements';

const none = Object.fromEntries(BADGE_METRICS.map(metric => [metric, 0])) as BadgeProgress;

describe('achievements that are not tags', () => {
  it('never share a key with a tag and every one has its own emblem icon', () => {
    for (const item of BADGE_ACHIEVEMENTS) {
      expect(PROFILE_ACHIEVEMENTS.some(tag => tag.key === item.key)).toBe(false);
      expect(ACHIEVEMENT_ICONS[item.key], item.key).toBeDefined();
      for (const step of item.steps) expect(BADGE_METRICS).toContain(step.metric);
    }
  });

  it('are earned when every step is done', () => {
    expect(earnedBadges(none)).toEqual([]);
    expect(earnedBadges({ ...none, gachaPulls: 1, battleWins: 1, battlesPlayed: 9 })).toEqual(['first-pull', 'battle-win']);
    expect(earnedBadges({ ...none, battlesPlayed: 10 })).toContain('battle');
  });

  it('can never be worn as a tag', () => {
    expect(validateProfileTags(['first-pull'], ['first-pull'])).toBeNull();
  });

  it('count towards the trophy score alongside tags', () => {
    const tagsNone = Object.fromEntries(ACHIEVEMENT_METRICS.map(metric => [metric, 0])) as AchievementProgress;
    const all = [...PROFILE_ACHIEVEMENTS, ...BADGE_ACHIEVEMENTS] as ProfileAchievement<string>[];
    const summary = achievementSummary(all, ['kitty', 'full-shelf'], { ...tagsNone, ...none } as Record<string, number>, []);
    expect(summary.score).toBe(TROPHY_POINTS.common + TROPHY_POINTS.legendary);
    expect(summary.total).toBeGreaterThan(PROFILE_ACHIEVEMENTS.length - 10 + BADGE_ACHIEVEMENTS.length - 1);
  });
});
