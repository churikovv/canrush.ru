import { describe, expect, it } from 'vitest';
import { giveawayStatus, moscowInputValue, parseGiveaway, parseMoscowDate, spinsWord } from '../src/lib/spin-giveaway-fields';

const input = { title: '  Крутки   за просмотр ', body: 'Подержите баннер', spins: '3', viewSeconds: '5', maxClaims: '', startsAt: '2026-11-01T10:00', endsAt: '2026-11-03T10:00' };

describe('parseGiveaway', () => {
  it('cleans the text, reads dates as Moscow time and treats an empty limit as none', () => {
    expect(parseGiveaway(input)).toEqual({ title: 'Крутки за просмотр', body: 'Подержите баннер', spins: 3, viewSeconds: 5, maxClaims: null, startsAt: new Date('2026-11-01T07:00:00Z'), endsAt: new Date('2026-11-03T07:00:00Z') });
    expect(parseGiveaway({ ...input, maxClaims: '100' }).maxClaims).toBe(100);
  });

  it.each([
    [{ title: ' ' }, 'заголовок'], [{ title: 'я'.repeat(61) }, 'до 60'], [{ body: '' }, 'текст'], [{ body: 'я'.repeat(141) }, 'до 140'],
    [{ spins: '0' }, 'от 1 до 10'], [{ spins: '11' }, 'от 1 до 10'], [{ spins: '1.5' }, 'от 1 до 10'],
    [{ viewSeconds: '2' }, 'от 3 до 30'], [{ viewSeconds: '31' }, 'от 3 до 30'],
    [{ maxClaims: '0' }, 'целое число'], [{ endsAt: '2026-11-01T10:00' }, 'позже начала'], [{ startsAt: 'завтра' }, 'начало'],
  ])('refuses %j', (patch, message) => {
    expect(() => parseGiveaway({ ...input, ...patch })).toThrow(message);
  });
});

it('turns a date into the form value and back', () => {
  const time = Date.parse('2026-10-30T21:30:00Z');
  expect(moscowInputValue(time)).toBe('2026-10-31T00:30');
  expect(parseMoscowDate(moscowInputValue(time), 'дату').getTime()).toBe(time);
});

it('names the status of a giveaway', () => {
  const now = Date.parse('2026-11-02T00:00:00Z');
  const row = { startsAt: new Date('2026-11-01T00:00:00Z'), endsAt: new Date('2026-11-03T00:00:00Z'), endedAt: null, maxClaims: null, claimed: 0 };
  expect(giveawayStatus(row, now)).toBe('live');
  expect(giveawayStatus(row, row.startsAt.getTime() - 1)).toBe('planned');
  expect(giveawayStatus(row, row.endsAt.getTime())).toBe('finished');
  expect(giveawayStatus({ ...row, maxClaims: 5, claimed: 5 }, now)).toBe('exhausted');
  expect(giveawayStatus({ ...row, endedAt: new Date(now) }, now)).toBe('stopped');
});

it('declines the word', () => {
  expect([1, 2, 5, 11, 21, 22].map(spinsWord)).toEqual(['крутка', 'крутки', 'круток', 'круток', 'крутка', 'крутки']);
});
