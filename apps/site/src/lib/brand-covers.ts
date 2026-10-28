import { cache } from 'react';
import { getPool } from '@/db/pool';
import type { CatalogGroup } from '@canrush/shared';

/** The public address of a brand's drink photo; the version in the path busts the year-long cache on a new photo. */
export const brandPhotoUrl = (id: string, updatedAt: Date) => `/api/brand-drink-photos/${id}/${updatedAt.getTime()}`;

/** Covers the brands gave (`brandDrinkProfile`, approved edits): one cheap query per request, no photo bytes. */
const brandCovers = cache(async () => new Map((await getPool().query<{ id: string; brand: string; flavor: string; updatedAt: Date }>(
  `select id, brand, flavor, "updatedAt" from "brandDrinkProfile" where photo is not null`)).rows.map(row => [JSON.stringify([row.brand, row.flavor]), brandPhotoUrl(row.id, row.updatedAt)])));

/** The catalog with brand photos over the parser's and members' covers; the database being away leaves it as is. */
export async function withBrandCovers(groups: CatalogGroup[]): Promise<CatalogGroup[]> {
  const covers = await brandCovers().catch(() => new Map<string, string>());
  if (!covers.size) return groups;
  return groups.map(group => { const cover = covers.get(JSON.stringify([group.brand, group.flavor])); return cover ? { ...group, coverImageUrl: cover } : group; });
}
