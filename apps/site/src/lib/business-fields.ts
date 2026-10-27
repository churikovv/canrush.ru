/** Rules of the business cabinet shared by the browser and the server: company fields, statuses and chart helpers. */

export type BusinessKind = 'brand' | 'distributor' | 'shop';
export type BusinessStatus = 'pending' | 'approved' | 'rejected';
export const BUSINESS_KINDS: { value: BusinessKind; label: string; hint: string }[] = [
  { value: 'brand', label: 'Бренд', hint: 'Производитель или владелец марки' },
  { value: 'distributor', label: 'Дистрибьютор', hint: 'Поставки в сети и магазины' },
  { value: 'shop', label: 'Магазин', hint: 'Офлайн или онлайн-продажи' },
];
export const BUSINESS_STATUS_LABELS: Record<BusinessStatus, string> = { pending: 'На проверке', approved: 'Подтверждено', rejected: 'Отклонено' };
export const MAX_PENDING_BUSINESS_DRINKS = 50;

export class BusinessError extends Error {}

export interface BusinessInput { name: string; kind: BusinessKind; website: string | null; telegram: string | null; contactEmail: string | null; about: string | null }

const text = (form: FormData, name: string) => { const value = form.get(name); return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''; };

/** The company form: a name, a kind and optional contacts; a site without a scheme gets https, a Telegram link its name. */
export function parseBusinessInput(form: FormData): BusinessInput {
  const name = text(form, 'name');
  if (name.length < 2 || name.length > 80) throw new BusinessError('Название компании — от 2 до 80 символов.');
  const kind = text(form, 'kind') as BusinessKind;
  if (!BUSINESS_KINDS.some(item => item.value === kind)) throw new BusinessError('Выберите, кто вы: бренд, дистрибьютор или магазин.');
  let website: string | null = text(form, 'website') || null;
  if (website) {
    if (!/^https?:\/\//i.test(website)) website = `https://${website}`;
    try { const url = new URL(website); if (!/^https?:$/.test(url.protocol) || !url.hostname.includes('.')) throw new Error(); website = url.toString().replace(/\/$/, ''); }
    catch { throw new BusinessError('Сайт — адрес вида example.ru.'); }
    if (website.length > 200) throw new BusinessError('Адрес сайта слишком длинный.');
  }
  const telegramRaw = text(form, 'telegram').replace(/^https?:\/\//i, '').replace(/^(?:t\.me|telegram\.me)\//i, '').replace(/^@+/, '').replace(/\/$/, '');
  if (telegramRaw && !/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(telegramRaw)) throw new BusinessError('Telegram — ссылка t.me или имя от 5 до 32 символов.');
  const contactEmail = text(form, 'contactEmail') || null;
  if (contactEmail && (contactEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))) throw new BusinessError('Почта для связи указана неверно.');
  const about = (typeof form.get('about') === 'string' ? (form.get('about') as string).trim() : '') || null;
  if (about && about.length > 500) throw new BusinessError('О компании — не больше 500 символов.');
  return { name, kind, website, telegram: telegramRaw || null, contactEmail, about };
}

/** Monday (YYYY-MM-DD) of the week containing `day`. */
export function weekStart(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

/** `weeks` weekly buckets ending with the week of `today`, oldest first; weeks without rows are zero. */
export function weeklySeries(rows: { week: string; count: number }[], today: string, weeks = 12): { week: string; count: number }[] {
  const counts = new Map(rows.map(row => [row.week, row.count]));
  const last = new Date(`${weekStart(today)}T00:00:00Z`);
  return Array.from({ length: weeks }, (_, index) => {
    const date = new Date(last);
    date.setUTCDate(date.getUTCDate() - 7 * (weeks - 1 - index));
    const week = date.toISOString().slice(0, 10);
    return { week, count: counts.get(week) ?? 0 };
  });
}

/** Change against the previous period in percent, rounded; null when there was nothing before. */
export function percentChange(current: number, previous: number): number | null {
  return previous > 0 ? Math.round((current - previous) / previous * 100) : null;
}

/** One CSV cell for Excel: quoted when needed, and a leading = + - @ neutralised so a review cannot run as a formula. */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Sorts table rows by one of the given columns; unknown columns keep the order. Empty values go last either way. */
export function sortRows<T>(rows: T[], by: string | undefined, dir: 'asc' | 'desc', columns: Record<string, (row: T) => string | number | null>): T[] {
  const value = by ? columns[by] : undefined;
  if (!value) return rows;
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = value(a), y = value(b);
    if (x === null || x === '') return y === null || y === '' ? 0 : 1;
    if (y === null || y === '') return -1;
    return sign * (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'ru-RU'));
  });
}
