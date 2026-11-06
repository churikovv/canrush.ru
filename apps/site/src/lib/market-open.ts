import { MARKET_MODE } from './market-mode';

export type { MarketMode } from './market-mode';

/** Who sells: `company` — an approved company, from the business cabinet; `member` — a personal listing. */
export type MarketSeller = 'member' | 'company';

/**
 * The market is on in some form (`MARKET_MODE` is not `closed`): its links in the header, footer, search, home and
 * profiles, `/market`, `/messages`, the cabinet's «Объявления» and «Заказы и чаты», orders and chats.
 * `/market/stores` is the store map, not the market: it is open in every mode.
 */
export function marketOpen() {
  return MARKET_MODE !== 'closed';
}

/** Whether this kind of seller may publish, be shown and be ordered from in the current mode. */
export function marketOpenFor(seller: MarketSeller) {
  return MARKET_MODE === 'open' || (MARKET_MODE === 'business' && seller === 'company');
}

/** Where «Создать объявление» leads: the member form, or the cabinet while only companies sell. */
export function newListingHref() {
  return marketOpenFor('member') ? '/market/new' : '/business/cabinet?section=new-listing';
}

export const MARKET_CLOSED_MESSAGE = 'Маркет временно закрыт.';
/** A personal listing while only companies sell. */
export const MARKET_BUSINESS_ONLY_MESSAGE = 'Сейчас объявления публикуют только подтверждённые компании — из кабинета «CanRush для бизнеса».';
/** A chat of a personal listing while only companies sell: the order can still be completed or cancelled. */
export const MARKET_PERSONAL_CHAT_MESSAGE = 'Переписка по личным объявлениям сейчас закрыта: в маркете продают только компании. Заказ можно завершить или отменить.';
