/** Total XP at which `level` starts (inverse of `experienceLevel`). */
export function experienceForLevel(level: number): number {
  const target = Math.max(1, Math.floor(level));
  return 50 * target * (target - 1);
}
export function experienceLevel(xp: number) {
  const total = Math.max(0, Math.floor(Number.isFinite(xp) ? xp : 0));
  const level = Math.floor((1 + Math.sqrt(1 + total / 12.5)) / 2);
  const floor = 50 * level * (level - 1);
  const next = 50 * level * (level + 1);
  return { level, total, current: total - floor, required: next - floor, remaining: next - total };
}
/** XP for tight spots (the shield in «Люди»): 904, 9,9K, 10K, 1,2M — rounded down, so a badge never overstates. */
export function shortXp(xp: number): string {
  const value = Math.max(0, Math.floor(Number.isFinite(xp) ? xp : 0));
  const [size, suffix] = value >= 1_000_000 ? [1_000_000, 'M'] : value >= 1000 ? [1000, 'K'] : [1, ''];
  const scaled = value / size;
  const shown = scaled < 10 && size > 1 ? Math.floor(scaled * 10) / 10 : Math.floor(scaled);
  return `${String(shown).replace('.', ',')}${suffix}`;
}
export interface Experience { aheadPercent?: number; xp: number; rank: number | null }
