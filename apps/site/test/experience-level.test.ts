import { describe, expect, it } from 'vitest';
import { experienceLevel, shortXp } from '../src/lib/experience-level';
describe('level thresholds', () => {
  it('crosses exact thresholds and resets progress', () => {
    expect(experienceLevel(0)).toMatchObject({ level: 1, current: 0, required: 100 });
    expect(experienceLevel(99)).toMatchObject({ level: 1, remaining: 1 });
    expect(experienceLevel(100)).toMatchObject({ level: 2, current: 0, required: 200 });
    expect(experienceLevel(300)).toMatchObject({ level: 3, current: 0, required: 300 });
    expect(experienceLevel(600)).toMatchObject({ level: 4, current: 0 });
    expect(experienceLevel(NaN).level).toBe(1);
  });
});
describe('short XP', () => {
  it('keeps small values and shortens thousands with K, rounding down', () => {
    expect([0, 904, 999, 1000, 1550, 9999, 10_000, 10_999, 123_456, 1_250_000, NaN].map(shortXp)).toEqual(['0', '904', '999', '1K', '1,5K', '9,9K', '10K', '10K', '123K', '1,2M', '0']);
  });
});
