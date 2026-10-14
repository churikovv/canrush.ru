import { describe, expect, it } from 'vitest';
import { ACHIEVEMENT_METRICS, PROFILE_ACHIEVEMENTS, achievementCompletion, eligibleAchievements, validateProfileTags, validateWallText, profilePageNumber, visibleProfileAchievements, type AchievementProgress } from '../src/lib/profile-achievements';
const progress = (values: Partial<AchievementProgress> = {}): AchievementProgress =>
  ({ ...Object.fromEntries(ACHIEVEMENT_METRICS.map(metric => [metric, 0])), ...values }) as AchievementProgress;
const burner = PROFILE_ACHIEVEMENTS.find(item => item.key === 'burner')!;
describe('profile achievement and wall validation', () => {
  it('unlocks tags only when every step reaches its threshold', () => {
    expect(eligibleAchievements(progress())).toEqual([]);
    expect(eligibleAchievements(progress({ reviews: 1, brands: 1, favorites: 4 }))).toEqual(['first-review']);
    expect(eligibleAchievements(progress({ burn: 5, burnDetailed: 3 }))).not.toContain('burner');
    expect(eligibleAchievements(progress({ burn: 5, burnDetailed: 3, burnFavorites: 1 }))).toContain('burner');
    const maxed = progress();
    for (const step of PROFILE_ACHIEVEMENTS.flatMap(item => item.steps)) maxed[step.metric] = Math.max(maxed[step.metric], step.goal);
    expect(eligibleAchievements(maxed)).toHaveLength(PROFILE_ACHIEVEMENTS.length);
  });
  it('caps each step when computing completion', () => {
    expect(achievementCompletion(burner, progress({ burn: 50 }))).toBeCloseTo(5 / 9);
    expect(achievementCompletion(burner, progress({ burn: 5, burnDetailed: 3, burnFavorites: 1 }))).toBe(1);
  });
  it('gives every tag a rarity and at least one step', () => {
    for (const item of PROFILE_ACHIEVEMENTS) expect(item.steps.length).toBeGreaterThan(0);
    expect(PROFILE_ACHIEVEMENTS.filter(item => item.rarity === 'epic').map(item => item.key)).toEqual(['burner', 'adrenaline', 'deadinside']);
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
    expect(validateProfileTags(['first-review', 'critic'], ['first-review', 'critic'])).toBeNull();
    expect(validateProfileTags(['admin'], [])).toBeNull();
    expect(validateProfileTags(['first-review', 'critic', 'collector', 'friend'], ['first-review', 'critic', 'collector', 'friend'])).toBeNull();
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
