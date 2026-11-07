/**
 * The look shop (`ProfileShop` in the profile settings): tags and frames bought with «Искры», the shop's own currency.
 * They are the shop's own items — achievement tags are still earned and never sold, or «Монстр» and «База» would mean
 * nothing. Keys are stored with the purchase and in the profile (tag check `user_known_profile_tag`, frame check
 * `user_profile_appearance`), so never rename them; a new item needs a migration that widens the checks.
 *
 * Sparks are only earned — never sell them for money, never pay them for tracker cans (the site is 18+), and never tie
 * them to the hunt's price tags (those turn into roubles). The balance is not stored: it is what the sources below give
 * (`sparkEarnings`) minus what was spent (`shopPurchase`).
 */
export type ShopKind = 'tag' | 'frame';
export type ShopTier = 'common' | 'rare' | 'epic' | 'legendary';
export interface ShopItem { key: string; kind: ShopKind; tier: ShopTier; label: string; price: number; description: string }

/** Sparks for each level above the first. */
export const LEVEL_SPARKS = 15;
/** Sparks for the first review, once (the `first-review` XP row, migration 0207). */
export const FIRST_REVIEW_SPARKS = 25;
/** Sparks for a place in the week race: first, 2–5, 6–10. */
export const RACE_SPARKS = { hero: 100, best: 60, charge: 30 } as const;
/** Achievements pay their trophy points (`TROPHY_POINTS`: 10, 25, 50, 100). */
export const raceSparks = (place: number) => place === 1 ? RACE_SPARKS.hero : place <= 5 ? RACE_SPARKS.best : RACE_SPARKS.charge;

/**
 * Tiers by what members actually earn (prod, 4 November 2026, 141 active members of 250; achievements, +15 a level and
 * the week race): median 40 sparks, top quarter 100, top 10% 325, top 5% 645, the most 1285. A common item is within
 * reach of half the active members, rare — of a quarter, epic — of a tenth, legendary — of the top twentieth. All the
 * shop together costs about three times what the richest member has, so nobody buys everything at once. Revisit the
 * prices against the same numbers when the site grows.
 */
export const SHOP_TIERS: Record<ShopTier, { label: string; range: [number, number] }> = {
  common: { label: 'Обычный', range: [30, 50] },
  rare: { label: 'Редкий', range: [90, 130] },
  epic: { label: 'Эпический', range: [250, 350] },
  legendary: { label: 'Легендарный', range: [600, 700] },
};

export const SHOP_ITEMS: readonly ShopItem[] = [
  { key: 'owl', kind: 'tag', tier: 'common', label: 'Сова', price: 35, description: 'Ночной режим: глаза моргают и следят за лентой' },
  { key: 'chill', kind: 'tag', tier: 'common', label: 'Чилл', price: 40, description: 'Мятная волна, которая никуда не торопится' },
  { key: 'npc', kind: 'tag', tier: 'common', label: 'NPC', price: 45, description: 'Пиксельный тег и маркер квеста над головой' },
  { key: 'vibe', kind: 'tag', tier: 'rare', label: 'Вайб', price: 95, description: 'Эквалайзер, который не выключается' },
  { key: 'crush', kind: 'tag', tier: 'rare', label: 'Краш', price: 100, description: 'Сердце бьётся, сердечки улетают вверх' },
  { key: 'battery', kind: 'tag', tier: 'rare', label: 'Батарейка', price: 110, description: 'Заряжается снова и снова, до зелёного' },
  { key: 'bubbles', kind: 'frame', tier: 'rare', label: 'Пузырьки', price: 115, description: 'Газировка: пузырьки поднимаются вокруг аватарки' },
  { key: 'tilt', kind: 'tag', tier: 'rare', label: 'Тильт', price: 125, description: 'Спираль крутится, тег иногда срывается' },
  { key: 'sigma', kind: 'tag', tier: 'epic', label: 'Сигма', price: 260, description: 'Холодная сталь и ни одной лишней эмоции' },
  { key: 'auf', kind: 'tag', tier: 'epic', label: 'Ауф', price: 285, description: 'Луна, ночь и вой, который расходится волнами' },
  { key: 'cyber', kind: 'tag', tier: 'epic', label: 'Кибер', price: 320, description: 'Неон, сканлайны и сбой сигнала' },
  { key: 'aurora', kind: 'frame', tier: 'epic', label: 'Северное сияние', price: 340, description: 'Ленты сияния медленно плывут по кругу' },
  { key: 'boss', kind: 'tag', tier: 'legendary', label: 'Босс', price: 600, description: 'Бархат, золото и корона, которая сама подпрыгивает' },
  { key: 'hologram', kind: 'frame', tier: 'legendary', label: 'Голограмма', price: 650, description: 'Переливчатое кольцо, сетка и луч сканера' },
  { key: 'main', kind: 'tag', tier: 'legendary', label: 'Главный герой', price: 700, description: 'Прожектор на сцене и звёзды вокруг имени' },
];

export const SHOP_TAGS = SHOP_ITEMS.filter(item => item.kind === 'tag');
export const shopItem = (key: string) => SHOP_ITEMS.find(item => item.key === key);
export const isShopTag = (key: string) => SHOP_TAGS.some(item => item.key === key);

/** The week's deal: one item a quarter cheaper, a new one every Monday by Moscow time, in turn through the shop. */
export const DEAL_DISCOUNT = .25;
const WEEK_MS = 7 * 86_400_000;
// Monday 00:00 by Moscow time, as UTC: weeks are counted from it.
const WEEK_ZERO = Date.UTC(2026, 10, 1, 21);
export function weekIndex(now: Date): number { return Math.floor((now.getTime() - WEEK_ZERO) / WEEK_MS); }
export function weeklyDeal(now = new Date()): { item: ShopItem; price: number; endsAt: Date } {
  const index = weekIndex(now);
  // A stride that is coprime with the list's length walks through every item before repeating one.
  const item = SHOP_ITEMS[((index * 7) % SHOP_ITEMS.length + SHOP_ITEMS.length) % SHOP_ITEMS.length]!;
  // Round prices of a hundred and more to fives; a cheap item to whole sparks, or 35 would become 25 (−29%).
  const raw = item.price * (1 - DEAL_DISCOUNT);
  return { item, price: raw >= 100 ? Math.round(raw / 5) * 5 : Math.round(raw), endsAt: new Date(WEEK_ZERO + (index + 1) * WEEK_MS) };
}
/** What an item costs right now: its price, or the week's deal. */
export function priceNow(item: ShopItem, now = new Date()): number {
  const deal = weeklyDeal(now);
  return deal.item.key === item.key ? deal.price : item.price;
}
