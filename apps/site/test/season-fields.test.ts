import { describe, expect, it } from 'vitest';
import { PASS_EXCLUDED_REASONS, PASS_LEVELS, PASS_STAGES, WEEK_PRIZES, countdownParts, passClaimable, passLevelReached, passProgress, passStage, passStageOpensAt, seasonDaysLeft, seasonNumber, seasonTitle, weekEndsAt, weekGoal, weekPrize } from '../src/lib/season-fields';

describe('seasons', () => {
  it('counts a season per month from October 2026', () => {
    expect(seasonNumber('2026-10')).toBe(1);
    expect(seasonNumber('2026-11')).toBe(2);
    expect(seasonNumber('2027-01')).toBe(4);
    expect(seasonTitle('2026-11')).toBe('Сезон 2');
  });

  it('counts the days left with today', () => {
    expect(seasonDaysLeft('2026-11-01')).toBe(30);
    expect(seasonDaysLeft('2026-11-30')).toBe(1);
    expect(seasonDaysLeft('2027-02-01')).toBe(28);
  });
});

describe('prizes', () => {
  it('pays the whole top ten and nobody below it', () => {
    expect(weekPrize(1)).toMatchObject({ xp: 2000, tag: 'week-hero' });
    expect(weekPrize(5)).toMatchObject({ xp: 1000, tag: 'week-best' });
    expect(weekPrize(6)).toMatchObject({ xp: 350, tag: 'week-charge' });
    expect(weekPrize(10)).toMatchObject({ tag: 'week-charge' });
    expect(weekPrize(11)).toBeNull();
  });

  it('never lets a lower place earn more', () => {
    const prizes = [1, 2, 5, 6, 10].map(place => weekPrize(place)?.xp ?? 0);
    expect([...prizes].sort((a, b) => b - a)).toEqual(prizes);
  });
});

describe('week countdown', () => {
  const end = Date.parse('2026-11-08T21:00:00Z');

  it('ends on Monday at midnight in Moscow', () => {
    expect(weekEndsAt(Date.parse('2026-11-04T09:00:00Z'))).toBe(end);
    expect(weekEndsAt(Date.parse('2026-11-01T20:59:59Z'))).toBe(Date.parse('2026-11-01T21:00:00Z'));
    expect(weekEndsAt(Date.parse('2026-11-01T21:00:00Z'))).toBe(end);
  });

  it('splits what is left and stops at zero', () => {
    expect(countdownParts(2 * 86_400_000 + 3 * 3_600_000 + 4 * 60_000 + 5000)).toEqual({ days: 2, hours: 3, minutes: 4, seconds: 5 });
    expect(countdownParts(1)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 1 });
    expect(countdownParts(-5000)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });
});

describe('week goal', () => {
  const leaders = [900, 700, 500, 400, 300, 200, 150, 120, 100, 80];
  const [hero, best, charge] = WEEK_PRIZES as [typeof WEEK_PRIZES[number], typeof WEEK_PRIZES[number], typeof WEEK_PRIZES[number]];

  it('says how much is missing, one XP over the last place of the group', () => {
    expect(weekGoal(charge, leaders, { place: 14, xp: 50 })).toEqual({ kind: 'gap', xp: 31 });
    expect(weekGoal(hero, leaders, { place: 3, xp: 500 })).toEqual({ kind: 'gap', xp: 401 });
    expect(weekGoal(best, leaders, null)).toEqual({ kind: 'gap', xp: 301 });
  });

  it('knows the group the member stands in and those below', () => {
    expect(weekGoal(best, leaders, { place: 3, xp: 500 })).toEqual({ kind: 'here' });
    expect(weekGoal(charge, leaders, { place: 3, xp: 500 })).toEqual({ kind: 'above' });
  });

  it('leaves a free place open while the ten are not filled', () => {
    expect(weekGoal(charge, [900, 700], null)).toEqual({ kind: 'open' });
    expect(weekGoal(hero, [], null)).toEqual({ kind: 'open' });
  });
});

describe('pass can', () => {
  it('grows inside the levels of the pass', () => {
    expect(PASS_STAGES).toHaveLength(5);
    expect(PASS_STAGES.every(stage => stage.from <= PASS_LEVELS.length)).toBe(true);
    expect(passStage(0)).toBe(1);
    expect(passStage(2)).toBe(1);
    expect(passStage(3)).toBe(2);
    expect(passStage(11)).toBe(4);
    expect(passStage(PASS_LEVELS.length)).toBe(5);
  });

  it('names the stage only on the level that opens it', () => {
    expect(passStageOpensAt(6)?.name).toBe('Неоновая');
    expect(passStageOpensAt(7)).toBeUndefined();
    expect(passStageOpensAt(0)).toBeUndefined();
  });
});

describe('season pass', () => {
  it('rises steadily and leaves the tracker out of its points', () => {
    const points = PASS_LEVELS.map(level => level.points);
    expect([...new Set(points)].sort((a, b) => a - b)).toEqual(points);
    expect(PASS_EXCLUDED_REASONS).toEqual(expect.arrayContaining(['drink-day', 'drink-streak', 'monthly-top', 'weekly-top']));
  });

  it('opens levels by points', () => {
    expect(passLevelReached(0)).toBe(0);
    expect(passLevelReached(24)).toBe(0);
    expect(passLevelReached(25)).toBe(1);
    expect(passLevelReached(1_000_000)).toBe(PASS_LEVELS.length);
  });

  it('offers only reached levels not taken yet', () => {
    expect(passClaimable(200, new Set()).map(level => level.level)).toEqual([1, 2, 3]);
    expect(passClaimable(200, new Set([2])).map(level => level.level)).toEqual([1, 3]);
    expect(passClaimable(10, new Set())).toEqual([]);
  });

  it('shows the way to the next level and stops at the last', () => {
    expect(passProgress(0)).toEqual({ left: 25, share: 0 });
    expect(passProgress(50)).toEqual({ left: 25, share: .5 });
    expect(passProgress(1_000_000)).toBeNull();
  });
});
