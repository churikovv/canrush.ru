import { describe, expect, it } from 'vitest';
import { DAILY_DAYS, DAILY_ITEMS, dailyReward, dailyTrack, ITEM_DAY_XP, moonLight, OWNED_ITEM_SPARKS } from '../src/lib/daily-reward-fields';

describe('«Лунный цикл» daily rewards', () => {
  it('gives XP and sparks every day, more further along, and a thing every fifth day', () => {
    expect(dailyReward(1)).toEqual({ step: 1, xp: 25, sparks: 2, item: null });
    expect(dailyReward(29)).toEqual({ step: 29, xp: 75, sparks: 7, item: null });
    expect(Object.keys(DAILY_ITEMS).map(Number)).toEqual([5, 10, 15, 20, 25, 30]);
    expect(Object.values(DAILY_ITEMS).map(item => item.kind)).toEqual(['tag', 'theme', 'frame', 'tag', 'theme', 'frame']);
    expect(dailyReward(15)).toEqual({ step: 15, xp: ITEM_DAY_XP, sparks: 0, item: DAILY_ITEMS[15] });
    // Never less than +25, never smaller than the day before.
    for (let step = 2; step <= DAILY_DAYS; step++) expect(dailyReward(step).xp).toBeGreaterThanOrEqual(DAILY_ITEMS[step - 1] ? 25 : dailyReward(step - 1).xp);
    expect(dailyReward(1).xp).toBe(25);
  });

  it('turns a thing already owned into sparks', () => {
    expect(dailyReward(10, key => key === 'moonlight')).toEqual({ step: 10, xp: ITEM_DAY_XP, sparks: OWNED_ITEM_SPARKS, item: null });
    expect(dailyReward(30, key => key === 'moonlight').item?.key).toBe('moon-cycle');
  });

  it('goes on day by day, starts over after a missed day and after day 30', () => {
    expect(dailyTrack(null, '2026-11-05')).toEqual({ step: 1, claimed: false, behind: 0, restarted: false });
    expect(dailyTrack({ day: '2026-11-04', step: 6 }, '2026-11-05')).toEqual({ step: 7, claimed: false, behind: 6, restarted: false });
    expect(dailyTrack({ day: '2026-11-05', step: 7 }, '2026-11-05')).toEqual({ step: 7, claimed: true, behind: 6, restarted: false });
    expect(dailyTrack({ day: '2026-11-03', step: 6 }, '2026-11-05')).toEqual({ step: 1, claimed: false, behind: 0, restarted: true });
    expect(dailyTrack({ day: '2026-11-04', step: DAILY_DAYS }, '2026-11-05')).toEqual({ step: 1, claimed: false, behind: 0, restarted: false });
    // Month and year boundaries are ordinary days.
    expect(dailyTrack({ day: '2026-12-31', step: 3 }, '2027-01-01').step).toBe(4);
  });

  it('grows the moon to full on day 15 and wanes it back by day 30', () => {
    expect(moonLight(15)).toEqual({ lit: 1, waxing: true });
    expect(moonLight(30)).toEqual({ lit: 0, waxing: false });
    expect(moonLight(5).lit).toBeLessThan(moonLight(10).lit);
    expect(moonLight(20).waxing).toBe(false);
  });
});
