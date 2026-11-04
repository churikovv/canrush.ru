/**
 * The member market — listings, orders and their chats — is closed for now (November 2026) while CanRush applies to
 * payment systems: a market where members sell cans to each other is a different kind of business for them than paid
 * plans. Closed, every way in is gone (header, footer, search, home, profiles, company pages, the business cabinet and
 * landing, the plans), `/market` and `/messages` lead to search, a listing or a chat is a 404, and the actions refuse
 * new listings, orders and messages. The data stays: setting this back to `true` brings the market back as it was.
 * `/market/stores` is the store map, not the market, and stays open.
 */
export const MARKET_OPEN = false;

export const MARKET_CLOSED_MESSAGE = 'Маркет временно закрыт.';
