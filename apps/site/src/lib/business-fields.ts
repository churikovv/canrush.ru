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

/** 12 monthly buckets ending with the month of `today` (keys `YYYY-MM-01`), oldest first; empty months are zero. */
export function monthlySeries(rows: { week: string; count: number }[], today: string, months = 12): { week: string; count: number }[] {
  const counts = new Map(rows.map(row => [row.week, row.count]));
  const [year, month] = today.split('-').map(Number) as [number, number];
  return Array.from({ length: months }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 - (months - 1 - index), 1));
    const key = date.toISOString().slice(0, 10);
    return { week: key, count: counts.get(key) ?? 0 };
  });
}

/** The analytics window the page asked for, within the plan: 30, 90 or 365 days. */
export function historyWindow(asked: unknown, max: number): number {
  const days = Number(asked);
  return [30, 90, 365].includes(days) && days <= max ? days : 30;
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

/** A company reply to a review: up to this many characters. */
export const MAX_BUSINESS_REPLY = 1000;

/** The reply text as stored: spaces collapsed within lines, at most two line breaks in a row, trimmed; checks the length. */
export function parseBusinessReply(value: unknown): string {
  const text = typeof value === 'string' ? value.replace(/\r\n?/g, '\n').split('\n').map(line => line.replace(/[^\S\n]+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim() : '';
  if (!text) throw new BusinessError('Напишите ответ.');
  if (text.length > MAX_BUSINESS_REPLY) throw new BusinessError(`Ответ — до ${MAX_BUSINESS_REPLY} символов.`);
  return text;
}

/** Saved replies a company keeps (`businessReplyTemplate`). */
export const MAX_REPLY_TEMPLATES = 30;
export const MAX_REPLY_TEMPLATE_TITLE = 40;
/** Placeholders a template may hold; picking it fills them for the review being answered. */
export const REPLY_TEMPLATE_FIELDS = [{ key: '{автор}', label: 'имя автора' }, { key: '{напиток}', label: 'напиток' }] as const;

/** A template as stored: the title (one line, up to 40) and the text by the reply's own rules. */
export function parseReplyTemplate(title: unknown, text: unknown): { title: string; text: string } {
  const name = typeof title === 'string' ? title.replace(/\s+/g, ' ').trim() : '';
  if (!name) throw new BusinessError('Назовите шаблон.');
  if (name.length > MAX_REPLY_TEMPLATE_TITLE) throw new BusinessError(`Название шаблона — до ${MAX_REPLY_TEMPLATE_TITLE} символов.`);
  return { title: name, text: parseBusinessReply(text) };
}

/** A title suggested for a new template: the first words of its text, cut on a word. */
export function replyTemplateTitle(text: string): string {
  const line = text.replace(/\s+/g, ' ').trim();
  if (line.length <= 28) return line;
  const cut = line.slice(0, 28);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 12 ? cut.lastIndexOf(' ') : 28).trim()}…`;
}

/** The template's text for one review: `{автор}` and `{напиток}` filled in (any case). */
export function fillReplyTemplate(text: string, values: { author: string; drink: string }): string {
  return text.replace(/\{автор\}/giu, values.author).replace(/\{напиток\}/giu, values.drink);
}

/** Who is who in a company's team: the owner manages everything, a manager works, an analyst only looks. */
export type BusinessMemberRole = 'manager' | 'analyst';
export const BUSINESS_ROLES: { value: BusinessMemberRole; label: string; hint: string }[] = [
  { value: 'manager', label: 'Менеджер', hint: 'Отвечает на отзывы, добавляет напитки и объявления от компании' },
  { value: 'analyst', label: 'Аналитик', hint: 'Только смотрит аналитику, сравнивает и выгружает отчёты' },
];
export const isBusinessMemberRole = (value: unknown): value is BusinessMemberRole => value === 'manager' || value === 'analyst';

/** Lines of the team's action log (`businessAuditLog`). */
export const BUSINESS_AUDIT_LABELS: Record<string, string> = {
  'reply': 'Ответил на отзыв', 'reply-edit': 'Изменил ответ на отзыв', 'reply-delete': 'Удалил ответ на отзыв',
  'template': 'Сохранил шаблон ответа', 'template-delete': 'Удалил шаблон ответа',
  'drink-request': 'Отправил напиток на прикрепление', 'drink-remove': 'Открепил напиток',
  'drink-new': 'Опубликовал новый напиток', 'drink-edit': 'Предложил правку карточки',
  'drink-store': 'Добавил магазин, где купить напиток', 'drink-store-remove': 'Убрал магазин, где купить напиток',
  'drink-price': 'Задал рекомендованную цену', 'drink-price-remove': 'Убрал рекомендованную цену',
  'listing': 'Опубликовал объявление от компании',
  'invite': 'Пригласил в команду', 'member-remove': 'Убрал из команды', 'member-role': 'Сменил роль',
  'logo': 'Обновил логотип', 'logo-remove': 'Удалил логотип',
  'post': 'Опубликовал запись на стене компании', 'post-delete': 'Удалил запись со стены компании', 'profile': 'Настроил профиль компании', 'banner': 'Обновил баннер профиля', 'profile-info': 'Изменил описание и контакты профиля', 'banner-remove': 'Удалил баннер профиля', 'presentation-pin': 'Закрепил главную презентацию', 'presentation-unpin': 'Открепил главную презентацию',
  'competitor': 'Добавил конкурента', 'competitor-remove': 'Убрал конкурента',
  'export': 'Выгрузил CSV',
  'plan-request': 'Запросил счёт на тариф', 'promo-request': 'Оставил заявку на продвижение',
};
