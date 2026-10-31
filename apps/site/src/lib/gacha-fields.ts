/**
 * «Банкомат» (гача): правила без базы данных — их берут и сервер, и страницы. Крышки только зарабатываются, шансы
 * открыты, гарант считается по журналу круток.
 */
export const RARITIES = ['common', 'rare', 'epic', 'legendary'] as const;
export type Rarity = (typeof RARITIES)[number];

export const RARITY_LABELS: Record<Rarity, string> = { common: 'Обычная', rare: 'Редкая', epic: 'Эпическая', legendary: 'Легендарная' };
/** Шанс редкости в промилле: сначала выбирается редкость, потом банка внутри неё, поэтому шанс не зависит от размера группы. */
export const RARITY_ODDS: Record<Rarity, number> = { common: 700, rare: 220, epic: 70, legendary: 10 };
export const RARITY_HINTS: Record<Rarity, string> = {
  common: 'продаётся в трёх сетях и больше',
  rare: 'одна-две сети',
  epic: 'архив: сейчас в магазинах не найти',
  legendary: 'снята с производства или добавлена участником',
};

export const PULL_COST = 10;
export const TEN_PULL_COST = 90;
export const WELCOME_CAPS = 30;
/** Эпическая или выше — не реже чем раз в столько круток, легендарная — раз в `PITY_LEGENDARY`. */
export const PITY_EPIC = 10;
export const PITY_LEGENDARY = 60;

/** Откуда берутся крышки — то же, что начисляют триггеры миграции `0154`. */
export const CAP_SOURCES = [
  { title: 'Бесплатная крутка', note: 'раз в день' },
  { title: 'Задания дня', note: '+5–15 за задание · +10 за все задания дня' },
  { title: 'Раздачи в ленте', note: 'подарочные крутки за просмотр баннера' },
  { title: 'Победы в Битве банок', note: 'колечки: из них собираются подарочные крутки' },
  { title: 'Банка в трекере', note: '+3 · раз в день' },
  { title: 'Отзыв на напиток', note: '+10 · до трёх в день' },
  { title: 'Опубликованный тирлист', note: '+15 · один в день' },
  { title: '10 свайпов в дейтинге', note: '+2 · раз в день' },
  { title: 'Серия трекера 7 и 14 дней', note: '+20' },
  { title: 'Серия трекера от 30 дней', note: '+60' },
] as const;

/** Напитки, которые легендарны по решению команды, что бы ни говорили магазины. */
export const LEGENDARY_DRINKS: readonly (readonly [string, string])[] = [['Adrenaline Rush', 'game_fuel_mango']];

export interface RarityFacts {
  /** Разных сетей с действующими ценами во всех городах */ retailers: number;
  /** Напиток участника (не компании), опубликованный модераторами */ member: boolean;
  /** Отмечен «больше не производится» */ discontinued: boolean;
  /** В ручном списке легенд */ manual: boolean;
}

/** Редкость из настоящих данных каталога. */
export function rarityOf(facts: RarityFacts): Rarity {
  if (facts.manual || facts.discontinued) return 'legendary';
  if (facts.retailers >= 3) return 'common';
  if (facts.retailers >= 1) return 'rare';
  return facts.member ? 'legendary' : 'epic';
}

export const rarityRank = (rarity: Rarity) => RARITIES.indexOf(rarity);
export const betterRarity = (a: Rarity, b: Rarity): Rarity => (rarityRank(a) >= rarityRank(b) ? a : b);

export interface PityState { /** Круток подряд без эпической и выше */ sinceEpic: number; /** без легендарной */ sinceLegendary: number }

/**
 * Редкость одной крутки. `roll` — случайное целое `[0, max)`. Десятая подряд без эпической даёт эпическую или
 * легендарную (в пропорции их шансов), шестидесятая без легендарной — легендарную.
 */
export function rollRarity(roll: (max: number) => number, pity: PityState): { rarity: Rarity; pity: boolean } {
  if (pity.sinceLegendary + 1 >= PITY_LEGENDARY) return { rarity: 'legendary', pity: true };
  if (pity.sinceEpic + 1 >= PITY_EPIC) {
    const top = RARITY_ODDS.epic + RARITY_ODDS.legendary;
    return { rarity: roll(top) < RARITY_ODDS.legendary ? 'legendary' : 'epic', pity: true };
  }
  let value = roll(1000);
  for (const rarity of [...RARITIES].reverse()) {
    if (value < RARITY_ODDS[rarity]) return { rarity, pity: false };
    value -= RARITY_ODDS[rarity];
  }
  return { rarity: 'common', pity: false };
}

export function nextPity(state: PityState, rarity: Rarity): PityState {
  return {
    sinceEpic: rarityRank(rarity) >= rarityRank('epic') ? 0 : state.sinceEpic + 1,
    sinceLegendary: rarity === 'legendary' ? 0 : state.sinceLegendary + 1,
  };
}

/**
 * Банка выпавшей редкости. Пустая группа (например, легенд пока нет) отдаёт ближайшую непустую ниже, а если ниже
 * пусто — выше: крутка не пропадает.
 */
