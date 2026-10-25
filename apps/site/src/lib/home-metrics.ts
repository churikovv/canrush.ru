import { isAssortmentFlavor, isExcludedEnergyBrand, isResolvedFlavor, type CatalogGroup } from '@canrush/shared';
import { getPool } from '@/db/pool';

/**
 * A drink of the catalog as the site counts it — the official tier list's «В каталоге» and the home tile: in shops or not
 * (archived, member-added), without unknown or excluded brands, unclear flavours and «в ассортименте».
 */
export function isCountedCatalogDrink(group: Pick<CatalogGroup, 'brand' | 'flavor'>): boolean {
  return Boolean(group.brand.trim()) && group.brand.toLowerCase() !== 'unknown' && !isExcludedEnergyBrand(group.brand)
    && isResolvedFlavor(group.flavor) && !isAssortmentFlavor(group.flavor);
}

export interface HomeMetrics { reviews: number; tierLists: number; stores: number; drinks: number }

/** Stores with prices come from the city's catalog (`cityGroups`); drinks count the whole catalog (`allGroups`), archive included. */
export function catalogMetrics(cityGroups: CatalogGroup[], allGroups: CatalogGroup[]): Pick<HomeMetrics, 'stores' | 'drinks'> {
  const stores = new Set(cityGroups.flatMap(group => group.variants.map(variant => variant.retailer ?? variant.source)));
  return { stores: stores.size, drinks: allGroups.filter(isCountedCatalogDrink).length };
}

export async function getHomeCounts(): Promise<Pick<HomeMetrics, 'reviews' | 'tierLists'>> {
  const { rows } = await getPool().query<{ reviews: number; tierLists: number }>(
    `select (select count(*) from "review")::int as reviews,
       (select count(*) from "tierList" where "status" = 'published')::int as "tierLists"`,
  );
  return rows[0] ?? { reviews: 0, tierLists: 0 };
}
