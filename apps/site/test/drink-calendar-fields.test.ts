import { describe, expect, it } from 'vitest';
import {
  DrinkCalendarError, addDays, flameTier, streakRestore, birdMood, canEditDay, currentStreak, drinkStreaks, heatmapWeeks, isDay, monthSummary, monthWeeks,
  parseDrinkForm, parseDrinkPrice, reachedMilestones, shiftMonth, streakOn,
} from '../src/lib/drink-calendar-fields';

describe('drink calendar helpers', () => {
  it('splits days into streaks and keeps the current one alive until the next midnight', () => {
    const streaks = drinkStreaks(['2026-10-03', '2026-10-01', '2026-10-02', '2026-10-02', '2026-10-05']);
    expect(streaks).toEqual([{ start: '2026-10-01', end: '2026-10-03', length: 3 }, { start: '2026-10-05', end: '2026-10-05', length: 1 }]);
    expect(currentStreak(streaks, '2026-10-05')?.length).toBe(1);
    expect(currentStreak(streaks, '2026-10-06')?.start).toBe('2026-10-05');
    expect(currentStreak(streaks, '2026-10-07')).toBeNull();
    expect(streakOn(streaks, '2026-10-02')?.length).toBe(3);
    expect(birdMood(currentStreak(streaks, '2026-10-05'), '2026-10-05')).toBe('happy');
    expect(birdMood(currentStreak(streaks, '2026-10-06'), '2026-10-06')).toBe('waiting');
    expect(birdMood(null, '2026-10-06')).toBe('sleepy');
  });
  it('crosses month and year boundaries', () => {
    expect(drinkStreaks(['2026-12-31', '2027-01-01', '2026-02-28', '2026-03-01'])).toHaveLength(2);
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(isDay('2026-02-30')).toBe(false);
  });
  it('pays milestones once per streak and repeats every 30 days after the last one', () => {
    expect(reachedMilestones({ start: 'x', end: 'y', length: 2 })).toEqual([]);
    expect(reachedMilestones({ start: 'x', end: 'y', length: 14 })).toEqual([3, 7, 14]);
    expect(reachedMilestones({ start: 'x', end: 'y', length: 95 })).toEqual([3, 7, 14, 30, 60, 90]);
  });
  it('builds Monday-first month and heatmap grids', () => {
    const weeks = monthWeeks('2026-10');
    expect(weeks[0]).toEqual([null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
    const heat = heatmapWeeks('2026-10-17', 53);
    expect(heat).toHaveLength(53);
    expect(heat.at(-1)).toEqual(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', null]);
  });
  it('accepts only today or yesterday and parses optional price and store', () => {
    expect(canEditDay('2026-10-16', '2026-10-17')).toBe(true);
    expect(canEditDay('2026-10-15', '2026-10-17')).toBe(false);
    expect(canEditDay('2026-10-18', '2026-10-17')).toBe(false);
    expect(parseDrinkPrice('')).toBeNull();
    expect(parseDrinkPrice('129,9')).toBe(12990);
    expect(() => parseDrinkPrice('-1')).toThrow(DrinkCalendarError);
    const form = new FormData();
    form.set('day', '2026-10-15'); form.set('name', 'Burn');
    expect(() => parseDrinkForm(form, '2026-10-17')).toThrow('сегодня или вчера');
    form.set('day', '2026-10-17'); form.set('brand', 'Burn'); form.set('flavor', 'original'); form.set('store', '  ');
    expect(parseDrinkForm(form, '2026-10-17')).toEqual({ day: '2026-10-17', name: 'Burn', brand: 'Burn', flavor: 'original', price: null, store: null });
  });
  it('sums a month and counts only priced cans towards spending', () => {
    expect(monthSummary([
      { day: '2026-10-01', name: 'Burn', price: 10000 }, { day: '2026-10-01', name: 'Burn', price: null }, { day: '2026-10-02', name: 'Flash', price: 8000 },
    ])).toEqual({ cans: 3, days: 2, unique: 2, top: { name: 'Burn', count: 2 }, spent: 18000, priced: 2 });
  });

  it('offers to restore one missed day after a streak, at most once per 15 days', () => {
    const run = (from: string, count: number) => Array.from({ length: count }, (_, index) => addDays(from, index));
    // Yesterday missed after four days: restoring it keeps the streak alive.
    expect(streakRestore(run('2031-03-01', 4), '2031-03-06', null)).toEqual({ day: '2031-03-05', length: 5 });
    // A gap the day before yesterday, logged since: the runs join.
    expect(streakRestore([...run('2031-03-01', 4), '2031-03-06', '2031-03-07'], '2031-03-07', null)).toEqual({ day: '2031-03-05', length: 7 });
    // Nothing to restore: no gap, a gap of two days, a gap too old, or a single day before the gap.
    expect(streakRestore(run('2031-03-01', 7), '2031-03-07', null)).toBeNull();
    expect(streakRestore(run('2031-03-01', 4), '2031-03-07', null)).toBeNull();
    expect(streakRestore([...run('2031-03-01', 4), ...run('2031-03-06', 4)], '2031-03-09', null)).toBeNull();
    expect(streakRestore(['2031-03-04'], '2031-03-06', null)).toBeNull();
    // Within 15 days of the last restore: the date it becomes possible again.
    expect(streakRestore(run('2031-03-01', 4), '2031-03-06', '2031-02-25')).toEqual({ availableOn: '2031-03-12' });
    expect(streakRestore(run('2031-03-01', 4), '2031-03-06', '2031-02-19')).toEqual({ day: '2031-03-05', length: 5 });
  });

  it('colours the flame like TikTok, the top tier in the brand blue', () => {
    expect([1, 29, 30, 99, 100, 199, 200].map(flameTier)).toEqual(['orange', 'orange', 'pink', 'pink', 'purple', 'purple', 'blue']);
  });
});
