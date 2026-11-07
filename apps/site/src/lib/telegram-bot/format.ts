import { TELEGRAM_CHANNEL_URL } from '@/components/telegram-promo';
import { catalogGroupSlug, flavorName } from '@/lib/catalog-query';
import type { InlineButton, InlineKeyboard } from './api';
import type { BotProduct, BotPromo } from './catalog';

export function escapeHtml(value: string): string {
  return value.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;');
}

export function rub(value: number): string {
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value)} ₽`;
}

export function productName(brand: string, flavor: string): string {
  return `${brand} · ${flavorName(flavor)}`;
}

export function productUrl(siteUrl: string, brand: string, flavor: string): string {
  return `${siteUrl}/catalog/${catalogGroupSlug(brand, flavor)}`;
}

/** Private chats open site pages inside the Mini App; plain links are the fallback for http dev hosts. */
export function openButton(text: string, url: string): InlineButton {
  return url.startsWith('https://') ? { text, web_app: { url } } : { text, url };
}

export function truncate(value: string, length: number): string {
  const clean = value.replace(/\s+/gu, ' ').trim();
  return clean.length > length ? `${clean.slice(0, length - 1)}…` : clean;
}

/** The name /start greets: the @username when there is one, otherwise the first name. */
export function greetingName(user: { username?: string; first_name?: string }): string | undefined {
  if (user.username) return `@${user.username}`;
  return user.first_name ? truncate(user.first_name, 40) || undefined : undefined;
}

/** The /start caption under the video; the copy is the owner's. */
export function welcomeText(name: string | undefined, botUsername: string): string {
  return [
    name ? `👋🏻 Привет, <b>${escapeHtml(name)}</b>!` : '👋🏻 Привет!',
    '',
    `Мы создали самого удобного бота для любителей энергетиков. Вы можете отправить карточку с энергетиком для друга с <code>@${escapeHtml(botUsername)} burn</code>`,
    '',
    'Вы можете воспользоваться приложением или пользоваться через бота с помощью меню ниже 👇🏻',
  ].join('\n');
}

/** The /start menu. `m:` buttons answer with a new message, so the menu itself never changes. */
export function startKeyboard(siteUrl: string): InlineKeyboard {
  return [
    [openButton('⚡ Запустить приложение', siteUrl)],
    [{ text: '🔎 Найти энергетик', callback_data: 'm:search' }, { text: '📤 Отправить другу', switch_inline_query: 'burn' }],
    [{ text: '🔥 Акции недели', callback_data: 'm:deals' }, { text: '📍 Город', callback_data: 'm:city' }],
    [{ text: '⚙️ Настройки', callback_data: 'm:settings' }, openButton('💬 Поддержка', `${siteUrl}/support`)],
    [{ text: '📢 Канал CanRush', url: TELEGRAM_CHANNEL_URL }],
  ];
}

export function searchHintText(cityName: string): string {
  return `Напишите название или вкус — например, <b>Burn манго</b>. Покажу, где энергетик дешевле, и его рейтинг · ${escapeHtml(cityName)}`;
}

export function noDealsText(cityName: string): string {
  return `Акций на энергетики сейчас нет · ${escapeHtml(cityName)}. Загляните позже: цены обновляются каждый день.`;
}

function promoDate(iso: string): string {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Moscow' }).format(new Date(iso));
}

export function productSummary(product: BotProduct): string {
  const parts: string[] = [];
  if (product.cheapest) {
    const volume = product.cheapest.volumeMl ? `, ${product.cheapest.volumeMl} мл` : '';
    parts.push(`от ${rub(product.cheapest.price)} в «${product.cheapest.retailer}»${volume}`);
  } else {
    parts.push('нет в продаже в вашем городе');
  }
  if (product.rating) parts.push(`★ ${product.rating.overall.toFixed(1)} (${product.rating.count})`);
  return parts.join(' · ');
}

export function productCard(product: BotProduct): string {
  return `<b>${escapeHtml(productName(product.brand, product.flavor))}</b>\n${escapeHtml(productSummary(product))}`;
}

export function promoLine(promo: BotPromo): string {
  const volume = promo.volumeMl ? `, ${promo.volumeMl} мл` : '';
  const old = promo.oldPrice ? ` <s>${escapeHtml(rub(promo.oldPrice))}</s>` : '';
  return `• <b>${escapeHtml(productName(promo.brand, promo.flavor))}</b>${escapeHtml(volume)}\n`
    + `  ${escapeHtml(rub(promo.price))}${old} в «${escapeHtml(promo.retailer)}», до ${escapeHtml(promoDate(promo.promoEndsAt))}`;
}

export function promoAlertText(promos: BotPromo[], cityName: string): string {
  const title = promos.length === 1 ? 'Энергетик из избранного по акции' : 'Энергетики из избранного по акции';
  return `🔥 <b>${title}</b> · ${escapeHtml(cityName)}\n\n${promos.map(promoLine).join('\n')}`;
}

export function digestText(promos: BotPromo[], cityName: string): string {
  return `⚡ <b>Лучшие акции недели</b> · ${escapeHtml(cityName)}\n\n${promos.map(promoLine).join('\n')}`;
}

export interface AdminSummary {
  newUsers: number;
  totalUsers: number;
  reviews: number;
  comments: number;
  wallPosts: number;
  tierLists: number;
  marketOrders: number;
  peakOnline: number;
}

export function adminSummaryText(summary: AdminSummary, day: string): string {
  return [
    `📊 <b>CanRush за сутки</b> · ${escapeHtml(day)}`,
    '',
    `Новые пользователи: <b>${summary.newUsers}</b> (всего ${summary.totalUsers})`,
    `Пик онлайн: <b>${summary.peakOnline}</b>`,
    `Отзывы: <b>${summary.reviews}</b>`,
    `Комментарии: <b>${summary.comments}</b>`,
    `Записи на стенах: <b>${summary.wallPosts}</b>`,
    `Новые тирлисты: <b>${summary.tierLists}</b>`,
    `Заказы в маркете: <b>${summary.marketOrders}</b>`,
  ].join('\n');
}

export interface ErrorAlert { source: 'server' | 'client'; path: string; message: string; count: number }

/** In `code`: a report from a browser is anyone's text, and Telegram makes no links there. */
export function errorAlertText(alert: ErrorAlert): string {
  return [
    alert.count > 1 ? `🚨 <b>Ошибка повторяется</b> · ${alert.count} раз` : '🚨 <b>Новая ошибка на сайте</b>',
    `${alert.source === 'client' ? 'Браузер' : 'Сервер'} · <code>${escapeHtml(truncate(alert.path, 120))}</code>`,
    '',
    `<code>${escapeHtml(truncate(alert.message, 300))}</code>`,
  ].join('\n');
}

export type MarketEvent = 'new' | 'confirmed' | 'completed' | 'cancelled' | 'message';

export function marketText(event: MarketEvent, title: string, counterpart: string, message?: string): string {
  const head: Record<MarketEvent, string> = {
    new: `🛒 <b>Новый заказ</b> от ${escapeHtml(counterpart)}`,
    confirmed: `✅ <b>Заказ подтверждён продавцом</b>`,
    completed: `🎉 <b>Банки получены — заказ завершён</b>`,
    cancelled: `❌ <b>Заказ отменён</b>`,
    message: `💬 <b>Новое сообщение</b> от ${escapeHtml(counterpart)}`,
  };
  const body = message ? `\n\n${escapeHtml(truncate(message, 300))}` : '';
  return `${head[event]}\n«${escapeHtml(truncate(title, 120))}»${body}`;
}

/** The team writing to a member personally: their answer in the chat reaches the admin panel. */
export function directText(text: string): string {
  return `✉️ <b>Сообщение от команды CanRush</b>\n\n${escapeHtml(text)}\n\n<i>Ответьте прямо здесь, мы увидим.</i>`;
}

export function directReplyText(name: string, text: string): string {
  return `✉️ <b>Ответ от ${escapeHtml(name)}</b>\n${escapeHtml(truncate(text, 400))}`;
}

export function notificationText(title: string, detail: string): string {
  return `🔔 <b>${escapeHtml(title)}</b>${detail ? `\n${escapeHtml(truncate(detail, 400))}` : ''}`;
}
