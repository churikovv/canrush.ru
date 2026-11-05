import { RARITIES, type Rarity } from '@/lib/gacha-fields';

/**
 * Обмен карточками Банкомата: правила без базы данных — их берут и сервер (`card-trades.ts`), и экран обмена.
 *
 * Обмен только равный: ценность карточки — её редкость в тех же долях, что цена сборки из осколков (`CRAFT_COST`
 * 20/60/200/600 → 1/3/10/30), и стороны расходятся не больше чем на `TRADE_TOLERANCE_PERCENT` от большей. Так с фейка
 * нельзя перелить коллекцию в один конец: за каждую карточку уходит столько же. Остальное — тормоза для цепочек фейков:
 * аккаунт старше `TRADE_MIN_DAYS` дней, обмен с одним человеком раз в сутки, `TRADES_PER_DAY` обменов в день и пауза
 * `TRADE_LOCK_DAYS` у полученной карточки. Карточки меняются только на карточки — не на крышки, осколки, искры, ценники
 * или деньги, и подарков в одну сторону нет: у карточек не должно появиться цены вне сайта.
 */
export const TRADE_VALUE: Record<Rarity, number> = { common: 1, rare: 3, epic: 10, legendary: 30 };
/** На сколько процентов от большей стороны может отличаться меньшая. */
export const TRADE_TOLERANCE_PERCENT = 20;
/** Карточек с каждой стороны. */
export const TRADE_MAX_CARDS = 5;
/** Сколько живёт предложение без ответа. */
export const TRADE_OFFER_HOURS = 72;
/** Возраст аккаунта у обоих участников. */
export const TRADE_MIN_DAYS = 3;
/** Состоявшихся обменов у участника за московские сутки. */
export const TRADES_PER_DAY = 3;
/** Открытых исходящих предложений и новых предложений за сутки. */
export const OPEN_OFFERS = 5;
export const OFFERS_PER_DAY = 10;
/** Полученная в обмене карточка не уходит дальше столько дней. */
export const TRADE_LOCK_DAYS = 7;

export interface TradeCardRef { brand: string; flavor: string }
export type TradeSide = 'give' | 'take';

export const tradeValue = (rarities: readonly Rarity[]) => rarities.reduce((sum, rarity) => sum + TRADE_VALUE[rarity], 0);

export interface TradeBalance {
  give: number; take: number;
  /** Обе стороны есть, карточек не больше `TRADE_MAX_CARDS`, и ценность почти равна. */
  fair: boolean;
  /** Сторона, которая дороже сверх допуска, и сколько не хватает другой. */
  heavier: TradeSide | null; short: number;
}

/** Хватает ли равенства: разница — не больше допуска от большей стороны (в целых числах, без округлений). */
const within = (a: number, b: number) => Math.abs(a - b) * 100 <= Math.max(a, b) * TRADE_TOLERANCE_PERCENT;

/** Баланс предложения: `give` — что отдаёт предлагающий, `take` — что он просит. */
export function tradeBalance(give: readonly Rarity[], take: readonly Rarity[]): TradeBalance {
  const a = tradeValue(give);
  const b = tradeValue(take);
  const sized = give.length > 0 && take.length > 0 && give.length <= TRADE_MAX_CARDS && take.length <= TRADE_MAX_CARDS;
  if (!a || !b || within(a, b)) return { give: a, take: b, fair: sized && within(a, b), heavier: null, short: 0 };
  const heavier: TradeSide = a > b ? 'give' : 'take';
  const big = Math.max(a, b);
  // The lighter side needs at least big × (100 − tolerance) / 100, rounded up.
  const short = Math.ceil(big * (100 - TRADE_TOLERANCE_PERCENT) / 100) - Math.min(a, b);
  return { give: a, take: b, fair: false, heavier, short };
}

/** Подсказка под весами — глазами того, кто собирает предложение. */
export function balanceHint(balance: TradeBalance, giveCount: number, takeCount: number): string {
  if (!takeCount && !giveCount) return 'Выберите, что хотите получить, и что отдадите взамен.';
  if (!takeCount) return 'Выберите, что хотите получить.';
  if (!giveCount) return 'Выберите, что отдадите взамен.';
  if (giveCount > TRADE_MAX_CARDS || takeCount > TRADE_MAX_CARDS) return `Не больше ${TRADE_MAX_CARDS} карточек с каждой стороны.`;
  if (balance.fair) return balance.give === balance.take ? 'Обмен равный — можно отправлять.' : 'Почти равный обмен — можно отправлять.';
  return balance.heavier === 'take'
    ? `Вы просите больше: добавьте своих карточек ещё на ${balance.short} или попросите меньше.`
    : `Вы отдаёте больше: попросите ещё на ${balance.short} или уберите карточку.`;
}

/** Карточки из запроса: от одной до `TRADE_MAX_CARDS`, без повторов. Всё остальное — `null`. */
export function parseTradeCards(value: unknown): TradeCardRef[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > TRADE_MAX_CARDS) return null;
  const cards: TradeCardRef[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== 'object') return null;
    const { brand, flavor } = item as Record<string, unknown>;
    if (typeof brand !== 'string' || typeof flavor !== 'string' || !brand || !flavor || brand.length > 120 || flavor.length > 120) return null;
    const key = JSON.stringify([brand, flavor]);
    if (seen.has(key)) return null;
    seen.add(key);
    cards.push({ brand, flavor });
  }
  return cards;
}

export const isRarity = (value: unknown): value is Rarity => RARITIES.includes(value as Rarity);
