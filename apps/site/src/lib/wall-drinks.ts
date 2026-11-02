import { catalogGroupSlug, flavorName } from '@/lib/catalog-query';
import { storeDrinkOptions, type StoreDrinkOption } from '@/lib/store-catalog';
import type { WallDrink } from '@/lib/wall-drink-fields';

/** The catalog is read again after five minutes: every feed page with a drink in it would otherwise read it. */
const KEEP_MS = 5 * 60_000;
const key = (brand: string, flavor: string) => JSON.stringify([brand, flavor]);
let kept: { at: number; drinks: Promise<Map<string, StoreDrinkOption>> } | null = null;

/** Catalog drinks a wall record or a comment may carry, by brand and flavour. */
export function drinkCatalog(): Promise<Map<string, StoreDrinkOption>> {
  if (!kept || Date.now() - kept.at > KEEP_MS) {
    const drinks = storeDrinkOptions().then(options => new Map(options.map(option => [key(option.brand, option.flavor), option])));
    drinks.catch(() => { kept = null; });
    kept = { at: Date.now(), drinks };
  }
  return kept.drinks;
}

export async function isCatalogDrink(brand: string, flavor: string): Promise<boolean> {
  return (await drinkCatalog()).has(key(brand, flavor));
}

/**
 * Rows with the drink as the page shows it: name, cover and link from the catalog. A drink that has left the catalog
 * keeps its name, without a link.
 */
export async function withWallDrinks<Row extends { drinkBrand: string | null; drinkFlavor: string | null }>(rows: Row[]): Promise<(Row & { drink: WallDrink | null })[]> {
  if (!rows.some(row => row.drinkBrand && row.drinkFlavor)) return rows.map(row => ({ ...row, drink: null }));
  const catalog = await drinkCatalog();
  return rows.map(row => {
    if (!row.drinkBrand || !row.drinkFlavor) return { ...row, drink: null };
    const option = catalog.get(key(row.drinkBrand, row.drinkFlavor));
    const drink: WallDrink = option
      ? { brand: option.brand, flavor: option.flavor, label: option.label, href: `/catalog/${catalogGroupSlug(option.brand, option.flavor)}`, ...(option.cover ? { cover: option.cover } : {}) }
      : { brand: row.drinkBrand, flavor: row.drinkFlavor, label: `${row.drinkBrand} · ${flavorName(row.drinkFlavor)}` };
    return { ...row, drink };
  });
}
