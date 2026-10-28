/** Pure helpers of the drink calendar: Moscow days, streaks, month grids and form parsing. */
export class DrinkCalendarError extends Error {}

/** Cans one member can log per day; protects the calendar from scripted spam. */
export const DRINKS_PER_DAY = 10;
/** Days back (0 = today) a can can be logged or removed: forgetting yesterday is fine, rewriting history is not. */
export const DRINK_EDIT_WINDOW_DAYS = 1;
export const DRINK_DAY_XP = 10;
/** Streak lengths that pay a one-time bonus; after the last one every further 30 days pays again. */
export const STREAK_MILESTONES = [3, 7, 14, 30] as const;
export const STREAK_REPEAT_DAYS = 30;
export function streakReward(length: number): number { return length * 10; }

export interface DrinkStreak { start: string; end: string; length: number }
export interface DrinkInput { day: string; name: string; brand?: string; flavor?: string; price: number | null; store: string | null }

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;
const moscow = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' });

export function moscowDay(at: Date = new Date()): string { return moscow.format(at); }
export function isDay(value: unknown): value is string {
  return typeof value === 'string' && DAY.test(value) && toUtc(value).toISOString().slice(0, 10) === value;
}
function toUtc(day: string): Date { return new Date(`${day}T00:00:00Z`); }
export function addDays(day: string, amount: number): string {
  const date = toUtc(day); date.setUTCDate(date.getUTCDate() + amount); return date.toISOString().slice(0, 10);
}
export function dayDiff(from: string, to: string): number { return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000); }
/** Monday-based weekday: 0 = Monday … 6 = Sunday. */
export function weekday(day: string): number { return (toUtc(day).getUTCDay() + 6) % 7; }

/** Consecutive runs of days with at least one can, oldest first. Accepts unsorted days with repeats. */
export function drinkStreaks(days: Iterable<string>): DrinkStreak[] {
  const sorted = [...new Set(days)].sort();
  const streaks: DrinkStreak[] = [];
  for (const day of sorted) {
    const last = streaks.at(-1);
    if (last && dayDiff(last.end, day) === 1) { last.end = day; last.length++; }
    else streaks.push({ start: day, end: day, length: 1 });
  }
  return streaks;
}

/** The streak still alive today: it ends today, or yesterday while today's can is not logged yet. */
export function currentStreak(streaks: readonly DrinkStreak[], today: string): DrinkStreak | null {
  const last = streaks.at(-1);
  return last && dayDiff(last.end, today) <= 1 && dayDiff(last.end, today) >= 0 ? last : null;
}
export function bestStreak(streaks: readonly DrinkStreak[]): number { return streaks.reduce((best, item) => Math.max(best, item.length), 0); }
export function streakOn(streaks: readonly DrinkStreak[], day: string): DrinkStreak | undefined {
  return streaks.find(item => item.start <= day && day <= item.end);
}

/** Every milestone a streak has reached; the key stays stable while the streak keeps its first day. */
export function reachedMilestones(streak: DrinkStreak): number[] {
  const last = STREAK_MILESTONES.at(-1)!;
  const reached: number[] = STREAK_MILESTONES.filter(goal => streak.length >= goal);
  for (let goal = last + STREAK_REPEAT_DAYS; goal <= streak.length; goal += STREAK_REPEAT_DAYS) reached.push(goal);
  return reached;
}

