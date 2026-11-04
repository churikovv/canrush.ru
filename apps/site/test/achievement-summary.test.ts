import { describe, expect, it } from 'vitest';
import { ACHIEVEMENT_TITLES, achievementSummary, earnedDayLabel, TROPHY_POINTS } from '@/lib/achievement-summary';
import { ACHIEVEMENT_METRICS, visibleProfileAchievements, type AchievementProgress } from '@/lib/profile-achievements';

const empty = Object.fromEntries(ACHIEVEMENT_METRICS.map(metric => [metric, 0])) as AchievementProgress;
const summary = (earned: string[], progress: Partial<AchievementProgress> = {}, dates: { key: string; earnedAt: Date }[] = []) =>
  achievementSummary(visibleProfileAchievements(false, earned), earned, { ...empty, ...progress }, dates);

describe('achievement summary', () => {
  it('scores held achievements by rarity and gives the matching title', () => {
    expect(summary([]).score).toBe(0);
    expect(summary([]).title.label).toBe(ACHIEVEMENT_TITLES[0].label);
    const held = summary(['kitty', 'three', 'streak-7', 'engine']);
    expect(held.score).toBe(TROPHY_POINTS.common * 2 + TROPHY_POINTS.rare + TROPHY_POINTS.special);
    expect(held.title.label).toBe('Фанат');
    expect(held.next).toMatchObject({ label: 'Знаток', score: 150, left: 150 - held.score });
    expect(held.earned).toBe(4);
  });

  it('leaves roles and the week tags out of the score and the totals', () => {
    const base = summary([]);
    const withRoles = summary(['admin', 'moderator', 'week-hero']);
    expect(withRoles.score).toBe(0);
    expect(withRoles.earned).toBe(0);
    expect(withRoles.total).toBe(base.total);
  });

  it('counts by rarity only what the member can see, secret tags once held', () => {
    const legendary = (earned: string[]) => summary(earned).rarities.find(row => row.rarity === 'legendary');
    expect(legendary([])).toMatchObject({ earned: 0 });
    expect(legendary(['top'])!.total).toBe(legendary([])!.total + 1);
  });

  it('picks the closest goal that can be worked towards, never the beta number or the contest prize', () => {
    const goal = summary([], { reviews: 3, detailedReviews: 0 }).goal;
    expect(goal?.item.key).toBe('three');
    expect(goal?.completion).toBe(1);
    expect(['engine', 'energizer', 'top']).not.toContain(summary([]).goal?.item.key);
  });

  it('lists the latest earned first, three at most, without role and week tags', () => {
    const now = Date.now();
    const at = (hours: number) => new Date(now - hours * 3_600_000);
    const recent = summary(['kitty', 'three', 'streak-7', 'telegram', 'week-hero'], {}, [
      { key: 'week-hero', earnedAt: at(1) }, { key: 'kitty', earnedAt: at(2) }, { key: 'three', earnedAt: at(3) },
      { key: 'streak-7', earnedAt: at(4) }, { key: 'telegram', earnedAt: at(5) },
    ]).recent;
    expect(recent.map(row => row.item.key)).toEqual(['kitty', 'three', 'streak-7']);
  });

  it('names the day by Moscow time', () => {
    const now = new Date('2026-11-04T09:00:00Z');
    expect(earnedDayLabel(new Date('2026-11-04T01:00:00Z'), now)).toBe('сегодня');
    expect(earnedDayLabel(new Date('2026-11-03T12:00:00Z'), now)).toBe('вчера');
    expect(earnedDayLabel(new Date('2026-10-20T12:00:00Z'), now)).toBe('20 октября');
    expect(earnedDayLabel(new Date('2025-10-20T12:00:00Z'), now)).toBe('20 октября 2025 г.');
  });
});
