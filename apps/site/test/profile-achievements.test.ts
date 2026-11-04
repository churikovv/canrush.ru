import { describe, expect, it } from 'vitest';
import { ACHIEVEMENT_ICONS } from '@/lib/achievement-icons';
import { achievementTier, tierCount, tierSteps, ACHIEVEMENT_METRICS, PROFILE_ACHIEVEMENTS, achievementCompletion, eligibleAchievements, validateProfileTags, validateWallText, profilePageNumber, visibleProfileAchievements, type AchievementProgress } from '../src/lib/profile-achievements';
const progress = (values: Partial<AchievementProgress> = {}): AchievementProgress =>
  ({ ...Object.fromEntries(ACHIEVEMENT_METRICS.map(metric => [metric, 0])), ...values }) as AchievementProgress;
const burner = PROFILE_ACHIEVEMENTS.find(item => item.key === 'burner')!;
describe('profile achievement and wall validation', () => {
  it('unlocks tags only when every step reaches its threshold', () => {
    expect(eligibleAchievements(progress())).toEqual([]);
    expect(eligibleAchievements(progress({ reviews: 1, brands: 1, favorites: 4 }))).toEqual([]);
    expect(eligibleAchievements(progress({ reviews: 3, brands: 1, favorites: 4 }))).toEqual(['three']);
    expect(eligibleAchievements(progress({ burn: 5, burnDetailed: 3 }))).not.toContain('burner');
    expect(eligibleAchievements(progress({ burn: 5, burnDetailed: 3, burnFavorites: 1 }))).toContain('burner');
    const maxed = progress();
    for (const step of PROFILE_ACHIEVEMENTS.flatMap(item => item.steps)) maxed[step.metric] = Math.max(maxed[step.metric], step.goal);
    expect(eligibleAchievements(maxed)).toHaveLength(PROFILE_ACHIEVEMENTS.length);
  });
  it('grants calendar tags from the logged cans and the best streak', () => {
    expect(eligibleAchievements(progress({ drinkLogs: 1, drinkStreak: 1 }))).toEqual([]);
    expect(eligibleAchievements(progress({ drinkLogs: 14, drinkStreak: 14 }))).toEqual(['streak-14', 'streak-7']);
    expect(eligibleAchievements(progress({ drinkLogs: 40, drinkStreak: 30 }))).toContain('streak-30');
  });
  it('grants the beta engine tag only with a beta number', () => {
    expect(eligibleAchievements(progress({ betaEngine: 1 }))).toEqual(['engine']);
    expect(visibleProfileAchievements(false).some(item => item.key === 'engine')).toBe(true);
  });
  it('grants the meme tags only when every step is done', () => {
    expect(eligibleAchievements(progress({ classicBrands: 5, accountDays: 29 }))).not.toContain('boomer');
    expect(eligibleAchievements(progress({ classicBrands: 5, accountDays: 30 }))).toEqual(['boomer']);
    expect(eligibleAchievements(progress({ longReviews: 3, comments: 4 }))).toEqual([]);
    expect(eligibleAchievements(progress({ longReviews: 3, comments: 5 }))).toEqual(['dushnila']);
    expect(eligibleAchievements(progress({ bestReviewLikes: 3 }))).toEqual(['based']);
    expect(eligibleAchievements(progress({ profileLook: 2, wallPosts: 3 }))).toEqual([]);
    expect(eligibleAchievements(progress({ profileLook: 3, wallPosts: 3 }))).toEqual(['pickme']);
    expect(eligibleAchievements(progress({ redBull: 5, redBullFavorites: 1, volt: 5 }))).toEqual(['winged']);
    expect(eligibleAchievements(progress({ volt: 5, voltFavorites: 1 }))).toEqual(['voltage']);
  });
  it('gives every achievement an icon and harder goals on every next tier', () => {
    for (const item of PROFILE_ACHIEVEMENTS) {
      expect(ACHIEVEMENT_ICONS[item.key], item.key).toBeDefined();
      expect(tierCount(item)).toBeLessThanOrEqual(3);
      for (let tier = 2; tier <= tierCount(item); tier++) {
        const lower = tierSteps(item, tier - 1), steps = tierSteps(item, tier);
        expect(steps.map(step => step.metric)).toEqual(item.steps.map(step => step.metric));
        steps.forEach((step, index) => expect(step.goal, `${item.key} ${tier}`).toBeGreaterThanOrEqual(lower[index]!.goal));
        expect(steps.some((step, index) => step.goal > lower[index]!.goal), item.key).toBe(true);
        // The number in a label follows its goal when the goal changes.
        steps.forEach((step, index) => { if (step.goal !== item.steps[index]!.goal) expect(step.label).toContain(String(step.goal)); });
      }
    }
  });
  it('reaches a tier only when every step of it is done, and never skips one', () => {
    const critic = PROFILE_ACHIEVEMENTS.find(item => item.key === 'critic')!;
    expect(achievementTier(critic, progress({ reviews: 14, detailedReviews: 5, reviewLikes: 5 }))).toBe(0);
    expect(achievementTier(critic, progress({ reviews: 40, detailedReviews: 5, reviewLikes: 5 }))).toBe(1);
    expect(achievementTier(critic, progress({ reviews: 40, detailedReviews: 13, reviewLikes: 13 }))).toBe(2);
    expect(achievementTier(critic, progress({ reviews: 100, detailedReviews: 30, reviewLikes: 30 }))).toBe(3);
    expect(achievementTier(PROFILE_ACHIEVEMENTS.find(item => item.key === 'telegram')!, progress({ telegram: 1 }))).toBe(1);
  });
  it('caps each step when computing completion', () => {
    expect(achievementCompletion(burner, progress({ burn: 50 }))).toBeCloseTo(5 / 9);
    expect(achievementCompletion(burner, progress({ burn: 5, burnDetailed: 3, burnFavorites: 1 }))).toBe(1);
  });
  it('gives every tag a rarity and at least one step', () => {
    for (const item of PROFILE_ACHIEVEMENTS) expect(item.steps.length).toBeGreaterThan(0);
    expect(PROFILE_ACHIEVEMENTS.filter(item => item.rarity === 'epic').map(item => item.key)).toEqual(['burner', 'adrenaline', 'monster', 'based', 'streak-14', 'deadinside']);
  });
  it('hides administrative options from regular viewers', () => {
    expect(visibleProfileAchievements(false).some(item => item.key === 'admin')).toBe(false);
    expect(visibleProfileAchievements(true).some(item => item.key === 'admin')).toBe(true);
    expect(validateProfileTags(['telegram'], [])).toBeNull();
    expect(validateProfileTags(['telegram'], ['telegram'])).toEqual(['telegram']);
  });
  it('rejects fabricated, duplicate, excessive and unearned tags', () => {
    expect(validateProfileTags(['critic'], [])).toBeNull();
    expect(validateProfileTags(['fake'], ['fake'])).toBeNull();
    expect(validateProfileTags(['critic', 'critic'], ['critic'])).toBeNull();
    expect(validateProfileTags(['three', 'critic'], ['three', 'critic'])).toBeNull();
    expect(validateProfileTags(['admin'], [])).toBeNull();
    expect(validateProfileTags(['three', 'critic', 'collector', 'kitty'], ['three', 'critic', 'collector', 'kitty'])).toBeNull();
    // Removed tags (migration 0190) are no tags at all.
    for (const removed of ['friend', 'first-review', 'drink-start']) expect(validateProfileTags([removed], [removed])).toBeNull();
    expect(validateProfileTags([], [])).toEqual([]);
  });
  it('validates length, trimming and pagination', () => {
    expect(validateWallText('  hello  ')).toBe('hello');
    expect(validateWallText(' '.repeat(10))).toBeNull();
    expect(validateWallText('x'.repeat(1001))).toBeNull();
    expect(validateWallText(new File(['x'], 'x'))).toBeNull();
    expect(profilePageNumber('2')).toBe(2);
    for (const value of ['NaN', '-1', '1.5', ['2'], 1e30]) expect(profilePageNumber(value)).toBe(1);
  });
});