export function isMonth(value: unknown): value is string {
  return typeof value === 'string' && MONTH.test(value) && Number(value.slice(5)) >= 1 && Number(value.slice(5)) <= 12;
}
export function shiftMonth(month: string, amount: number): string {
  const date = new Date(`${month}-01T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() + amount); return date.toISOString().slice(0, 7);
}
export function monthDays(month: string): string[] {
  const days: string[] = [];
  for (let day = `${month}-01`; day.startsWith(month); day = addDays(day, 1)) days.push(day);
  return days;
}
/** Weeks of a month view, Monday first; days of neighbouring months are null. */
export function monthWeeks(month: string): (string | null)[][] {
  const days = monthDays(month);
  const cells: (string | null)[] = [...Array<null>(weekday(days[0]!)).fill(null), ...days];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7));
}
/** GitHub-style columns ending with the week of `today`: each column is Monday…Sunday, future days are null. */
export function heatmapWeeks(today: string, weeks: number): (string | null)[][] {
  const monday = addDays(today, -weekday(today) - (weeks - 1) * 7);
  return Array.from({ length: weeks }, (_, column) => Array.from({ length: 7 }, (_, row) => {
    const day = addDays(monday, column * 7 + row);
    return day <= today ? day : null;
  }));
}
export function heatLevel(count: number): 0 | 1 | 2 | 3 | 4 { return count <= 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : count === 3 ? 3 : 4; }

export function canEditDay(day: string, today: string): boolean {
  const back = dayDiff(day, today);
  return back >= 0 && back <= DRINK_EDIT_WINDOW_DAYS;
}

/** Rubles from the form ("129", "129,90") to kopecks; empty means not given. */
export function parseDrinkPrice(value: unknown): number | null {
  const raw = typeof value === 'string' ? value.trim().replace(',', '.').replace(/\s+/g, '') : '';
  if (!raw) return null;
  const price = Math.round(Number(raw) * 100);
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(raw) || !Number.isSafeInteger(price) || price < 1 || price > 10_000_000) throw new DrinkCalendarError('Укажите цену от 0,01 до 100 000 ₽.');
  return price;
}

export function parseDrinkForm(form: FormData, today: string): DrinkInput {
  const day = form.get('day');
  if (!isDay(day) || !canEditDay(day, today)) throw new DrinkCalendarError('Отметить можно только сегодня или вчера.');
  const name = String(form.get('name') ?? '').trim();
  if (!name || name.length > 150) throw new DrinkCalendarError('Выберите энергетик или впишите свой (до 150 символов).');
  const brand = String(form.get('brand') ?? '').trim(), flavor = String(form.get('flavor') ?? '').trim();
  const store = String(form.get('store') ?? '').trim();
  if (store.length > 80) throw new DrinkCalendarError('Название магазина — до 80 символов.');
  return { day, name, ...(brand && flavor && brand.length <= 100 && flavor.length <= 200 ? { brand, flavor } : {}), price: parseDrinkPrice(form.get('price')), store: store || null };
}

export function pluralRu(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10, mod100 = count % 100;
  return mod10 === 1 && mod100 !== 11 ? one : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? few : many;
}
export const cans = (count: number) => `${count} ${pluralRu(count, 'банка', 'банки', 'банок')}`;
export const days = (count: number) => `${count} ${pluralRu(count, 'день', 'дня', 'дней')}`;

const MONTH_NAMES = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const MONTH_GENITIVE = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export function monthTitle(month: string): string {
  const name = MONTH_NAMES[Number(month.slice(5)) - 1] ?? '';
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${month.slice(0, 4)}`;
}
export function dayTitle(day: string): string { return `${Number(day.slice(8))} ${MONTH_GENITIVE[Number(day.slice(5, 7)) - 1] ?? ''}`; }

export type BirdMood = 'happy' | 'waiting' | 'sleepy';
export function birdMood(current: DrinkStreak | null, today: string): BirdMood {
  return !current ? 'sleepy' : current.end === today ? 'happy' : 'waiting';
}
/** What the mascot says; the owner hears a nudge, visitors a status. */
export function birdLine(mood: BirdMood, streak: number, isOwn: boolean): string {
  if (mood === 'happy') return streak > 1 ? `Серия ${days(streak)}! Так держать.` : 'Первый день серии. Завтра — второй!';
  if (mood === 'waiting') return isOwn ? `Серия ${days(streak)} сгорит в полночь — отметь банку сегодня.` : `Серия ${days(streak)}, сегодня ещё без отметки.`;
  return isOwn ? 'Канлинго спит. Отметь и начни серию' : 'Серии пока нет — птица спит.';
}

export interface MonthSummary { cans: number; days: number; unique: number; top: { name: string; count: number } | null; spent: number; priced: number }
export function monthSummary(entries: readonly { day: string; name: string; price: number | null }[]): MonthSummary {
  const byName = new Map<string, number>();
  for (const entry of entries) byName.set(entry.name, (byName.get(entry.name) ?? 0) + 1);
  const top = [...byName].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ru'))[0];
  const priced = entries.filter(entry => entry.price !== null);
  return { cans: entries.length, days: new Set(entries.map(entry => entry.day)).size, unique: byName.size,
    top: top ? { name: top[0], count: top[1] } : null, spent: priced.reduce((sum, entry) => sum + entry.price!, 0), priced: priced.length };
}

/** The next streak length that pays a bonus. */
export function nextMilestone(length: number): number {
  const goal = STREAK_MILESTONES.find(item => item > length);
  if (goal) return goal;
  const last = STREAK_MILESTONES.at(-1)!;
  return last + Math.ceil((length - last + 1) / STREAK_REPEAT_DAYS) * STREAK_REPEAT_DAYS;
}
/** Flame colour tier of a streak: matches the 7 / 14 / 30 day tags. */
export function streakTier(length: number): 0 | 7 | 14 | 30 { return length >= 30 ? 30 : length >= 14 ? 14 : length >= 7 ? 7 : 0; }

/** «Вернуть огонёк»: one restore per this many days, for a missed day no older than this. */
export const STREAK_RESTORE_COOLDOWN_DAYS = 15;
export const STREAK_RESTORE_WINDOW_DAYS = 3;
export type StreakRestore = { day: string; length: number } | { availableOn: string } | null;

/**
 * The missed day a member may restore: the most recent day in the last few that is the only gap after a run of two
 * or more days — the run before it ended the day before, and the day after it is logged, or it is yesterday (the
 * streak is about to go out). Restoring it joins the runs: `length` is the streak it brings back. Within the cooldown
 * after the last restore the answer is the date it becomes possible again instead.
 */
export function streakRestore(streakDays: Iterable<string>, today: string, lastRestore: string | null): StreakRestore {
  const have = new Set(streakDays);
  const runs = drinkStreaks(have);
  for (let back = 1; back <= STREAK_RESTORE_WINDOW_DAYS; back += 1) {
    const day = addDays(today, -back);
    if (have.has(day) || !have.has(addDays(day, -1))) continue;
    const after = addDays(day, 1);
    if (back > 1 && !have.has(after)) continue;
    const before = streakOn(runs, addDays(day, -1))!;
    if (before.length < 2) continue;
    if (lastRestore && dayDiff(lastRestore, today) < STREAK_RESTORE_COOLDOWN_DAYS) return { availableOn: addDays(lastRestore, STREAK_RESTORE_COOLDOWN_DAYS) };
    const next = have.has(after) ? streakOn(runs, after)! : null;
    return { day, length: before.length + 1 + (next?.length ?? 0) };
  }
  return null;
}

/** Flame colours like TikTok's streaks, the top tier in the brand blue: orange, pink from 30, purple from 100, blue from 200. */
export type FlameTier = 'orange' | 'pink' | 'purple' | 'blue';
export function flameTier(length: number): FlameTier { return length >= 200 ? 'blue' : length >= 100 ? 'purple' : length >= 30 ? 'pink' : 'orange'; }
