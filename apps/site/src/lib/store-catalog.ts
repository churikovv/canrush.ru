import { isExcludedEnergyBrand, isResolvedFlavor } from '@canrush/shared';
import { loadAllCatalogGroups } from '@/lib/catalog';
import { mergeCatalogAliases } from '@/lib/catalog-files';
import { catalogGroupSlug, flavorName } from '@/lib/catalog-query';
import type { StoreItem } from '@/lib/store-fields';
import type { Store } from '@/lib/stores';

/** Catalog drink the store form offers in its picker. */
export interface StoreDrinkOption { brand: string; flavor: string; label: string; cover?: string }
/** Store drink as rendered: catalog drinks get their product page and cover. */
export type StoreItemView = StoreItem & { href?: string; cover?: string };
export type StoreView = Omit<Store, 'catalog'> & { catalog: StoreItemView[] };

const key = (brand: string, flavor: string) => JSON.stringify([brand, flavor]);

/** Brand+flavor groups from every city and the archive: shelves keep older editions longer than retailers. */
export async function storeDrinkOptions(): Promise<StoreDrinkOption[]> {
  const options = new Map<string, StoreDrinkOption>();
  for (const group of mergeCatalogAliases(await loadAllCatalogGroups())) {
    const brand = group.brand.trim();
    if (!brand || brand.toLowerCase() === 'unknown' || isExcludedEnergyBrand(brand) || !isResolvedFlavor(group.flavor)) continue;
    options.set(key(group.brand, group.flavor), { brand: group.brand, flavor: group.flavor, label: `${group.brand} · ${flavorName(group.flavor)}`, ...(group.coverImageUrl?.startsWith('/') ? { cover: group.coverImageUrl } : {}) });
  }
  return [...options.values()].sort((a, b) => a.label.localeCompare(b.label, 'ru'));
}

/** Server-side check of browser input: unknown catalog links become custom drinks, known ones get the canonical name. */
export async function linkStoreCatalog(items: StoreItem[]): Promise<StoreItem[]> {
  if (!items.some(item => item.brand !== undefined)) return items;
  const options = new Map((await storeDrinkOptions()).map(option => [key(option.brand, option.flavor), option]));
  return items.map(item => {
    if (item.brand === undefined || item.flavor === undefined) return item;
    const option = options.get(key(item.brand, item.flavor));
    return option ? { ...item, name: option.label } : { name: item.name, price: item.price, availability: item.availability };
  });
}

export async function withCatalogLinks<T extends Store>(stores: T[]): Promise<(Omit<T, 'catalog'> & { catalog: StoreItemView[] })[]> {
  const options = stores.some(store => store.catalog.some(item => item.brand !== undefined))
    ? new Map((await storeDrinkOptions()).map(option => [key(option.brand, option.flavor), option])) : new Map<string, StoreDrinkOption>();
  return stores.map(store => ({ ...store, catalog: store.catalog.map(item => {
    if (item.brand === undefined || item.flavor === undefined) return item;
    const option = options.get(key(item.brand, item.flavor));
    return { ...item, href: `/catalog/${catalogGroupSlug(item.brand, item.flavor)}`, ...(option?.cover ? { cover: option.cover } : {}) };
  }) }));
}
