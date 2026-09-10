import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { CatalogGroup, FlavorVariant } from '@canrush/shared';
import type { QueryResultRow } from 'pg';
import { getPool } from '@/db/pool';

interface FavoriteRow extends QueryResultRow {
  brand: string;
  flavor: string;
}

interface LatestData {
  groups?: CatalogGroup[];
}

const LATEST_DATA_PATH = path.join(process.cwd(), 'data', 'catalog.json');

export async function loadCatalogGroups(): Promise<CatalogGroup[]> {
  try {
    const raw = await readFile(LATEST_DATA_PATH, 'utf-8');
    return (JSON.parse(raw) as LatestData).groups ?? [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return [];
  }
}

function groupKey(brand: string, flavor: string): string {
  return `${brand}\u0000${flavor}`;
}

export async function getCatalogGroup(brand: string, flavor: string): Promise<CatalogGroup | null> {
  const groups = await loadCatalogGroups();
  return groups.find((group) => group.brand === brand && group.flavor === flavor) ?? null;
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
  const groupsByKey = new Map(groups.map((group) => [groupKey(group.brand, group.flavor), group]));
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
