import { experienceLevel } from '@/lib/experience-level';

/**
 * Level tiers and their degrees. `degrees` lists where each degree starts on the rank road, in levels; a tier with one
 * degree shows no numeral. The first two tiers have degrees inside a level too (1.25 is a quarter of the way to level 2),
 * so a newcomer sees the first review or day move the rank (`rankPosition`). Myth is open-ended: a new degree every
 * TOP_DEGREE_STEP levels. Migrations 0080 and 0200 (rank_up_step) repeat the levels of announced ranks — change together.
 */
export const LEVEL_TIERS = [
  // Новичок I–V: 0, 25, 50, 100 (level 2) and 200 XP. Бронза I–IV: 300 (level 3), 450, 600 (level 4) and 800 XP.
  { key: 'rookie', min: 1, label: 'Новичок', degrees: [1, 1.25, 1.5, 2, 2.5] },
  { key: 'bronze', min: 3, label: 'Бронза', degrees: [3, 3.5, 4, 4.5] },
  { key: 'silver', min: 5, label: 'Серебро', degrees: [5, 6, 7] },
  { key: 'gold', min: 8, label: 'Золото', degrees: [8, 9, 10] },
  { key: 'platinum', min: 12, label: 'Платина', degrees: [12, 15, 18] },
  { key: 'legend', min: 20, label: 'Легенда', degrees: [20, 25, 30, 35] },
  { key: 'myth', min: 40, label: 'Миф', degrees: [40] },
] as const;
export type LevelTier = typeof LEVEL_TIERS[number];
/** Myth, the top rank, adds a degree this many levels apart, without end. */
export const TOP_DEGREE_STEP = 5;
const TOP = 'myth';

/** Where XP stands on the rank road, in levels with the share of the current one: 120 XP is 2.1, a tenth past level 2. */
export function rankPosition(xp: number): number {
  const { level, current, required } = experienceLevel(xp);
  return level + current / required;
}

/** XP where a place on the rank road starts — the inverse of `rankPosition`. */
export function experienceAtPosition(position: number): number {
  const level = Math.max(1, Math.floor(position));
  return Math.round(50 * level * (level - 1) + (position - level) * 100 * level);
}

export function levelTier(level: number): { tier: LevelTier; next: LevelTier | null } {
  const index = Math.max(0, LEVEL_TIERS.filter(tier => level >= tier.min).length - 1);
  return { tier: LEVEL_TIERS[index]!, next: LEVEL_TIERS[index + 1] ?? null };
}

export interface LevelRank {
  tier: LevelTier;
  degree: number;
  /** Degrees in the tier; null for the open-ended Myth. */
  degrees: number | null;
  /** Where this degree starts on the rank road, in levels (a fraction for the early degrees). */
  min: number;
  /** «Серебро II»; a tier with a single degree is just its name. */
  label: string;
}

const NUMERALS: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
export function romanNumeral(value: number): string {
  let rest = Math.max(1, Math.floor(value));
  return NUMERALS.reduce((result, [size, numeral]) => {
    const count = Math.floor(rest / size);
    rest -= count * size;
    return result + numeral.repeat(count);
  }, '');
}

function rankOf(tier: LevelTier, degree: number): LevelRank {
  const top = tier.key === TOP;
  const min = top ? tier.min + (degree - 1) * TOP_DEGREE_STEP : tier.degrees[degree - 1]!;
  const numbered = top || tier.degrees.length > 1;
  return { tier, degree, degrees: top ? null : tier.degrees.length, min, label: numbered ? `${tier.label} ${romanNumeral(degree)}` : tier.label };
}

/**
 * The rank at a place on the road: a whole level (the degree at that level's start) or `rankPosition(xp)` for the
 * member's exact degree. Pass the position wherever the XP is known — the early degrees fall inside levels.
 */
export function levelRank(position: number): LevelRank {
  const { tier } = levelTier(position);
  const degree = tier.key === TOP
    ? Math.floor((Math.max(Math.floor(position), tier.min) - tier.min) / TOP_DEGREE_STEP) + 1
    : Math.max(1, tier.degrees.filter(min => position >= min).length);
  return rankOf(tier, degree);
}

/** The next step up: the next degree of the tier, or the first degree of the next tier. */
export function nextLevelRank(position: number): LevelRank {
  const current = levelRank(position);
  if (current.degrees === null || current.degree < current.degrees) return rankOf(current.tier, current.degree + 1);
  return rankOf(levelTier(position).next!, 1);
}

/** Whether a tier has degrees inside levels, so a bare level cannot name the degree. */
export const hasPartialDegrees = (tier: LevelTier) => tier.degrees.some(min => !Number.isInteger(min));

/** Tiers whose reaching is announced in the feed (the "rankUp" table); Legend and Myth announce every degree. */
export const RANK_UP_TIERS = ['gold', 'platinum', 'legend', 'myth'] as const satisfies readonly LevelTier['key'][];
export type RankUpTier = typeof RANK_UP_TIERS[number];
/** Tiers announced on each degree, not only the first. */
export const isDegreeAnnounced = (tier: string) => tier === 'legend' || tier === TOP;

export function rankUpRank(tier: RankUpTier, degree: number): LevelRank {
  const found = LEVEL_TIERS.find(item => item.key === tier)!;
  // Legend has four degrees now; an announced degree past them (none exist) reads as its last one.
  return rankOf(found, isDegreeAnnounced(tier) ? Math.max(1, found.key === TOP ? degree : Math.min(degree, found.degrees.length)) : 1);
}
