import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Письмо «Что нового на CanRush» тем, кто давно не заходил (`comeback-email.ts`): правила без базы. Заходом считается
 * пульс сайта (`user.lastSeenAt`, у того, кто ни разу не открыл сайт после входа, — дата регистрации).
 */
/** Сколько дней без захода, прежде чем придёт первое письмо. */
export const COMEBACK_AWAY_DAYS = 14;
/** Не чаще одного письма за столько дней. */
export const COMEBACK_GAP_DAYS = 14;
/** Писем подряд без захода: кто не вернулся после трёх, больше их не получает, пока снова не зайдёт. */
export const COMEBACK_MAX_LETTERS = 3;
/** Писем за московские сутки на весь сайт: почтовый сервер не любит пачки. */
export const COMEBACK_DAILY_LIMIT = 200;
/** Рассылка начинается с этого часа по Москве: письмо приходит днём, а не ночью. */
export const COMEBACK_START_HOUR = 12;
/** Новое на сайте считаем не дальше, чем за столько дней: после долгой паузы «всё новое» — слишком много. */
export const COMEBACK_NEWS_DAYS = 30;
/** Вид в `notificationPreference`: переключатель в настройках и ссылка «Отписаться» выключают его. */
export const COMEBACK_PREFERENCE = 'comeback-email';

/** Подпись ссылки отписки: письмо открывает отписку без входа, поэтому ссылку нельзя подобрать для чужого id. */
export function unsubscribeToken(userId: string, secret: string): string {
  return createHmac('sha256', secret).update(`comeback-email:${userId}`).digest('base64url');
}

export function isUnsubscribeToken(userId: string, token: unknown, secret: string): boolean {
  if (typeof token !== 'string' || !userId || token.length > 64) return false;
  const expected = Buffer.from(unsubscribeToken(userId, secret));
  const given = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Банка в письме: название, обложка (абсолютный адрес или нет) и ссылка на страницу напитка. */
export interface ComebackDrink { brand: string; name: string; href: string; cover: string | null; note?: string }
/** Событие сайта сейчас: премия, охота за ценниками. */
export interface ComebackEvent { key: string; title: string; text: string; button: string; href: string; image: string | null }
export interface ComebackArticle { title: string; summary: string; href: string; minutes: number }

/** Что войдёт в письмо одного участника. Пустые разделы письмо пропускает. */
export interface ComebackDigest {
  /** Ник для приветствия; без ника — просто «Привет!». */
  username: string | null;
  events: ComebackEvent[];
  unread: number;
  newDrinks: { total: number; items: ComebackDrink[] };
  popular: ComebackDrink[];
  articles: ComebackArticle[];
}

/** Письмо уходит, только если в нём есть что-то кроме популярного: иначе оно одинаковое у всех и каждые две недели. */
export function hasNews(digest: ComebackDigest): boolean {
  return digest.events.length > 0 || digest.unread > 0 || digest.newDrinks.total > 0 || digest.articles.length > 0;
}

export function plural(count: number, one: string, few: string, many: string): string {
  const tens = count % 100, units = count % 10;
  return units === 1 && tens !== 11 ? one : units >= 2 && units <= 4 && (tens < 12 || tens > 14) ? few : many;
}

/** Тема письма — по самому заметному разделу. */
export function comebackSubject(digest: ComebackDigest): string {
  const event = digest.events[0];
  if (event) return `${event.title}: ${event.key === 'award' ? 'выберите энергетики года' : 'идёт сейчас'} — CanRush`;
  if (digest.unread) return `${digest.unread} ${plural(digest.unread, 'новое уведомление', 'новых уведомления', 'новых уведомлений')} на CanRush`;
  if (digest.newDrinks.total) return `${digest.newDrinks.total} ${plural(digest.newDrinks.total, 'новый энергетик', 'новых энергетика', 'новых энергетиков')} в каталоге CanRush`;
  return 'Что нового на CanRush';
}

/** Строка-превью под темой в списке писем. */
export function comebackPreheader(digest: ComebackDigest): string {
  const parts = [
    digest.events.length ? digest.events.map(event => event.title).join(', ') : '',
    digest.unread ? `${digest.unread} ${plural(digest.unread, 'уведомление', 'уведомления', 'уведомлений')}` : '',
    digest.newDrinks.total ? `${digest.newDrinks.total} ${plural(digest.newDrinks.total, 'новый напиток', 'новых напитка', 'новых напитков')}` : '',
    digest.articles.length ? 'новые статьи' : '',
    digest.popular.length ? 'что обсуждают на неделе' : '',
  ].filter(Boolean);
  return parts.join(' · ');
}
