import { describe, expect, it } from 'vitest';
import { eligibleAchievements, validateProfileTags, validateWallText, profilePageNumber, visibleProfileAchievements } from '../src/lib/profile-achievements';
describe('profile achievement and wall validation', () => {
  it('unlocks tags at their exact thresholds', () => {
    expect(eligibleAchievements({ whiteMonster: 0, flash: 0, burn: 0, adrenaline: 0, admin: 0, telegram: 0, reviews: 0, brands: 0, favorites: 0, tierLists: 0, friends: 0 })).toEqual([]);
    expect(eligibleAchievements({ whiteMonster: 0, flash: 0, burn: 3, adrenaline: 3, admin: 1, telegram: 1, reviews: 67, brands: 5, favorites: 10, tierLists: 3, friends: 1 })).toHaveLength(13);
    expect(eligibleAchievements({ whiteMonster: 0, flash: 0, burn: 0, adrenaline: 0, admin: 0, telegram: 0, reviews: 1, brands: 1, favorites: 4, tierLists: 0, friends: 0 })).toEqual(['first-review']);
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
