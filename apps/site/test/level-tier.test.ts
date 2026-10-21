import { expect, it } from 'vitest';
import { levelRank, levelTier, nextLevelRank, rankUpRank, romanNumeral } from '../src/lib/level-tier';

it('maps levels to tiers at their thresholds and exposes the next tier', () => {
  expect([0, 1, 2, 3, 4, 5, 7, 8, 11, 12, 19, 20, 99].map(level => levelTier(level).tier.key)).toEqual(['rookie', 'rookie', 'rookie', 'bronze', 'bronze', 'silver', 'silver', 'gold', 'gold', 'platinum', 'platinum', 'legend', 'legend']);
  expect(levelTier(8).next?.key).toBe('platinum');
  expect(levelTier(25).next).toBeNull();
});

it('splits tiers into degrees and keeps Legend open-ended', () => {
  const labels = (levels: number[]) => levels.map(level => levelRank(level).label);
  expect(labels([1, 2, 3, 4, 5, 6, 7])).toEqual(['Новичок', 'Новичок', 'Бронза I', 'Бронза II', 'Серебро I', 'Серебро II', 'Серебро III']);
  expect(labels([8, 9, 10, 11, 12, 14, 15, 18, 19])).toEqual(['Золото I', 'Золото II', 'Золото III', 'Золото III', 'Платина I', 'Платина I', 'Платина II', 'Платина III', 'Платина III']);
  expect(labels([20, 24, 25, 30, 64, 65])).toEqual(['Легенда I', 'Легенда I', 'Легенда II', 'Легенда III', 'Легенда IX', 'Легенда X']);
  expect(levelRank(16)).toMatchObject({ degree: 2, degrees: 3, min: 15 });
  expect(levelRank(31)).toMatchObject({ degree: 3, degrees: null, min: 30 });
});

it('points to the next degree, then to the next tier', () => {
  const next = (level: number) => { const rank = nextLevelRank(level); return `${rank.label}@${rank.min}`; };
  expect([1, 4, 6, 10, 11, 13, 18, 19, 20, 27].map(next)).toEqual(['Бронза I@3', 'Серебро I@5', 'Серебро III@7', 'Платина I@12', 'Платина I@12', 'Платина II@15', 'Легенда I@20', 'Легенда I@20', 'Легенда II@25', 'Легенда III@30']);
});

it('names feed announcements and writes numerals', () => {
  expect([rankUpRank('gold', 1), rankUpRank('platinum', 1), rankUpRank('legend', 1), rankUpRank('legend', 4)].map(rank => `${rank.label}@${rank.min}`)).toEqual(['Золото I@8', 'Платина I@12', 'Легенда I@20', 'Легенда IV@35']);
  expect([1, 4, 9, 14, 40, 49, 99].map(romanNumeral)).toEqual(['I', 'IV', 'IX', 'XIV', 'XL', 'XLIX', 'XCIX']);
});
