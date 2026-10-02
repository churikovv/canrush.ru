export function experienceLevel(xp: number) {
  const total = Math.max(0, Math.floor(Number.isFinite(xp) ? xp : 0));
  const level = Math.floor((1 + Math.sqrt(1 + total / 12.5)) / 2);
  const floor = 50 * level * (level - 1);
  const next = 50 * level * (level + 1);
  return { level, total, current: total - floor, required: next - floor, remaining: next - total };
}
export interface Experience { xp: number; rank: number | null }
