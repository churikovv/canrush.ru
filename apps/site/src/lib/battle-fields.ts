/**
 * «Битва банок»: правила и формулы без базы данных. Числа карты берутся из настоящих данных сайта, а не из редкости:
 * редкость говорит о наличии в магазинах, а не о качестве, и с бонусом разрыв между коллекциями только рос.
 */
import type { Rarity } from '@/lib/gacha-fields';

export const HERO_HEALTH = 16;
/** Второй игрок получает лишнюю карту, монетку и здоровье: без них первый ход выигрывал заметно чаще. */
export const SECOND_BONUS_HEALTH = 2;
export const MAX_MANA = 8;
export const BOARD_SIZE = 5;
export const HAND_SIZE = 7;
export const DECK_SIZE = 15;
export const FIRST_HAND = 3;
export const SECOND_HAND = 4;
export const HERO_POWER_COST = 2;
export const HERO_POWER_DAMAGE = 1;
export const MAX_COPIES = 2;

/** Колечки — материал из побед, их собирают в подарочные крутки Банкомата. Купить нельзя, ставок нет. */
export const WIN_RINGS = 2;
/** Сколько побед в день платит колечками: бота можно обыгрывать бесконечно. */
export const PAID_WINS_PER_DAY = 5;
export const SPIN_RING_COST = 6;

export const ringsLabel = (count: number) => `${count} ${count % 10 === 1 && count % 100 !== 11 ? 'колечко' : [2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100) ? 'колечка' : 'колечек'}`;

export const BATTLE_KEYWORDS = ['shield', 'match', 'taunt', 'loyal', 'rush'] as const;
export type BattleKeyword = (typeof BATTLE_KEYWORDS)[number];

/** Порядок важен: у карты одно свойство, берётся первое подходящее. Дейтинг выше обсуждаемости, иначе его почти не видно. */
export const KEYWORD_INFO: Record<BattleKeyword, { title: string; rule: string; source: string }> = {
  shield: { title: 'S-тир', rule: 'Первый удар не наносит урона', source: 'Средний тир S и выше в тирлистах участников' },
  match: { title: 'Мэтч', rule: 'Выходя, даёт самому сильному союзнику +1/+1', source: 'Нравится участникам в дейтинге' },
  taunt: { title: 'Обсуждаемая', rule: 'Соперник обязан бить её первой', source: 'Одна из самых обсуждаемых банок каталога' },
  loyal: { title: 'Верность', rule: 'Погибая, оставляет банку 1/1', source: 'В избранном у нескольких участников' },
  rush: { title: 'Лёгкая', rule: 'Сразу может бить банки, но не героя', source: 'Без сахара' },
};

export interface BattleCardDef {
  /** Карта из каталога: `brand|flavor`; стартовая — `start:<номер>` */ id: string;
  brand: string; flavor: string; title: string; name: string;
  /** Без обложки — фирменная плитка: так рисуются стартовые банки без бренда */ cover: string | null;
  rarity: Rarity | null; cost: number; attack: number; health: number; keyword: BattleKeyword | null;
}

/** Что сайт знает о напитке. Трекера и кофеина здесь нет намеренно: сайт 18+, сила не должна зависеть от выпитого. */
export interface DrinkFacts {
  price: number | null; reviews: number; taste: number; design: number;
  swipes: number; likes: number; favorites: number; tierLists: number; tierAverage: number; sugarfree: boolean;
}
export interface BattleStats { cost: number; attack: number; health: number; keyword: BattleKeyword | null }

/** Малое число оценок тянется к средней: один отзыв не делает банку легендой. */
const PRIOR_SCORE = 6.3;
const PRIOR_WEIGHT = 3;
const MIN_SWIPES = 5;
const MIN_LIKE_SHARE = 0.4;
const MIN_TIER_LISTS = 3;
/** Средний тир: SS = 6, S = 5, A = 4, B = 3, C = 2, D = 1. */
const MIN_TIER_AVERAGE = 4.5;
const MIN_FAVORITES = 3;
/** Доля обсуждаемых банок среди банок с отзывами. */
const TOP_DISCUSSED = 0.07;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const smoothed = (average: number, count: number) => (count * average + PRIOR_WEIGHT * PRIOR_SCORE) / (count + PRIOR_WEIGHT);
const shareBelow = (sorted: readonly number[], value: number) => (sorted.length ? sorted.filter(item => item <= value).length / sorted.length : 0.5);

/** Дешёвая банка — ранняя карта, дорогая — поздняя: доли подобраны под кривую маны. */
function costOfPrice(share: number) {
  return share < 0.1 ? 1 : share < 0.32 ? 2 : share < 0.58 ? 3 : share < 0.78 ? 4 : share < 0.92 ? 5 : 6;
}

