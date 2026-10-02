import { isResolvedFlavor } from '@canrush/shared';
import { cache } from 'react';
import { selectedCity } from '@/lib/location';
import { activeOffers, readCityCatalog, readAllCatalogGroups } from '@/lib/catalog-files';
import type { CatalogGroup, FlavorVariant } from '@canrush/shared';
import type { QueryResultRow } from 'pg';
import { getPool } from '@/db/pool';

interface FavoriteRow extends QueryResultRow {
  brand: string;
  flavor: string;
}

export const loadCatalogSnapshot = cache(async () => {
  const city = await selectedCity();
  const data = await readCityCatalog(city.id);
  const generatedAt = data?.generatedAt && Number.isFinite(Date.parse(data.generatedAt)) ? data.generatedAt : null;
  const status = data?.status === 'stale' || (generatedAt && Date.now() - Date.parse(generatedAt) > 24 * 60 * 60 * 1000) ? 'stale' : data?.status ?? (generatedAt ? 'ok' : 'unavailable');
  const covers = new Map((await readAllCatalogGroups()).filter(group => isResolvedFlavor(group.flavor)).map(group => [JSON.stringify([group.brand, group.flavor]), group.coverImageUrl]));
  const groups = activeOffers(data?.groups ?? []).map(group => ({ ...group, coverImageUrl: isResolvedFlavor(group.flavor) ? covers.get(JSON.stringify([group.brand, group.flavor])) ?? group.coverImageUrl : group.coverImageUrl }));
  return { city, groups, generatedAt, status };
});
export async function loadCatalogGroups(): Promise<CatalogGroup[]> { return (await loadCatalogSnapshot()).groups; }
export const loadAllCatalogGroups = cache(readAllCatalogGroups);

function groupKey(brand: string, flavor: string): string {
  return `${brand}\u0000${flavor}`;
}

export async function getCatalogGroup(brand: string, flavor: string): Promise<CatalogGroup | null> {
  const groups = await loadCatalogGroups();
  const local = groups.find(group => group.brand === brand && group.flavor === flavor);
  if (local) return local;
  const identity = (await loadAllCatalogGroups()).find(group => group.brand === brand && group.flavor === flavor);
  if (identity) return { ...identity, variants: [], minPrice: 0 };
  if (flavor === 'unknown' && (await getPool().query('select 1 from review where brand=$1 and flavor=$2 limit 1', [brand, flavor])).rowCount) return { brand, flavor, variants: [], minPrice: 0 };
  return null;
}

export async function isFavorite(userId: string, brand: string, flavor: string): Promise<boolean> {
  const result = await getPool().query(
    `select 1 from "favorite" where "userId" = $1 and "brand" = $2 and "flavor" = $3 limit 1`,
    [userId, brand, flavor],
  );
  return result.rowCount === 1;
}

export async function getFavoriteGroups(userId: string): Promise<CatalogGroup[]> {
  const [favorites, groups] = await Promise.all([
    getPool().query<FavoriteRow>(
      `select "brand", "flavor" from "favorite" where "userId" = $1 order by "createdAt" desc`,
      [userId],
    ),
    loadCatalogGroups(),
  ]);
  const groupsByKey = new Map((await loadAllCatalogGroups()).map(group => [groupKey(group.brand, group.flavor), { ...group, variants: [] as FlavorVariant[], minPrice: 0 }]));
  for (const group of groups) groupsByKey.set(groupKey(group.brand, group.flavor), group);
  return favorites.rows
    .map((favorite) => groupsByKey.get(groupKey(favorite.brand, favorite.flavor)))
    .filter((group): group is CatalogGroup => Boolean(group));
}

export function cheapestVariant(group: CatalogGroup): FlavorVariant | undefined {
  return group.variants.reduce<FlavorVariant | undefined>(
    (cheapest, variant) => (!cheapest || variant.price < cheapest.price ? variant : cheapest),
    undefined,
  );
}
