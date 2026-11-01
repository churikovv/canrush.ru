import { describe, expect, it } from 'vitest';
import { HUNT_ITEMS, HUNT_LEVELS, HUNT_MIN_CASHOUT, HUNT_STAGES, HUNT_TASKS, HuntError, huntLastDay, huntLevelReached, huntMinCashout, huntPayoutLabel, huntPhase, huntProgress, huntStage, parseHuntOrder, parseHuntPayout, type HuntEvent } from '../src/lib/hunt-fields';
import { storeGaps } from '../src/lib/hunt-gaps';

const event: HuntEvent = { key: 'test', startsAt: '2026-11-01T21:00:00.000Z', endsAt: '2026-11-30T21:00:00.000Z', reviewUntil: '2026-12-03T21:00:00.000Z', burnsAt: '2026-12-07T21:00:00.000Z', budget: 500 };
const sbp = { method: 'sbp', phone: '8 (900) 123-45-67', bank: ' Т-Банк ' };

describe('levels', () => {
  it('pays 500 tags for twenty full stores', () => {
    const full = HUNT_TASKS.find(task => task.key === 'full')!.amount;
    expect(full * 20 + HUNT_LEVELS.reduce((sum, level) => sum + level.amount, 0)).toBe(500);
    expect(HUNT_LEVELS.at(-1)!.stores).toBe(20);
    expect(huntLevelReached(4)).toBe(0);
    expect(huntLevelReached(5)).toBe(1);
  });

  it('counts the way to the next bonus and stops at the top', () => {
    expect(huntProgress(7)).toEqual({ left: 3, share: 0.4 });
    expect(huntProgress(20)).toBeNull();
  });

  it('grows the shop with the level', () => {
    expect(huntStage(0)).toBe(1);
    expect(huntStage(HUNT_LEVELS.length)).toBe(HUNT_STAGES.length);
    for (const stage of HUNT_STAGES) expect(stage.from).toBeLessThanOrEqual(HUNT_LEVELS.length);
  });
});

describe('event', () => {
  it('moves through its phases by Moscow days', () => {
    expect(huntPhase(event, Date.parse('2026-11-01T20:59:59Z'))).toBe('upcoming');
    expect(huntPhase(event, Date.parse('2026-11-01T21:00:00Z'))).toBe('open');
    expect(huntPhase(event, Date.parse('2026-11-30T21:00:00Z'))).toBe('exchange');
    expect(huntPhase(event, Date.parse('2026-12-07T21:00:00Z'))).toBe('over');
    expect(huntLastDay(event.endsAt)).toBe('30 ноября');
    expect(huntLastDay(event.burnsAt)).toBe('7 декабря');
  });

  it('drops the minimum for the exchange days: small sums should not burn because of it', () => {
    expect(huntMinCashout('open')).toBe(HUNT_MIN_CASHOUT);
    expect(huntMinCashout('exchange')).toBe(1);
    expect(parseHuntOrder({ item: 'rub', amount: 20, confirmed: true, payout: sbp }, 'exchange').amount).toBe(20);
    expect(() => parseHuntOrder({ item: 'rub', amount: 20, confirmed: true, payout: sbp }, 'open')).toThrow(HuntError);
  });
});

describe('payout details', () => {
  it('takes a mobile number in any spelling and the bank', () => {
    expect(parseHuntPayout(sbp)).toEqual({ method: 'sbp', phone: '+79001234567', bank: 'Т-Банк' });
    expect(parseHuntPayout({ method: 'sbp', phone: '+7 900 123 45 67', bank: 'Сбер' })).toMatchObject({ phone: '+79001234567' });
    expect(() => parseHuntPayout({ method: 'sbp', phone: '+7 495 123 45 67', bank: 'Сбер' })).toThrow(/мобильный/);
    expect(() => parseHuntPayout({ method: 'sbp', phone: '+7 900 123 45 67', bank: '' })).toThrow(/банк/);
  });

  it('checks a card number and shows it in groups', () => {
    const card = parseHuntPayout({ method: 'card', number: '4242 4242 4242 4242' });
    expect(card).toEqual({ method: 'card', number: '4242424242424242' });
    expect(huntPayoutLabel(card)).toBe('Карта 4242 4242 4242 4242');
    expect(() => parseHuntPayout({ method: 'card', number: '4242 4242 4242 4241' })).toThrow(/номер карты/);
    expect(() => parseHuntPayout({})).toThrow(HuntError);
  });
});

describe('orders', () => {
  it('takes rubles from the minimum, with the confirmation and details only', () => {
    expect(parseHuntOrder({ item: 'rub', amount: HUNT_MIN_CASHOUT, confirmed: true, payout: sbp }, 'open').payout).toMatchObject({ method: 'sbp' });
    expect(() => parseHuntOrder({ item: 'rub', amount: 100.5, confirmed: true, payout: sbp }, 'open')).toThrow(HuntError);
    expect(() => parseHuntOrder({ item: 'rub', amount: HUNT_MIN_CASHOUT, payout: sbp }, 'open')).toThrow(/18 лет/);
    expect(() => parseHuntOrder({ item: 'rub', amount: HUNT_MIN_CASHOUT, confirmed: true }, 'open')).toThrow(/куда перевести/);
  });

  it('does not sell what is not on the shelf yet', () => {
    for (const item of HUNT_ITEMS.filter(entry => entry.soon)) expect(() => parseHuntOrder({ item: item.key }, 'open')).toThrow(HuntError);
    expect(() => parseHuntOrder({ item: 'nothing' }, 'open')).toThrow(HuntError);
  });
});

it('tells what a store still needs', () => {
  expect(storeGaps({ prices: 2, photo: false, located: true })).toEqual(['фото', 'ещё 3 цен']);
  expect(storeGaps({ prices: 5, photo: true, located: true })).toEqual([]);
});
