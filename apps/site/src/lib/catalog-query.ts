import { searchMatches } from './search-match';
import { Buffer } from 'node:buffer';
import {
  ENERGY_DRINK_BRAND_ALIASES,
  type CatalogGroup,
  type FlavorVariant,
  type SourceName,
} from '@canrush/shared';

export const CATALOG_SORTS = ['deals', 'brand', 'stores', 'price-desc', 'discount'] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number];

const SOURCE_NAMES: Record<SourceName, string> = {
  edadeal: 'Едадил',
  wildberries: 'Wildberries',
  ozon: 'Ozon',
  pyaterochka: 'Пятёрочка',
  magnit: 'Магнит',
  lenta: 'Лента',
};

export interface CatalogFilters {
  query: string;
  brand: string;
  flavor: string;
  sort: CatalogSort;
}

const FLAVOR_NAMES: Record<string, string> = {
  original: 'Оригинальный',
  apple: 'Яблоко',
  kiwi: 'Киви',
  tropical: 'Тропический',
  watermelon: 'Арбуз',
  cherry: 'Вишня',
  citrus: 'Цитрус',
  lemon: 'Лимон',
  lime: 'Лайм',
  orange: 'Апельсин',
  mango: 'Манго',
  strawberry: 'Клубника',
  raspberry: 'Малина',
  cola: 'Кола',
  berry: 'Ягодный',
  grape: 'Виноград',
  pineapple: 'Ананас',
  peach: 'Персик',
  melon: 'Дыня',
  mint: 'Мята',
  coconut: 'Кокос',
  vanilla: 'Ваниль',
  guava: 'Гуава',
  pomegranate: 'Гранат',
  blueberry: 'Голубика и черника',
  blue_raspberry: 'Голубая малина',
  passion_fruit: 'Маракуйя',
  calamansi: 'Каламанси',
  irga: 'Ирга',
  yuzu: 'Юдзу',
  barberry: 'Барбарис',
  cactus: 'Кактус',
  pomelo: 'Помело',
  cranberry: 'Клюква',
  banana: 'Банан',
  feijoa: 'Фейхоа',
  lulo: 'Луло',
  bubblegum: 'Жевательная резинка',
  grapefruit: 'Грейпфрут',
  apricot: 'Абрикос',
  plum: 'Слива',
  blackcurrant: 'Чёрная смородина',
  dragonfruit: 'Драконий фрукт',
  pear: 'Груша',
  elderflower: 'Бузина',
  acai: 'Асаи',
  unknown: 'Вкус не указан',
};

export function flavorName(flavor: string): string {
  const named: Record<string, string> = { bacchus_still: "Негазированный", bacchus_sparkling: "Газированный", lit_turbo: "Turbo", dydo_vita_jelly: "Vita Energy Jelly", bizon_black: "Black", power_torr_red: "Red · Ягодно-фруктовый микс", scandalist_adder_terror: "Adder Terror", scandalist_geneve: "Geneve", go_champ_aperative: "Aperative","monster_ultra_white": "Ultra White", "monster_ultra_paradise": "Ultra Paradise", "monster_ultra_violet": "Ultra Violet", "monster_ultra_black": "Ultra Black", "monster_ultra_rosa": "Ultra Rosa", "monster_ultra_strawberry": "Ultra Strawberry", "monster_ultra_fiesta": "Ultra Fiesta Mango", "monster_ultra_golden_pineapple": "Ultra Golden Pineapple", "monster_ultra_watermelon": "Ultra Watermelon", "monster_ultra_vice_guava": "Ultra Vice Guava", "monster_ultra_fantasy": "Ultra Fantasy", "monster_mango_loco": "Mango Loco", "monster_bad_apple": "Bad Apple", "monster_monarch": "Monarch", "monster_pipeline_punch": "Pipeline Punch", "monster_rio_punch": "Rio Punch", "monster_aussie_lemonade": "Aussie Lemonade", "monster_nitro_cosmic_peach": "Nitro Cosmic Peach", "monster_nitro": "Nitro", "monster_rehab_peach_tea": "Rehab Peach Tea", "monster_the_doctor": "The Doctor", "monster_vr46": "VR46", "monster_full_throttle": "Full Throttle", "monster_lando_norris": "Lando Norris", "monster_khaotic": "Khaotic", "monster_strawberry_shot": "Strawberry Shot", "monster_viking_berry": "Viking Berry", "monster_absolute_zero": "Absolute Zero", "ashkudi_belarus_apples": "Belarus Apples", "redbull_sods_summer_berry": "Sods Summer Berry"};
  if (named[flavor]) return named[flavor];
  if (flavor.startsWith('unresolved:')) return 'Вкус не уточнён';
  if (flavor === 'sugarfree') return 'Без сахара';
  if (flavor === 'coffee') return 'Кофе';
  const editions: Record<string, string> = { drive_max: 'Max', drive_caramel: 'Caramel Lollypop', drive_bubble: 'Bubble Blast', drive_exotic: 'Экзотическая энергия', pulse_frozen: 'Frozen Energy', pulse_prosecco: 'Prosecco Energy', pulse_your: 'Your Energy', pulse_drive: 'Drive', guarana: 'Гуарана', genesis_green: 'Green Star · Зелёная звезда', genesis_purple: 'Purple Star · Фиолетовая звезда', genesis_mystery: 'Mystery Star · Мистическая звезда', jaguar_free: 'Free', jaguar_cult: 'Cult', jaguar_live: 'Live', burn_gold_rush: 'Gold Rush', burn_juicy: 'Сочная энергия', burn_dark: 'Тёмная энергия', cosmos_bold: 'Дерзкая энергия', cosmos_bright: 'Яркая энергия', aziano_fly: 'Fly', aziano_power: 'Power', target_active: 'Active', gorilla_green_boost: 'Green Boost', gorilla_ultimate: 'Ultimate', gorilla_berry_blast: 'Berry Blast', gorilla_berry_bloom: 'Berry Bloom', tornado_black: 'Black', tornado_storm: 'Storm', tornado_asian_mix: 'Asian Mix', tornado_bubble: 'Bubble', tornado_razzberry: 'Razzberry', tornado_russian: 'Russian', tornado_boost: 'Boost', tornado_iceberry: 'Iceberry', tornado_active: 'Active', tornado_berrycream: 'Berrycream', tornado_sour_marm: 'Sour & Marm', plum_pie: 'Сливовый пирог', popcorn: 'Попкорн', game_fuel: 'Game Fuel · Игровая энергия', spicy: 'Spicy Energy', breeze: 'Breeze Energy', mystery: 'Таинственная энергия', extra: 'Extra', game_mode_xp: 'Game Mode XP', game_mode_mp: 'Game Mode MP', ultra: 'Ultra Energy', marshmallow: 'Маршмеллоу', lemon_waffle: 'Лимонная вафля', blueberry_donut: 'Черничный пончик' };
  if (editions[flavor]) return editions[flavor];
  if (flavor.endsWith(':sugarfree')) return `${flavorName(flavor.slice(0, -10))} · без сахара`;
  if (flavor.startsWith('blend:')) return flavor.slice(6).split('+').map(flavorName).join(' + ');
  return FLAVOR_NAMES[flavor] ?? flavor;
}

