import type { StoreItem } from '@/lib/store-fields';

const KEY = 'canrush-store-clipboard';
const STOCK = ['available', 'unavailable', 'unknown'];
export const STORE_CATALOG_LIMIT = 50;

/** «Скопировать ассортимент» на странице магазина: список лежит на этом устройстве, пока его не заменит следующая копия. */
export interface StoreClipboard { storeId: string; store: string; withPrices: boolean; items: StoreItem[] }

/**
 * Свой магазин копируется с ценами и наличием: это одна сеть и один автор. У чужого берём только напитки: его цены не
 * проверены для другой точки, а охота платит за цены, которые участник видел сам.
 */
export function copyStoreItems(store: { id: string; name: string }, items: readonly StoreItem[], own: boolean): StoreClipboard {
  const copied = items.slice(0, STORE_CATALOG_LIMIT).map(({ name, price, availability, brand, flavor }): StoreItem => ({
    name, price: own ? price : null, availability: own ? availability : 'available', ...(brand !== undefined ? { brand, flavor } : {}),
  }));
  return { storeId: store.id, store: store.name, withPrices: own, items: copied };
}

function validItem(value: unknown): value is StoreItem {
  if (typeof value !== 'object' || value === null) return false;
  const { name, price, availability, brand, flavor } = value as Partial<StoreItem>;
  return typeof name === 'string' && name.length > 0 && (price === null || Number.isSafeInteger(price)) && STOCK.includes(availability ?? '')
    && (brand === undefined || (typeof brand === 'string' && typeof flavor === 'string'));
}

/** Хранилище правится руками и переживает выкатки, поэтому читаем его как чужой текст; сервер всё равно проверит форму. */
export function readStoreClipboard(raw: string | null): StoreClipboard | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoreClipboard>;
    if (typeof value.storeId !== 'string' || typeof value.store !== 'string' || !Array.isArray(value.items) || !value.items.length || !value.items.every(validItem)) return null;
    return { storeId: value.storeId, store: value.store, withPrices: value.withPrices === true, items: value.items.slice(0, STORE_CATALOG_LIMIT) };
  } catch {
    return null;
  }
}

/** Один напиток в списке: связанный с каталогом — по бренду и вкусу, свой — по названию без регистра. Так же считает сервер. */
export const storeItemKey = (item: Pick<StoreItem, 'name' | 'brand' | 'flavor'>) => (item.brand !== undefined ? JSON.stringify([item.brand, item.flavor]) : item.name.toLocaleLowerCase('ru-RU'));

/** Что вставить в список магазина: напитки, которых в нём ещё нет, сколько поместится. Уже добавленные остаются как есть, со своими ценами. */
export function pasteStoreItems(current: readonly Pick<StoreItem, 'name' | 'brand' | 'flavor'>[], clipboard: StoreClipboard) {
  const known = new Set(current.map(storeItemKey));
  const fresh = clipboard.items.filter(item => !known.has(storeItemKey(item)));
  const added = fresh.slice(0, Math.max(0, STORE_CATALOG_LIMIT - current.length));
  return { added, skipped: clipboard.items.length - added.length };
}

export function saveStoreClipboard(clipboard: StoreClipboard) {
  try {
    localStorage.setItem(KEY, JSON.stringify(clipboard));
    return true;
  } catch {
    return false;
  }
}

export function loadStoreClipboard() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Копия, сделанная в другой вкладке, сразу видна в открытой форме. */
export function subscribeStoreClipboard(onChange: () => void) {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}
