/**
 * Which market CanRush runs — the one switch; everything else asks `market-open.ts`.
 *
 * - `closed` — no market anywhere: no links, `/market` and `/messages` lead to search, a listing or a chat is a 404,
 *   and the actions refuse new listings, orders and messages.
 * - `business` (since November 2026, while CanRush applies to payment systems: a market where private people sell cans
 *   to each other is a red flag for them) — only approved companies sell, on their own behalf, from the business
 *   cabinet. Every member sees and orders their listings; personal listings are hidden, cannot be ordered or
 *   published, and their chats are read-only.
 * - `open` — the member market as it was: anyone publishes, personally or on behalf of their company.
 *
 * The data stays in every mode: switching back brings the listings back as they were. Kept apart from the helpers so
 * tests can switch it (`vi.mock('…/market-mode')`).
 */
export type MarketMode = 'closed' | 'business' | 'open';
export const MARKET_MODE: MarketMode = 'business';