export function catalogRetailerName(variant: FlavorVariant): string {
  return variant.retailer ?? SOURCE_NAMES[variant.source];
}

export function catalogOffers(group: CatalogGroup): FlavorVariant[] {
  const byRetailerAndVolume = new Map<string, FlavorVariant>();
  for (const variant of group.variants) {
    const key = `${catalogRetailerName(variant).toLocaleLowerCase('ru-RU')}\u0000${variant.volumeMl ?? 'unknown'}`;
    const existing = byRetailerAndVolume.get(key);
    if (!existing || variant.price < existing.price) byRetailerAndVolume.set(key, variant);
  }
  return [...byRetailerAndVolume.values()].sort((left, right) => left.price - right.price);
}

export function catalogOffersByVolume(group: CatalogGroup): { volumeMl: number | undefined; offers: FlavorVariant[] }[] {
  const volumes = new Map<number | undefined, FlavorVariant[]>();
  for (const offer of catalogOffers(group)) {
    const offers = volumes.get(offer.volumeMl) ?? [];
    offers.push(offer);
    volumes.set(offer.volumeMl, offers);
  }
  return [...volumes.entries()]
    .sort(([left], [right]) => (left ?? Infinity) - (right ?? Infinity))
    .map(([volumeMl, offers]) => ({ volumeMl, offers }));
}

function normalizeText(value: string): string {
  return value.toLocaleLowerCase('ru-RU').replace(/ё/gu, 'е').trim();
}

function matchesCatalogQuery(group: CatalogGroup, query: string): boolean {
  const variants = group.variants.flatMap((variant) => {
    const volume = variant.volumeMl;
    return [catalogRetailerName(variant), volume === undefined ? '' : `${volume} мл ${volume / 1000} л`];
  });
  const brandAliases = ENERGY_DRINK_BRAND_ALIASES[group.brand] ?? [];
  const haystack = normalizeText(
    [group.brand, ...brandAliases, group.flavor, flavorName(group.flavor), ...variants].join(' '),
  );
  return searchMatches(haystack, query);
}

export function catalogRetailerCount(group: CatalogGroup): number {
  return new Set(group.variants.map((variant) => variant.retailer ?? variant.source)).size;
}

export function isCatalogSort(value: string): value is CatalogSort {
  return CATALOG_SORTS.includes(value as CatalogSort);
}

export function filterCatalogGroups(groups: CatalogGroup[], filters: CatalogFilters): CatalogGroup[] {
  const filtered = groups.filter((group) => {
    if (filters.brand && group.brand !== filters.brand) return false;
    if (filters.flavor && group.flavor !== filters.flavor) return false;
    return matchesCatalogQuery(group, filters.query);
  });

  return filtered.sort((left, right) => {
    if (filters.sort === 'discount') {
      const discount = (group: CatalogGroup) => Math.max(0, ...group.variants.map(v => v.oldPrice && v.oldPrice > v.price ? (v.oldPrice - v.price) / v.oldPrice : 0));
      return discount(right) - discount(left) || left.minPrice - right.minPrice;
    }
    if (filters.sort === 'brand') {
      return left.brand.localeCompare(right.brand, 'ru-RU') || left.flavor.localeCompare(right.flavor, 'ru-RU');
    }
    if (filters.sort === 'stores') {
      return catalogRetailerCount(right) - catalogRetailerCount(left) || left.minPrice - right.minPrice;
    }
    if (filters.sort === 'price-desc') return right.minPrice - left.minPrice;
    return left.minPrice - right.minPrice || catalogRetailerCount(right) - catalogRetailerCount(left);
  });
}

export function catalogGroupSlug(brand: string, flavor: string): string {
  return Buffer.from(JSON.stringify([brand, flavor]), 'utf-8').toString('base64url');
}

export function decodeCatalogGroupSlug(slug: string): { brand: string; flavor: string } | null {
  if (!slug || slug.length > 512) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(slug, 'base64url').toString('utf-8'));
    if (!Array.isArray(parsed) || parsed.length !== 2) return null;
    const [brand, flavor] = parsed;
    if (typeof brand !== 'string' || typeof flavor !== 'string' || !brand || !flavor) return null;
    return { brand, flavor };
  } catch {
    return null;
  }
}
