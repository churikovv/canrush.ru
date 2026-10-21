/**
 * Level tiers and their degrees. `degrees` lists the level each degree starts at; a tier with one degree shows no
 * numeral. Legend is open-ended: a new degree every LEGEND_DEGREE_STEP levels. Migration 0080 (rank_up_step) repeats
 * the levels of announced ranks — change both together.
 */
export const LEVEL_TIERS = [
  { key: 'rookie', min: 1, label: 'Новичок', degrees: [1] },
  { key: 'bronze', min: 3, label: 'Бронза', degrees: [3, 4] },
  { key: 'silver', min: 5, label: 'Серебро', degrees: [5, 6, 7] },
  { key: 'gold', min: 8, label: 'Золото', degrees: [8, 9, 10] },
  { key: 'platinum', min: 12, label: 'Платина', degrees: [12, 15, 18] },
  { key: 'legend', min: 20, label: 'Легенда', degrees: [20] },
] as const;
export type LevelTier = typeof LEVEL_TIERS[number];
export const LEGEND_DEGREE_STEP = 5;

export function levelTier(level: number): { tier: LevelTier; next: LevelTier | null } {
  const index = Math.max(0, LEVEL_TIERS.filter(tier => level >= tier.min).length - 1);
  return { tier: LEVEL_TIERS[index]!, next: LEVEL_TIERS[index + 1] ?? null };
}

export interface LevelRank {
  tier: LevelTier;
  degree: number;
  /** Degrees in the tier; null for the open-ended Legend. */
  degrees: number | null;
  /** First level of this degree. */
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
  const legend = tier.key === 'legend';
  const min = legend ? tier.min + (degree - 1) * LEGEND_DEGREE_STEP : tier.degrees[degree - 1]!;
  const numbered = legend || tier.degrees.length > 1;
  return { tier, degree, degrees: legend ? null : tier.degrees.length, min, label: numbered ? `${tier.label} ${romanNumeral(degree)}` : tier.label };
}

export function levelRank(level: number): LevelRank {
  const { tier } = levelTier(level);
  const degree = tier.key === 'legend'
    ? Math.floor((Math.max(level, tier.min) - tier.min) / LEGEND_DEGREE_STEP) + 1
    : Math.max(1, tier.degrees.filter(min => level >= min).length);
  return rankOf(tier, degree);
}

/** The next step up: the next degree of the tier, or the first degree of the next tier. */
export function nextLevelRank(level: number): LevelRank {
  const current = levelRank(level);
  if (current.degrees === null || current.degree < current.degrees) return rankOf(current.tier, current.degree + 1);
  return rankOf(levelTier(level).next!, 1);
}

/** Tiers whose reaching is announced in the feed (the "rankUp" table); Legend also announces every degree. */
export const RANK_UP_TIERS = ['gold', 'platinum', 'legend'] as const satisfies readonly LevelTier['key'][];
export type RankUpTier = typeof RANK_UP_TIERS[number];

export function rankUpRank(tier: RankUpTier, degree: number): LevelRank {
  return rankOf(LEVEL_TIERS.find(item => item.key === tier)!, tier === 'legend' ? Math.max(1, degree) : 1);
}
