import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { CITIES, DEFAULT_CITY, canonicalProductFlavor, isResolvedFlavor, type CatalogGroup, type CityId } from '@canrush/shared';
export interface CatalogFile { groups?: CatalogGroup[]; generatedAt?: string | null; cityId?: CityId; status?: 'ok' | 'stale' | 'unavailable' }
const cache = new Map<string, { stamp: string; data: CatalogFile }>();
const pending = new Map<string, Promise<CatalogFile | null>>();
/** Reuse parsed snapshots across requests, but notice atomic parser replacements immediately. */
export async function readCatalogFile(relative: string): Promise<CatalogFile | null> {
  const filename = path.join(process.cwd(), 'data', relative);
  const current = pending.get(filename); if (current) return current;
  const read = (async () => {
    try {
      const metadata = await stat(filename);
      const stamp = `${metadata.ino}:${metadata.mtimeMs}:${metadata.size}`;
      if (cache.get(filename)?.stamp === stamp) return cache.get(filename)!.data;
      const data = JSON.parse(await readFile(filename, 'utf8')) as CatalogFile;
      if (data.groups) data.groups = mergeCatalogAliases(data.groups);
      cache.set(filename, { stamp, data }); return data;
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; cache.delete(filename); return null; }
  })().finally(() => pending.delete(filename));
  pending.set(filename, read); return read;
}
export function activeOffers(groups: CatalogGroup[], now = Date.now()): CatalogGroup[] {
  return groups.flatMap(group => {
    const variants = group.variants.filter(offer => offer.price > 0 && Number.isFinite(offer.price) && (!offer.promoEndsAt || Date.parse(offer.promoEndsAt) > now));
    return variants.length ? [{ ...group, variants, minPrice: Math.min(...variants.map(offer => offer.price)) }] : [];
  });
}
export async function readCityCatalog(cityId: CityId) {
  const regional = await readCatalogFile(`regions/${cityId}.json`);
  if (regional?.cityId === cityId) return regional;
  if (cityId !== DEFAULT_CITY.id) return null;
  const legacy = await readCatalogFile('catalog.json');
  if (!legacy) return null;
  // Only geographically verifiable offers are eligible for migration from the old Moscow slice.
  const groups = (legacy.groups ?? []).flatMap(group => {
    const variants = group.variants.filter(offer => {
      try { const url = new URL(offer.url); return offer.source === 'edadeal' && url.hostname === 'edadeal.ru' && url.pathname.startsWith('/moskva/'); } catch { return false; }
    });
    return variants.length ? [{ ...group, variants, minPrice: Math.min(...variants.map(offer => offer.price)) }] : [];
  });
  return { ...legacy, groups, cityId };
}
/** Shared product identities stay available for reviews/tierlists, independently of local stock. */
export async function readAllCatalogGroups(): Promise<CatalogGroup[]> {
  const files = await Promise.all([readCatalogFile('catalog.json'), ...CITIES.map(city => readCatalogFile(`regions/${city.id}.json`))]);
  const groups = new Map<string, CatalogGroup>();
  for (const file of files) for (const group of file?.groups ?? []) {
    const key = JSON.stringify([group.brand, group.flavor]);
    const previous = groups.get(key);
    if (!previous) groups.set(key, group);
    else if (!previous.coverImageUrl && group.coverImageUrl) groups.set(key, { ...previous, coverImageUrl: group.coverImageUrl });
  }
  const archive = await readCatalogFile('product-registry.json');
  for (const group of archive?.groups ?? []) {
    const key = JSON.stringify([group.brand, group.flavor]);
    const current = groups.get(key);
    if (!current) groups.set(key, { ...group, variants: [], minPrice: 0 });
    else if (!current.coverImageUrl && group.coverImageUrl) groups.set(key, { ...current, coverImageUrl: group.coverImageUrl });
  }
  return [...groups.values()];
}

/** Merge only verified aliases within a single city snapshot; never mix regional offers. */
export function mergeCatalogAliases(groups: CatalogGroup[]): CatalogGroup[] {
  const merged = new Map<string, CatalogGroup>();
  for (const group of groups) {
    const flavor = canonicalProductFlavor(group.brand, group.flavor);
    const key = JSON.stringify([group.brand, flavor]);
    const previous = merged.get(key);
    const variants = [...(previous?.variants ?? []), ...group.variants];
    const unique = [...new Map(variants.map(offer => [JSON.stringify([offer.source, offer.retailer, offer.volumeMl, offer.url]), offer])).values()];
    merged.set(key, {
      ...group, flavor, variants: unique,
      coverImageUrl: previous?.coverImageUrl || group.coverImageUrl,
      minPrice: unique.length ? Math.min(...unique.map(offer => offer.price)) : 0,
    });
  }
  return [...merged.values()];
}

/** Picker uses current regional identities; archive is only for existing placements. */
export async function readTierPickerGroups(): Promise<CatalogGroup[]> {
  const files = await Promise.all(CITIES.map(city => readCityCatalog(city.id)));
  return mergeCatalogAliases(files.flatMap(file => file?.groups ?? []))
    .filter(group => {
      const brand = group.brand.trim();
      return brand.length > 0 && brand.toLowerCase() !== 'unknown'
        && isResolvedFlavor(group.flavor) && group.variants.length > 0;
    });
}
