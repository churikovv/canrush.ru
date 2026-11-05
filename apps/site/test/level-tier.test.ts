import { expect, it } from 'vitest';
import { experienceAtPosition, hasPartialDegrees, LEVEL_TIERS, levelRank, levelTier, nextLevelRank, rankPosition, rankUpRank, romanNumeral } from '../src/lib/level-tier';

it('maps levels to tiers at their thresholds and exposes the next tier', () => {
  expect([0, 1, 2, 3, 4, 5, 7, 8, 11, 12, 19, 20, 39, 40, 99].map(level => levelTier(level).tier.key)).toEqual(['rookie', 'rookie', 'rookie', 'bronze', 'bronze', 'silver', 'silver', 'gold', 'gold', 'platinum', 'platinum', 'legend', 'legend', 'myth', 'myth']);
  expect(levelTier(8).next?.key).toBe('platinum');
  expect(levelTier(25).next?.key).toBe('myth');
  expect(levelTier(45).next).toBeNull();
});

it('counts the early degrees in XP inside levels, so the first review or day already moves the rank', () => {
  const at = (xp: number) => levelRank(rankPosition(xp)).label;
  expect([0, 24, 25, 49, 50, 99, 100, 199, 200, 299].map(at)).toEqual(['Новичок I', 'Новичок I', 'Новичок II', 'Новичок II', 'Новичок III', 'Новичок III', 'Новичок IV', 'Новичок IV', 'Новичок V', 'Новичок V']);
  expect([300, 449, 450, 600, 799, 800, 999, 1000].map(at)).toEqual(['Бронза I', 'Бронза I', 'Бронза II', 'Бронза III', 'Бронза III', 'Бронза IV', 'Бронза IV', 'Серебро I']);
  // Each early degree starts exactly at the XP the comments name.
  expect(LEVEL_TIERS.slice(0, 2).flatMap(tier => tier.degrees.map(experienceAtPosition))).toEqual([0, 25, 50, 100, 200, 300, 450, 600, 800]);
  expect(hasPartialDegrees(LEVEL_TIERS[0])).toBe(true);
  expect(hasPartialDegrees(LEVEL_TIERS[2])).toBe(false);
});

it('splits the higher tiers into degrees by level, Legend into four and Myth without end', () => {
  const labels = (levels: number[]) => levels.map(level => levelRank(level).label);
  expect(labels([5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 18, 19])).toEqual(['Серебро I', 'Серебро II', 'Серебро III', 'Золото I', 'Золото II', 'Золото III', 'Золото III', 'Платина I', 'Платина I', 'Платина II', 'Платина III', 'Платина III']);
  expect(labels([20, 24, 25, 30, 35, 39, 40, 44, 45, 64, 65])).toEqual(['Легенда I', 'Легенда I', 'Легенда II', 'Легенда III', 'Легенда IV', 'Легенда IV', 'Миф I', 'Миф I', 'Миф II', 'Миф V', 'Миф VI']);
  expect(levelRank(16)).toMatchObject({ degree: 2, degrees: 3, min: 15 });
  expect(levelRank(31)).toMatchObject({ degree: 3, degrees: 4, min: 30 });
  expect(levelRank(46)).toMatchObject({ degree: 2, degrees: null, min: 45 });
});

it('points to the next degree, then to the next tier', () => {
  const next = (position: number) => { const rank = nextLevelRank(position); return `${rank.label}@${rank.min}`; };
  expect([1, 1.3, 2.6, 4, 4.6, 6, 10, 18, 20, 27, 35, 40].map(next)).toEqual(['Новичок II@1.25', 'Новичок III@1.5', 'Бронза I@3', 'Бронза IV@4.5', 'Серебро I@5', 'Серебро III@7', 'Платина I@12', 'Легенда I@20', 'Легенда II@25', 'Легенда III@30', 'Миф I@40', 'Миф II@45']);
});

it('names feed announcements and writes numerals', () => {
  expect([rankUpRank('gold', 1), rankUpRank('platinum', 1), rankUpRank('legend', 1), rankUpRank('legend', 4), rankUpRank('myth', 1), rankUpRank('myth', 3)].map(rank => `${rank.label}@${rank.min}`))
    .toEqual(['Золото I@8', 'Платина I@12', 'Легенда I@20', 'Легенда IV@35', 'Миф I@40', 'Миф III@50']);
  expect([1, 4, 9, 14, 40, 49, 99].map(romanNumeral)).toEqual(['I', 'IV', 'IX', 'XIV', 'XL', 'XLIX', 'XCIX']);
});
