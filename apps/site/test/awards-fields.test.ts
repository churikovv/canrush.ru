import { describe, expect, it } from 'vitest';
import { AWARD, AWARD_MIN_ACCOUNT_DAYS, AWARD_SEEDS, awardPhase, isSugarFreeDrink, seedNominees, voteBlock, voteShare, votesLabel, type RatedDrink } from '../src/lib/awards-fields';

const drink = (flavor: string, reviews: number, taste: number, design: number): RatedDrink => ({ brand: 'Burn', flavor, reviews, taste, design });

describe('«Премия за энергию»', () => {
  it('opens, closes and keeps the results on the home page for a while', () => {
    expect(awardPhase(Date.parse(AWARD.opensAt) - 1)).toBe('upcoming');
    expect(awardPhase(Date.parse(AWARD.opensAt))).toBe('open');
    expect(awardPhase(Date.parse(AWARD.closesAt) - 1)).toBe('open');
    expect(awardPhase(Date.parse(AWARD.closesAt))).toBe('results');
    expect(awardPhase(Date.parse(AWARD.shownUntil))).toBe('over');
    // Voting runs to the end of the 27th of December, Moscow time.
    expect(new Date(Date.parse(AWARD.closesAt) - 1).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'long' })).toBe(AWARD.lastDayLabel);
  });

  it('nominates by a Bayesian average: three glowing reviews do not beat a hundred good ones', () => {
    // Close to production (November 2026): the catalog's average is about 6.3, the best drink with 3 reviews has 9.0.
    const drinks = [drink('mango', 120, 7.6, 7.4), drink('cherry', 3, 9, 9), drink('lemon', 2, 10, 10), drink('apple', 40, 5, 9.5), drink('cola', 200, 5.5, 5.5)];
    expect(seedNominees('drink', drinks).map(item => item.flavor)).toEqual(['mango', 'cherry', 'apple', 'cola']);
    // The design category looks at the can: the apple's great design wins it.
    expect(seedNominees('design', drinks)[0]!.flavor).toBe('apple');
    expect(seedNominees('taste', drinks).map(item => item.flavor)).not.toContain('lemon');
    const many = Array.from({ length: 20 }, (_, index) => drink(`f${index}`, 10, 7, 7));
    expect(seedNominees('taste', many)).toHaveLength(AWARD_SEEDS);
  });

  it('keeps «Лучший без сахара» to drinks without sugar', () => {
    expect(isSugarFreeDrink('mango:sugarfree')).toBe(true);
    expect(isSugarFreeDrink('apple:sweetener')).toBe(true);
    expect(isSugarFreeDrink('blend:mango+peach:sugarfree')).toBe(true);
    expect(isSugarFreeDrink('monster_ultra_white')).toBe(true);
    expect(isSugarFreeDrink('original', 'Red Bull · Оригинальный · без сахара')).toBe(true);
    expect(isSugarFreeDrink('mango')).toBe(false);
    expect(isSugarFreeDrink('sugarfreedom')).toBe(false);
    const drinks = [drink('mango', 50, 9, 9), drink('mango:sugarfree', 10, 8, 8)];
    expect(seedNominees('sugarfree', drinks).map(item => item.flavor)).toEqual(['mango:sugarfree']);
  });

  it('lets members with a nickname and a few days on the site vote', () => {
    const now = Date.parse('2026-12-01T12:00:00+03:00');
    const old = new Date(now - (AWARD_MIN_ACCOUNT_DAYS + 1) * 86_400_000);
    expect(voteBlock(null, now)).toMatch('Войдите');
    expect(voteBlock({ username: 'cola', blocked: false, createdAt: old }, now)).toBeNull();
    expect(voteBlock({ username: null, blocked: false, createdAt: old }, now)).toMatch('ник');
    expect(voteBlock({ username: 'cola', blocked: true, createdAt: old }, now)).toMatch('заблокирован');
    expect(voteBlock({ username: 'cola', blocked: false, createdAt: new Date(now - 86_400_000) }, now)).toMatch(`через ${AWARD_MIN_ACCOUNT_DAYS} дня`);
  });

  it('writes votes and shares', () => {
    expect([votesLabel(1), votesLabel(3), votesLabel(11), votesLabel(1234)]).toEqual(['1 голос', '3 голоса', '11 голосов', '1\u00a0234 голоса']);
    expect([voteShare(1, 3), voteShare(0, 0), voteShare(5, 5)]).toEqual([33, 0, 100]);
  });
});
