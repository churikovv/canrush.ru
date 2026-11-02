import { STORE_CATALOG_LIMIT, storeItemKey, type StoreClipboard } from '@/lib/store-clipboard';
import { StoreError, type StoreItem } from '@/lib/store-fields';

/** Своих шаблонов у участника: этого хватает на несколько сетей, а список в окне остаётся коротким. */
export const MAX_STORE_PRESETS = 10;
export const PRESET_NAME_LIMIT = 40;
/** Шаблон, который видят все: из одной-двух банок он никому не поможет. */
export const MIN_PUBLIC_PRESET_DRINKS = 3;
/** Сколько шаблонов участников показывает лист: самые новые. */
export const PUBLIC_PRESETS_SHOWN = 30;
/** Готовые шаблоны: один бренд, его самые продаваемые вкусы. Новый бренд — новая строка. */
export const MASS_MARKET_PRESETS = [
  { name: 'Масс-маркет Burn', brand: 'Burn' },
  { name: 'Масс-маркет Monster', brand: 'Monster' },
  { name: 'Масс-маркет Adrenaline', brand: 'Adrenaline Rush' },
  { name: 'Масс-маркет Flash Up', brand: 'Flash Up' },
] as const;
export const MASS_MARKET_SIZE = 12;

export type PresetDrink = Pick<StoreItem, 'name' | 'brand' | 'flavor'>;
export interface ReadyPreset { name: string; drinks: PresetDrink[] }
export interface StorePresetView extends ReadyPreset { id: string; published: boolean }
/** Чужой опубликованный шаблон: `author` — ник автора. */
export interface SharedPresetView extends ReadyPreset { id: string; author: string }
export interface StoreTemplates { ready: ReadyPreset[]; shared: SharedPresetView[]; own: StorePresetView[]; staff: boolean }
/** Магазин в поле «Скопировать из магазина». */
export interface CopyStoreOption { id: string; name: string; address: string; drinks: number; own: boolean }

export function parsePresetName(value: string) {
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name || name.length > PRESET_NAME_LIMIT) throw new StoreError(`Назовите шаблон (до ${PRESET_NAME_LIMIT} символов).`);
  return name;
}

/** Список из браузера — чужой текст: берём только название и связь с каталогом, повторы выбрасываем. Цены в шаблон не попадают. */
export function parsePresetDrinks(value: unknown): PresetDrink[] {
  if (!Array.isArray(value)) throw new StoreError('Проверьте список напитков.');
  const drinks = new Map<string, PresetDrink>();
  for (const item of value) {
    const { name, brand, flavor } = (item ?? {}) as Partial<PresetDrink>;
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 150) throw new StoreError('Проверьте список напитков.');
    const drink: PresetDrink = typeof brand === 'string' && typeof flavor === 'string' && brand && flavor ? { name: name.trim(), brand, flavor } : { name: name.trim() };
    drinks.set(storeItemKey(drink), drink);
  }
  if (!drinks.size || drinks.size > STORE_CATALOG_LIMIT) throw new StoreError(`В шаблоне может быть от 1 до ${STORE_CATALOG_LIMIT} напитков.`);
  return [...drinks.values()];
}

/** Шаблон в списке магазина: цен нет, наличие можно поправить в строке. */
export const presetItems = (drinks: readonly PresetDrink[]): StoreItem[] => drinks.map(drink => ({ ...drink, price: null, availability: 'available' }));

/** Шаблон вставляется тем же путём, что и копия магазина. */
export const presetClipboard = (name: string, drinks: readonly PresetDrink[]): StoreClipboard => ({ storeId: '', store: name, withPrices: false, items: presetItems(drinks) });

/** Подписи карточек: если весь шаблон одного бренда, повторять его в каждой незачем. */
export function presetCaptions(drinks: readonly PresetDrink[]) {
  const brand = drinks[0]?.brand;
  const prefix = brand !== undefined && drinks.every(drink => drink.brand === brand) ? `${brand} · ` : '';
  return drinks.map(drink => (drink.name.startsWith(prefix) ? drink.name.slice(prefix.length) : drink.name));
}

/**
 * Готовые шаблоны из того, что стоит на полках: магазины участников весят вдвое больше сетей, потому что это настоящие точки, а сети
 * добирают вкусы, пока магазинов мало. Числа — сколько магазинов и сколько сетей продают напиток сейчас. Бренд, которого нигде нет, шаблона не даёт.
 */
export function massMarketPresets(options: readonly { brand: string; flavor: string; label: string }[], shelves: ReadonlyMap<string, number>, chains: ReadonlyMap<string, number>): ReadyPreset[] {
  const key = (option: { brand: string; flavor: string }) => JSON.stringify([option.brand, option.flavor]);
  return MASS_MARKET_PRESETS.map(({ name, brand }) => ({
    name,
    drinks: options.filter(option => option.brand === brand)
      .map(option => ({ option, score: (shelves.get(key(option)) ?? 0) * 2 + (chains.get(key(option)) ?? 0) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || a.option.label.localeCompare(b.option.label, 'ru'))
      .slice(0, MASS_MARKET_SIZE)
      .map(({ option }): PresetDrink => ({ name: option.label, brand: option.brand, flavor: option.flavor })),
  })).filter(preset => preset.drinks.length > 0);
}