function keywordOf(facts: DrinkFacts, discussed: number): BattleKeyword | null {
  const has: Record<BattleKeyword, boolean> = {
    shield: facts.tierLists >= MIN_TIER_LISTS && facts.tierAverage >= MIN_TIER_AVERAGE,
    match: facts.swipes >= MIN_SWIPES && facts.likes >= MIN_LIKE_SHARE,
    taunt: facts.reviews > 0 && facts.reviews >= discussed,
    loyal: facts.favorites >= MIN_FAVORITES,
    rush: facts.sugarfree,
  };
  return BATTLE_KEYWORDS.find(keyword => has[keyword]) ?? null;
}

/**
 * Характеристики всех карт сразу: цена и оценка считаются долей среди остальных напитков. Мана — цена, сумма атаки и
 * здоровья — 2 × мана + 1 (±1 лучшим и худшим по оценке, −1 за свойство), делит её разница вкуса и дизайна.
 */
export function battleStats(drinks: readonly DrinkFacts[]): BattleStats[] {
  const prices = drinks.flatMap(drink => (drink.price === null ? [] : [drink.price])).sort((a, b) => a - b);
  const score = (drink: DrinkFacts) => (smoothed(drink.taste, drink.reviews) + smoothed(drink.design, drink.reviews)) / 2;
  const scores = drinks.map(score).sort((a, b) => a - b);
  const counts = drinks.map(drink => drink.reviews).filter(Boolean).sort((a, b) => a - b);
  const discussed = counts[Math.floor(counts.length * (1 - TOP_DISCUSSED))] ?? Infinity;
  return drinks.map(drink => {
    const place = shareBelow(scores, score(drink));
    const cost = drink.price === null ? (place < 0.5 ? 4 : place < 0.85 ? 5 : 6) : costOfPrice(shareBelow(prices, drink.price));
    const keyword = keywordOf(drink, discussed);
    const budget = Math.max(2, 2 * cost + 1 + (place >= 0.85 ? 1 : place <= 0.15 ? -1 : 0) - (keyword ? 1 : 0));
    const share = clamp(0.5 + 0.1 * (smoothed(drink.taste, drink.reviews) - smoothed(drink.design, drink.reviews)), 0.25, 0.75);
    const attack = clamp(Math.round(budget * share), 1, budget - 1);
    return { cost, attack, health: budget - attack, keyword };
  });
}

/** Банка, появившаяся посреди сезона: её числа посчитает следующий сезон. */
export const PLAIN_STATS: BattleStats = { cost: 3, attack: 3, health: 4, keyword: null };

const STARTER: readonly (readonly [number, number, number])[] = [[1, 2, 1], [1, 1, 2], [1, 2, 1], [2, 3, 2], [2, 2, 3], [2, 3, 2], [2, 2, 3], [3, 4, 3], [3, 3, 4], [3, 4, 3], [4, 5, 4], [4, 4, 5], [4, 5, 4], [5, 6, 5], [6, 7, 6]];

/** Стартовые банки без бренда: играть можно сразу, а любая своя карта заменяет одну из них. */
export const STARTER_CARDS: readonly BattleCardDef[] = STARTER.map(([cost, attack, health], index) => ({
  id: `start:${index}`, brand: '', flavor: '', title: 'CanRush', name: 'Стартовая банка', cover: null, rarity: null, cost, attack, health, keyword: null,
}));

export const LOYAL_TOKEN: BattleCardDef = { id: 'token', brand: '', flavor: '', title: 'Пустая банка', name: 'Верность', cover: null, rarity: null, cost: 0, attack: 1, health: 1, keyword: null };

/** Сколько карт каждой стоимости берёт колода: без этого она вся состояла бы из дешёвых. */
const CURVE: Record<number, number> = { 1: 3, 2: 4, 3: 4, 4: 3, 5: 2, 6: 2 };

export const cardValue = (card: BattleCardDef) => (card.attack + card.health + (card.keyword ? 1.5 : 0)) / Math.max(1, card.cost);

/**
 * Колода из своих карт: сначала лучшие по кривой маны, дубль даёт вторую копию (легендарная — одна), остаток — стартовые.
 * Ручной сборки пока нет.
 */
export function buildDeck(owned: readonly (BattleCardDef & { count: number })[]): BattleCardDef[] {
  const deck: BattleCardDef[] = [];
  const used = new Map<number, number>();
  const take = (card: BattleCardDef, limit: number) => {
    if (deck.length >= DECK_SIZE || (used.get(card.cost) ?? 0) >= limit) return;
    deck.push(card);
    used.set(card.cost, (used.get(card.cost) ?? 0) + 1);
  };
  for (const card of [...owned].sort((a, b) => cardValue(b) - cardValue(a) || a.id.localeCompare(b.id))) {
    const limit = CURVE[card.cost] ?? 0;
    take(card, limit);
    if (card.count > 1 && card.rarity !== 'legendary' && MAX_COPIES > 1) take(card, limit);
  }
  for (const card of STARTER_CARDS) take(card, Infinity);
  return deck;
}
