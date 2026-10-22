const MONTHS_GENITIVE = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const ZONE = 'Europe/Moscow';

function parts(date: Date) {
  const values = Object.fromEntries(new Intl.DateTimeFormat('ru-RU', { timeZone: ZONE, year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(date).map(part => [part.type, part.value]));
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day), time: `${values.hour}:${values.minute}` };
}

function plural(count: number, one: string, few: string, many: string) {
  const tens = count % 100, ones = count % 10;
  if (tens >= 11 && tens <= 14) return many;
  return ones === 1 ? one : ones >= 2 && ones <= 4 ? few : many;
}

/** «сентября 2026 г.» — genitive month for «С нами с …» (Intl gives the nominative for month + year). */
export function joinedLabel(value: Date | string): string {
  const { year, month } = parts(new Date(value));
  return `${MONTHS_GENITIVE[month - 1]} ${year} г.`;
}

/** Last visit relative to `now`, Moscow time, gender-neutral: «только что», «15 минут назад», «вчера в 14:20», «3 октября». */
export function lastSeenLabel(value: Date | string, now: Date = new Date()): string {
  const seen = new Date(value);
  const minutes = Math.max(0, Math.floor((now.getTime() - seen.getTime()) / 60_000));
  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} ${plural(minutes, 'минуту', 'минуты', 'минут')} назад`;
  const a = parts(seen), b = parts(now);
  const dayKey = (p: { year: number; month: number; day: number }) => Date.UTC(p.year, p.month - 1, p.day);
  const days = Math.round((dayKey(b) - dayKey(a)) / 86_400_000);
  if (days === 0) return `сегодня в ${a.time}`;
  if (days === 1) return `вчера в ${a.time}`;
  return `${a.day} ${MONTHS_GENITIVE[a.month - 1]}${a.year === b.year ? '' : ` ${a.year} г.`}`;
}

/** When a record was posted, relative to `now`: «только что», «5 минут назад», «2 часа назад», «вчера в 14:20», «3 октября». */
export function postedLabel(value: Date | string, now: Date = new Date()): string {
  const posted = new Date(value);
  const minutes = Math.max(0, Math.floor((now.getTime() - posted.getTime()) / 60_000));
  if (minutes < 60) return lastSeenLabel(posted, now);
  const hours = Math.floor(minutes / 60);
  if (hours < 12) return `${hours} ${plural(hours, 'час', 'часа', 'часов')} назад`;
  return lastSeenLabel(posted, now);
}
