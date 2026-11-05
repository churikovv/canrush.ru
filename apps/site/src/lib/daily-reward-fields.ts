/**
 * «Лунный цикл» — daily rewards: a path of 30 days, one reward a day. Missing a day starts the path over from day one,
 * and after day 30 it starts again. Every day gives XP and sparks, every fifth day a thing of its own instead: two
 * tags, two profile backgrounds and two frames, drawn after the phases of the moon. A thing already owned (a later
 * cycle) turns into sparks. The rewards are fixed — no chance in them — and nothing here is about drinking. Pure: no
 * database, safe for the browser.
 */

export const DAILY_DAYS = 30;
export type DailyItemKind = 'tag' | 'theme' | 'frame';
/** `note` — what it looks like, for the day's details in the window. */
export interface DailyItem { kind: DailyItemKind; key: string; label: string; note: string }
/** Keys are stored (`dailyReward.item`, profile checks): never rename them. */
export const DAILY_ITEMS: Readonly<Record<number, DailyItem>> = {
  5: { kind: 'tag', key: 'moon-young', label: 'Молодой месяц', note: 'Тег рядом с именем: месяц покачивается, рядом подмигивает звезда' },
  10: { kind: 'theme', key: 'moonlight', label: 'Лунный свет', note: 'Серебристый фон профиля с чернильно-синими акцентами' },
  15: { kind: 'frame', key: 'crescent', label: 'Полумесяц', note: 'Месяц обнимает аватарку, рядом мерцают звёзды' },
  20: { kind: 'tag', key: 'moon-full', label: 'Полнолуние', note: 'Тег с полной луной и мягким ореолом вокруг неё' },
  25: { kind: 'theme', key: 'midnight', label: 'Полночь', note: 'Ночное небо и серебристо-голубые акценты на всём профиле' },
  30: { kind: 'frame', key: 'moon-cycle', label: 'Лунный цикл', note: 'Восемь фаз луны идут по кругу, полная сияет сверху' },
};
export const DAILY_ITEM_KEYS = Object.values(DAILY_ITEMS).map(item => item.key);
/** Sparks instead of a thing the member already has. */
export const OWNED_ITEM_SPARKS = 20;
/** XP and sparks of an ordinary day, by the path's sixth (days 1–5, 6–10, …): from +25 XP, the further, the more. */
const DAY_XP = [25, 30, 40, 50, 60, 75];
const DAY_SPARKS = [2, 3, 4, 5, 6, 7];
/** A thing's day pays XP too, more than any ordinary day. */
export const ITEM_DAY_XP = 100;

export interface DailyReward { step: number; xp: number; sparks: number; item: DailyItem | null }

/** What day `step` (1–30) gives; `owns` says whether the member already has a thing, so it turns into sparks. */
export function dailyReward(step: number, owns: (key: string) => boolean = () => false): DailyReward {
  const sixth = Math.min(DAY_XP.length - 1, Math.floor((step - 1) / 5));
  const item = DAILY_ITEMS[step] ?? null;
  if (item) return owns(item.key) ? { step, xp: ITEM_DAY_XP, sparks: OWNED_ITEM_SPARKS, item: null } : { step, xp: ITEM_DAY_XP, sparks: 0, item };
  return { step, xp: DAY_XP[sixth]!, sparks: DAY_SPARKS[sixth]!, item: null };
}

/** The day before a Moscow date `YYYY-MM-DD`. */
function previousDay(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export interface DailyClaim { day: string; step: number }
export interface DailyTrack {
  /** Today's day of the path: the one to take, or the one taken today. */
  step: number;
  claimed: boolean;
  /** Days of this path already taken before today. */
  behind: number;
  /** A path was going and a day was missed: it starts over (said plainly, without scaring). */
  restarted: boolean;
}

/** Where the member is today, from their last taken day (Moscow days). */
export function dailyTrack(last: DailyClaim | null, today: string): DailyTrack {
  if (last?.day === today) return { step: last.step, claimed: true, behind: last.step - 1, restarted: false };
  if (last && last.day === previousDay(today) && last.step < DAILY_DAYS) return { step: last.step + 1, claimed: false, behind: last.step, restarted: false };
  return { step: 1, claimed: false, behind: 0, restarted: Boolean(last && last.step < DAILY_DAYS && last.day !== previousDay(today)) };
}

/** How much of the moon is lit on a day of the path: new at the start, full on day 15, new again by day 30. */
export function moonLight(step: number): { lit: number; waxing: boolean } {
  const half = DAILY_DAYS / 2;
  return step <= half ? { lit: step / half, waxing: true } : { lit: (DAILY_DAYS - step) / half, waxing: false };
}
