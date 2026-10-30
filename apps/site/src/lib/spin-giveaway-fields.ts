/** Rules of a spin giveaway, shared by the admin form and the server. */
export const GIVEAWAY_TITLE_LIMIT = 60;
export const GIVEAWAY_BODY_LIMIT = 140;
export const GIVEAWAY_MAX_SPINS = 10;
export const GIVEAWAY_MIN_VIEW = 3;
export const GIVEAWAY_MAX_VIEW = 30;
export const GIVEAWAY_DEFAULT_VIEW = 5;
export const GIVEAWAY_MAX_CLAIMS = 1_000_000;
/** The banner stands this far down the first page of the feed, so it takes a scroll to reach. */
export const GIVEAWAY_FEED_POSITION = 2;

export interface GiveawayInput { title: string; body: string; spins: number; viewSeconds: number; maxClaims: number | null; startsAt: Date; endsAt: Date }

const line = (value: unknown) => (typeof value === 'string' ? value : '').replace(/\s+/g, ' ').trim();

function whole(value: unknown, min: number, max: number, message: string): number {
  const number = Number(line(value));
  if (!Number.isSafeInteger(number) || number < min || number > max) throw new Error(message);
  return number;
}

/** A `datetime-local` value, read as Moscow time (UTC+3 all year), whatever the admin's or the server's zone is. */
export function parseMoscowDate(value: unknown, label: string): Date {
  const raw = line(value);
  const date = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw) ? new Date(`${raw}:00+03:00`) : null;
  if (!date || Number.isNaN(date.getTime())) throw new Error(`Укажите ${label}.`);
  return date;
}

/** The same format back: the form's default dates. */
export const moscowInputValue = (time: number) => new Date(time + 3 * 3_600_000).toISOString().slice(0, 16);

export function parseGiveaway(input: Record<string, unknown>): GiveawayInput {
  const title = line(input.title);
  const body = line(input.body);
  if (!title) throw new Error('Напишите заголовок.');
  if (title.length > GIVEAWAY_TITLE_LIMIT) throw new Error(`Заголовок — до ${GIVEAWAY_TITLE_LIMIT} символов.`);
  if (!body) throw new Error('Напишите текст.');
  if (body.length > GIVEAWAY_BODY_LIMIT) throw new Error(`Текст — до ${GIVEAWAY_BODY_LIMIT} символов.`);
  const spins = whole(input.spins, 1, GIVEAWAY_MAX_SPINS, `Круток — от 1 до ${GIVEAWAY_MAX_SPINS}.`);
  const viewSeconds = whole(input.viewSeconds, GIVEAWAY_MIN_VIEW, GIVEAWAY_MAX_VIEW, `Просмотр — от ${GIVEAWAY_MIN_VIEW} до ${GIVEAWAY_MAX_VIEW} секунд.`);
  const maxClaims = line(input.maxClaims) ? whole(input.maxClaims, 1, GIVEAWAY_MAX_CLAIMS, 'Лимит — целое число участников.') : null;
  const startsAt = parseMoscowDate(input.startsAt, 'начало');
  const endsAt = parseMoscowDate(input.endsAt, 'конец');
  if (endsAt <= startsAt) throw new Error('Конец раздачи должен быть позже начала.');
  return { title, body, spins, viewSeconds, maxClaims, startsAt, endsAt };
}

export type GiveawayStatus = 'planned' | 'live' | 'exhausted' | 'stopped' | 'finished';
export const GIVEAWAY_STATUS_LABELS: Record<GiveawayStatus, string> = { planned: 'Запланирована', live: 'Идёт', exhausted: 'Разобрали', stopped: 'Остановлена', finished: 'Закончилась' };

export function giveawayStatus(row: { startsAt: Date; endsAt: Date; endedAt: Date | null; maxClaims: number | null; claimed: number }, now = Date.now()): GiveawayStatus {
  if (row.endedAt) return 'stopped';
  if (row.endsAt.getTime() <= now) return 'finished';
  if (row.maxClaims !== null && row.claimed >= row.maxClaims) return 'exhausted';
  return row.startsAt.getTime() > now ? 'planned' : 'live';
}

export const spinsWord = (count: number) => {
  const a = count % 10, b = count % 100;
  return a === 1 && b !== 11 ? 'крутка' : a >= 2 && a <= 4 && (b < 12 || b > 14) ? 'крутки' : 'круток';
};
