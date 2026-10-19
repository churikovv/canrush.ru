import { expect, it } from 'vitest';
import { CONTESTS, contestChecklist, contestPhase, currentContest, eligibleForDraw, findContest, moscowDay, type Contest } from '../src/lib/contest';
import { visibleProfileAchievements } from '../src/lib/profile-achievements';

const box = findContest('box-2026-10')!;

it('switches phases on Moscow days, not UTC', () => {
  expect(moscowDay(new Date('2026-10-31T20:59:00Z'))).toBe('2026-10-31');
  expect(contestPhase(box, new Date('2026-10-31T20:59:00Z'))).toBe('open');
  expect(contestPhase(box, new Date('2026-10-31T21:00:00Z'))).toBe('results');
  expect(contestPhase(box, new Date('2026-11-01T21:00:00Z'))).toBe('over');
  const later: Contest = { ...box, key: 'later', firstDay: '2026-12-01', lastDay: '2026-12-20', resultsDay: '2026-12-21' };
  expect(contestPhase(later, new Date('2026-11-15T12:00:00Z'))).toBe('upcoming');
});

it('shows the earliest running contest and nothing once all are over', () => {
  expect(currentContest(new Date('2026-10-20T12:00:00Z'))).toEqual({ contest: box, phase: 'open' });
  expect(currentContest(new Date('2026-11-01T12:00:00Z'))?.phase).toBe('results');
  expect(currentContest(new Date('2027-01-01T12:00:00Z'))).toBeNull();
  expect(new Set(CONTESTS.map(contest => contest.key)).size).toBe(CONTESTS.length);
});

it('requires only the calendar can, contact details narrow the pool when asked', () => {
  const lurker = { cans: 0, telegram: true, avatar: true }, drinker = { cans: 2, telegram: false, avatar: true };
  expect(contestChecklist(drinker).map(item => [item.key, item.done, item.required])).toEqual([['calendar', true, true], ['telegram', false, false], ['avatar', true, false]]);
  expect(eligibleForDraw(lurker, { telegram: false, avatar: false })).toBe(false);
  expect(eligibleForDraw(drinker, { telegram: false, avatar: true })).toBe(true);
  expect(eligibleForDraw(drinker, { telegram: true, avatar: false })).toBe(false);
});

it('keeps the giveaway tag secret until it is earned', () => {
  const keys = (admin: boolean, earned: string[] = []) => visibleProfileAchievements(admin, earned).map(item => item.key);
  expect(keys(false)).not.toContain('energizer');
  expect(keys(false, ['energizer'])).toContain('energizer');
  expect(keys(true)).toContain('energizer');
});
