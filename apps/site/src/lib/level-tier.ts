export const LEVEL_TIERS = [
  { key: 'rookie', min: 1, label: 'Новичок' },
  { key: 'bronze', min: 3, label: 'Бронза' },
  { key: 'silver', min: 5, label: 'Серебро' },
  { key: 'gold', min: 8, label: 'Золото' },
  { key: 'platinum', min: 12, label: 'Платина' },
  { key: 'legend', min: 20, label: 'Легенда' },
] as const;
export type LevelTier = typeof LEVEL_TIERS[number];

export function levelTier(level: number): { tier: LevelTier; next: LevelTier | null } {
  const index = Math.max(0, LEVEL_TIERS.filter(tier => level >= tier.min).length - 1);
  return { tier: LEVEL_TIERS[index]!, next: LEVEL_TIERS[index + 1] ?? null };
}
