/**
 * Гонка недели и пропуск сезона: правила без базы данных. Сезон — календарный месяц по Москве, октябрь 2026 — первый.
 * Награды недели повторяют `settle_weekly_top` (миграция `0175`), меняй вместе.
 */
import type { Rarity } from '@/lib/gacha-fields';

const FIRST_SEASON_YEAR = 2026;
const FIRST_SEASON_MONTH = 10;

/** Мест с наградой в гонке недели. */
export const TOP_PLACES = 10;

/** `YYYY-MM` → номер сезона. */
export function seasonNumber(month: string) {
  const [year, index] = month.split('-').map(Number) as [number, number];
  return (year - FIRST_SEASON_YEAR) * 12 + index - FIRST_SEASON_MONTH + 1;
}

export const seasonTitle = (month: string) => `Сезон ${seasonNumber(month)}`;

/** Дней до конца месяца по Москве, сегодняшний считается: последний день месяца — 1. */
export function seasonDaysLeft(day: string) {
  const [year, month, date] = day.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month, 0)).getUTCDate() - date + 1;
}

export const WEEK_TAGS = ['week-hero', 'week-best', 'week-charge'] as const;
export type WeekTag = (typeof WEEK_TAGS)[number];

/** Тег недели выдаётся на следующую неделю и снимается при следующих итогах. */
export const WEEK_PRIZES: readonly { places: string; last: number; xp: number; tag: WeekTag }[] = [
  { places: '1', last: 1, xp: 2000, tag: 'week-hero' },
  { places: '2–5', last: 5, xp: 1000, tag: 'week-best' },
  { places: '6–10', last: 10, xp: 350, tag: 'week-charge' },
];
export const weekPrize = (place: number) => WEEK_PRIZES.find(prize => place <= prize.last) ?? null;

const MOSCOW_OFFSET = 3 * 3_600_000;
/** Конец идущей недели: понедельник 00:00 по Москве, верхняя граница `weekly_top_bounds`. Перевода часов в Москве нет. */
export function weekEndsAt(now: number) {
  const moscow = new Date(now + MOSCOW_OFFSET);
  const daysLeft = 7 - (moscow.getUTCDay() + 6) % 7;
  return Date.UTC(moscow.getUTCFullYear(), moscow.getUTCMonth(), moscow.getUTCDate() + daysLeft) - MOSCOW_OFFSET;
}

/** Остаток для таймера; время вышло — нули. */
export function countdownParts(left: number) {
  const total = Math.max(0, Math.ceil(left / 1000));
  return { days: Math.floor(total / 86_400), hours: Math.floor(total / 3600) % 24, minutes: Math.floor(total / 60) % 60, seconds: total % 60 };
}

export type WeekGoal = { kind: 'here' } | { kind: 'above' } | { kind: 'open' } | { kind: 'gap'; xp: number };
/** Где участник относительно группы мест. `leaders` — опыт десятки сверху вниз; равный опыт уступает тому, кто набрал раньше, поэтому нужно на единицу больше. */
export function weekGoal(prize: (typeof WEEK_PRIZES)[number], leaders: readonly number[], viewer: { place: number; xp: number } | null): WeekGoal {
  const first = (WEEK_PRIZES[WEEK_PRIZES.indexOf(prize) - 1]?.last ?? 0) + 1;
  if (viewer && viewer.place <= prize.last) return viewer.place >= first ? { kind: 'here' } : { kind: 'above' };
  const target = leaders[prize.last - 1];
  return target === undefined ? { kind: 'open' } : { kind: 'gap', xp: target - (viewer?.xp ?? 0) + 1 };
}

/** В очки пропуска не идут награды рейтинга и трекер банок: сайт 18+, награда не должна подталкивать пить. */
export const PASS_EXCLUDED_REASONS = ['monthly-top', 'weekly-top', 'drink-day', 'drink-streak'] as const;

export type PassRewardKind = 'caps' | 'shards' | 'spins' | 'rings';
export interface PassLevel { points: number; kind: PassRewardKind; amount: number }

/** Бесплатный пропуск: купить уровни нельзя, иначе крышки и крутки стали бы платными. */
export const PASS_LEVELS: readonly PassLevel[] = [
  { points: 25, kind: 'caps', amount: 10 },
  { points: 75, kind: 'shards', amount: 5 },
  { points: 150, kind: 'spins', amount: 1 },
  { points: 300, kind: 'caps', amount: 20 },
  { points: 500, kind: 'rings', amount: 3 },
  { points: 750, kind: 'spins', amount: 1 },
  { points: 1000, kind: 'caps', amount: 30 },
  { points: 1400, kind: 'shards', amount: 15 },
  { points: 2000, kind: 'spins', amount: 2 },
  { points: 2800, kind: 'caps', amount: 50 },
  { points: 3800, kind: 'rings', amount: 6 },
  { points: 5000, kind: 'spins', amount: 2 },
  { points: 7000, kind: 'shards', amount: 40 },
  { points: 9500, kind: 'caps', amount: 100 },
  { points: 13000, kind: 'spins', amount: 5 },
];

/** Длина петли сцены пропуска: один оборот банки в `build_pass_can.py`. */
export const PASS_LOOP_SECONDS = 6;

/**
 * Банка пропуска растёт с уровнем: `from` — уровень, на котором стадия открывается. Сцены — `public/brand/pass/can-<номер
 * стадии>`, рендер — `marketing/design/3d/build_pass_can.py`. Это украшение витрины, а не товар: своего напитка и бренда чужих в ней нет.
 */
export const PASS_STAGES: readonly { from: number; name: string; line: string; rarity: Rarity }[] = [
  { from: 0, name: 'Жестянка', line: 'Голый алюминий. С неё начинается каждый сезон.', rarity: 'common' },
  { from: 3, name: 'Фирменная', line: 'Фирменный синий и имя на всю банку.', rarity: 'rare' },
  { from: 6, name: 'Неоновая', line: 'Ночной цвет и светящиеся линии.', rarity: 'epic' },
  { from: 9, name: 'Золотая', line: 'Чёрный металл, золотая фольга и свита из крышек.', rarity: 'epic' },
  { from: 12, name: 'Легенда', line: 'Голограмма, молнии и кольца вокруг.', rarity: 'legendary' },
];

/** Номер стадии банки (с 1) на уровне пропуска. */
export const passStage = (level: number) => PASS_STAGES.filter(stage => level >= stage.from).length;
/** Стадия, которую открывает именно этот уровень. */
export const passStageOpensAt = (level: number) => (level > 0 ? PASS_STAGES.find(stage => stage.from === level) : undefined);

export const passLevelReached = (points: number) => PASS_LEVELS.filter(level => points >= level.points).length;

/** Уровни, которые можно забрать: достигнутые и ещё не забранные, номера с единицы. */
export function passClaimable(points: number, claimed: ReadonlySet<number>) {
  const reached = passLevelReached(points);
  return PASS_LEVELS.flatMap((level, index) => (index < reached && !claimed.has(index + 1) ? [{ ...level, level: index + 1 }] : []));
}

/** Сколько очков до следующего уровня и доля пройденного пути к нему; на последнем уровне — `null`. */
export function passProgress(points: number) {
  const reached = passLevelReached(points);
  const next = PASS_LEVELS[reached];
  if (!next) return null;
  const from = PASS_LEVELS[reached - 1]?.points ?? 0;
  return { left: next.points - points, share: (points - from) / (next.points - from) };
}