export function pickFromPool<T extends { rarity: Rarity }>(pool: readonly T[], rarity: Rarity, roll: (max: number) => number, weight: (item: T) => number = () => 1): T | null {
  const order = [rarity, ...RARITIES.slice(0, rarityRank(rarity)).reverse(), ...RARITIES.slice(rarityRank(rarity) + 1)];
  for (const candidate of order) {
    const items = pool.filter(item => item.rarity === candidate);
    if (!items.length) continue;
    // Weights are whole numbers: a season's star counts as several tickets in its rarity.
    let ticket = roll(items.reduce((sum, item) => sum + weight(item), 0));
    for (const item of items) {
      ticket -= weight(item);
      if (ticket < 0) return item;
    }
  }
  return null;
}

/** Дубль приносит осколки по редкости, из осколков собирается конкретная недостающая карточка. */
export const DUPE_SHARDS: Record<Rarity, number> = { common: 1, rare: 3, epic: 10, legendary: 30 };
export const CRAFT_COST: Record<Rarity, number> = { common: 20, rare: 60, epic: 200, legendary: 600 };

export interface GachaCosmetic { key: 'pumpkin'; title: string; note: string }
export interface GachaBanner {
  key: string; title: string; subtitle: string;
  /** Начало и конец по Москве (`YYYY-MM-DDTHH:mm`), конец не включается */ from: string; to: string;
  /** «Звёзды сезона» — по ключу вкуса или названию; внутри своей редкости у них `boost` билетов вместо одного */
  stars: RegExp; boost: number;
  /** Эксклюзив баннера: шанс в промилле за крутку и гарант — не позже этой крутки на баннере */
  cosmetic?: GachaCosmetic & { odds: number; pity: number };
  /** Сцена из Blender (`design/3d`): петля автомата, выпадение банки и постер — вместо CSS-автомата */
  scene?: GachaScene;
}
/** `ground` — цвет низа кадра: им сцена продолжается под видео. */
export interface GachaScene { idle: string; dispense: string; poster: string; width: number; height: number; ground: string }

export const MAIN_BANNER = 'main';
export const GACHA_BANNERS: readonly GachaBanner[] = [{
  key: 'halloween-2026',
  title: 'Тыквенный автомат',
  subtitle: 'Хеллоуин: тёмные банки, вишня, виноград и тыква выпадают втрое чаще, а с автомата может упасть рамка «Тыквенная».',
  from: '2026-10-29T00:00', to: '2026-11-03T00:00',
  stars: /pumpkin|тыкв|black|dark|тёмн|темн|чёрн|черн|night|ноч|mystery|таинств|blood|cherry|вишн|grape|виноград|blackcurrant|смородин/i,
  boost: 3,
  cosmetic: { key: 'pumpkin', title: 'Рамка «Тыквенная»', note: 'рамка аватарки с тыквой и летучими мышами — только с Тыквенного автомата', odds: 20, pity: 30 },
  scene: { idle: '/brand/gacha/halloween-idle.mp4', dispense: '/brand/gacha/halloween-dispense.mp4', poster: '/brand/gacha/halloween-poster.jpg', width: 720, height: 700, ground: '#060424' },
}];

/** Автомат вне сезонов: ночь у озера. Сезон со своей сценой подменяет её на своё время. */
export const MAIN_SCENE: GachaScene = { idle: '/brand/gacha/night-idle.mp4', dispense: '/brand/gacha/night-dispense.mp4', poster: '/brand/gacha/night-poster.jpg', width: 720, height: 700, ground: '#070346' };

/** Москва — UTC+3 без перехода на летнее время. */
const moscow = (value: string) => Date.parse(`${value}:00+03:00`);
export function activeBanner(now = Date.now()): GachaBanner | null {
  return GACHA_BANNERS.find(banner => moscow(banner.from) <= now && now < moscow(banner.to)) ?? null;
}
export const activeScene = (now = Date.now()): GachaScene => activeBanner(now)?.scene ?? MAIN_SCENE;
export function bannerEndsLabel(banner: GachaBanner): string {
  const end = new Date(moscow(banner.to) - 1);
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Moscow' }).format(end);
}
export const isSeasonStar = (banner: GachaBanner | null, drink: { flavor: string; name: string }) => Boolean(banner?.stars.test(`${drink.flavor} ${drink.name}`));

/** Выпал ли эксклюзив на этой крутке: по шансу или по гаранту (`pulled` — круток на баннере до этой). */
export function rollCosmetic(roll: (max: number) => number, banner: GachaBanner | null, owned: boolean, pulled: number): boolean {
  if (!banner?.cosmetic || owned) return false;
  return pulled + 1 >= banner.cosmetic.pity || roll(1000) < banner.cosmetic.odds;
}

/** Сколько круток осталось до гаранта — то, что показывает автомат. */
export function pityLeft(state: PityState): { epic: number; legendary: number } {
  return { epic: Math.max(1, PITY_EPIC - state.sinceEpic), legendary: Math.max(1, PITY_LEGENDARY - state.sinceLegendary) };
}
