import type { CatalogGroup } from '@canrush/shared';
import { getPool } from '@/db/pool';

export interface HomeMetrics { reviews: number; tierLists: number; stores: number; drinks: number }

/** Drinks and the stores with prices for them come from the city's catalog; reviews and tier lists from the database. */
export function catalogMetrics(groups: CatalogGroup[]): Pick<HomeMetrics, 'stores' | 'drinks'> {
  const stores = new Set(groups.flatMap(group => group.variants.map(variant => variant.retailer ?? variant.source)));
  return { stores: stores.size, drinks: groups.length };
}

export async function getHomeCounts(): Promise<Pick<HomeMetrics, 'reviews' | 'tierLists'>> {
  const { rows } = await getPool().query<{ reviews: number; tierLists: number }>(
    `select (select count(*) from "review")::int as reviews,
       (select count(*) from "tierList" where "status" = 'published')::int as "tierLists"`,
  );
  return rows[0] ?? { reviews: 0, tierLists: 0 };
}
