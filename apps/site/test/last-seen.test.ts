import { describe, expect, it } from 'vitest';
import { joinedLabel, lastSeenLabel } from '../src/lib/last-seen';

const now = new Date('2026-10-14T12:00:00+03:00');

describe('lastSeenLabel', () => {
  it('describes recent visits in minutes with Russian plurals', () => {
    expect(lastSeenLabel(new Date('2026-10-14T11:59:40+03:00'), now)).toBe('только что');
    expect(lastSeenLabel(new Date('2026-10-14T11:59:00+03:00'), now)).toBe('1 минуту назад');
    expect(lastSeenLabel(new Date('2026-10-14T11:57:00+03:00'), now)).toBe('3 минуты назад');
    expect(lastSeenLabel(new Date('2026-10-14T11:48:00+03:00'), now)).toBe('12 минут назад');
  });
  it('uses Moscow calendar days for today, yesterday and older dates', () => {
    expect(lastSeenLabel(new Date('2026-10-14T08:05:00+03:00'), now)).toBe('сегодня в 08:05');
    expect(lastSeenLabel(new Date('2026-10-13T23:30:00+03:00'), now)).toBe('вчера в 23:30');
    expect(lastSeenLabel(new Date('2026-10-03T10:00:00+03:00'), now)).toBe('3 октября');
    expect(lastSeenLabel(new Date('2025-12-31T10:00:00+03:00'), now)).toBe('31 декабря 2025 г.');
  });
});

it('puts the join month in the genitive case', () => {
  expect(joinedLabel('2026-09-10T00:00:00+03:00')).toBe('сентября 2026 г.');
});
