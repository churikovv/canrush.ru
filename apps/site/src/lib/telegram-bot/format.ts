import { catalogGroupSlug, flavorName } from '@/lib/catalog-query';
import type { InlineButton } from './api';
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

export type MarketEvent = 'new' | 'confirmed' | 'completed' | 'cancelled' | 'message';

export function marketText(event: MarketEvent, title: string, counterpart: string, message?: string): string {
  const head: Record<MarketEvent, string> = {
    new: `🛒 <b>Новый заказ</b> от ${escapeHtml(counterpart)}`,
    confirmed: `✅ <b>Продавец подтвердил заказ</b>`,
    completed: `🎉 <b>Покупатель завершил заказ</b>`,
    cancelled: `❌ <b>Заказ отменён</b>`,
    message: `💬 <b>Новое сообщение</b> от ${escapeHtml(counterpart)}`,
  };
  const body = message ? `\n\n${escapeHtml(truncate(message, 300))}` : '';
  return `${head[event]}\n«${escapeHtml(truncate(title, 120))}»${body}`;
}

export function notificationText(title: string, detail: string): string {
  return `🔔 <b>${escapeHtml(title)}</b>${detail ? `\n${escapeHtml(truncate(detail, 400))}` : ''}`;
}
