import { archiveProducts } from './product-registry.js';
import { NORMALIZATION_VERSION } from './normalize.js';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CITIES, findCity, type CityId, type CatalogGroup, type Product } from '@canrush/shared';
import { edadealAdapter } from './adapters/edadeal.js';
import { loadProductsConfig } from './config.js';
import { DATA_DIR, filterSuspiciousVariants, groupByFlavor } from './storage.js';
import { applyLocalImages, downloadProductImages } from './images.js';
import { downloadRetailerIcons } from './retailer-icons.js';
import { delay } from './http.js';
import { writeAtomic } from './atomic-file.js';

export const REGION_TTL_MS = 6 * 60 * 60 * 1000;
const RETRY_MS = 30 * 60 * 1000;
const SITE_REGIONS = path.resolve(import.meta.dirname, '../../site/data/regions');
export interface RegionSnapshot {
  cityId: CityId; generatedAt: string | null; attemptedAt: string;
  configHash: string; status: 'ok' | 'stale' | 'unavailable'; products: Product[]; groups: CatalogGroup[];
}
export function regionCacheFresh(snapshot: Pick<RegionSnapshot, 'generatedAt' | 'configHash' | 'status'> | null, hash: string, now = Date.now()) {
  if (!snapshot?.generatedAt || snapshot.configHash !== hash || snapshot.status !== 'ok') return false;
  const age = now - Date.parse(snapshot.generatedAt);
  return age >= 0 && age < REGION_TTL_MS;
}
export function parseCities(input: string): CityId[] {
  if (input === 'all') return CITIES.map(city => city.id);
  const ids = [...new Set(input.split(',').map(value => value.trim()))];
  if (!ids.length || ids.some(id => !findCity(id))) throw new Error('Укажите --cities=all или идентификаторы городов из packages/shared/src/cities.ts');
  return ids as CityId[];
}
export async function loadSnapshot(cityId: CityId): Promise<RegionSnapshot | null> {
  try { const snapshot = JSON.parse(await readFile(path.join(DATA_DIR, 'regions', cityId, 'latest.json'), 'utf8')) as RegionSnapshot; return snapshot.cityId === cityId ? snapshot : null; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}
export async function saveSnapshot(snapshot: RegionSnapshot) {
  const { products, ...catalog } = snapshot;
  const previous = await loadSnapshot(snapshot.cityId);
  await archiveProducts([...(previous?.groups ?? []), ...snapshot.groups]);
  await writeAtomic(path.join(DATA_DIR, 'regions', snapshot.cityId, 'latest.json'), JSON.stringify(snapshot));
  await writeAtomic(path.join(SITE_REGIONS, `${snapshot.cityId}.json`), JSON.stringify({ ...catalog, count: catalog.groups.length }));
  // Product history is partitioned by city; a retry on the same day replaces only that city's snapshot.
  if (snapshot.generatedAt) await writeAtomic(path.join(DATA_DIR, 'regions', snapshot.cityId, 'history', `${snapshot.generatedAt.slice(0, 10)}.json`), JSON.stringify({ ...catalog, products }));
}

export async function runRegionalParser(options: { cities?: CityId[]; force?: boolean } = {}) {
  const cities = options.cities ?? CITIES.map(city => city.id);
  if (cities.some(id => !findCity(id))) throw new Error('Unknown city');
  const lock = path.join(DATA_DIR, '.regions-lock');
  await mkdir(DATA_DIR, { recursive: true });
  try { await mkdir(lock); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    let alive = true;
    try { const pid = Number(await readFile(path.join(lock, 'pid'), 'utf8')); if (Number.isSafeInteger(pid) && pid > 0) { try { process.kill(pid, 0); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ESRCH') alive = false; } } } catch { /* Another runner may be writing its PID. */ }
    if (alive) throw new Error('Региональный парсер уже работает.');
    await rm(lock, { recursive: true }); await mkdir(lock);
  }
  await writeFile(path.join(lock, 'pid'), String(process.pid));
  try {
    const config = loadProductsConfig();
    for (const [index, cityId] of cities.entries()) {
      const city = findCity(cityId)!;
      const effective = { ...config.sources.edadeal, regionId: city.geoId, keywords: config.keywords, brands: config.brands, brandAliases: config.brandAliases, flavors: config.flavors, flavorAliases: config.flavorAliases };
      const configHash = createHash('sha256').update(JSON.stringify({ ...effective, normalizationVersion: NORMALIZATION_VERSION })).digest('hex');
      const previous = await loadSnapshot(cityId);
      const now = Date.now();
      const fresh = regionCacheFresh(previous, configHash, now);
      const backoff = previous && previous.status !== 'ok' && now - Date.parse(previous.attemptedAt) < RETRY_MS;
      if (!options.force && previous && (fresh || backoff)) {
        console.log(`[regions] ${city.name}: ${fresh ? 'кэш свежий' : 'пауза после ошибки'}, без запросов к источнику`);
        await saveSnapshot(previous); continue;
      }
      let snapshot: RegionSnapshot;
      try {
        const { products } = await edadealAdapter.fetchPrices(effective);
        const localized = applyLocalImages({ products, groups: filterSuspiciousVariants(groupByFlavor(products)) }, await downloadProductImages(products));
        await downloadRetailerIcons(products);
        snapshot = { cityId, configHash, generatedAt: new Date().toISOString(), attemptedAt: new Date().toISOString(), status: 'ok', ...localized };
        console.log(`[regions] ${city.name}: ${products.length} предложений, ${localized.groups.length} напитков`);
      } catch (error) {
        console.warn(`[regions] ${city.name}: ${(error as Error).message}`);
        const products = (previous?.products ?? []).map(product => ({ ...product, stale: true, lastSeenAt: product.lastSeenAt ?? product.fetchedAt }));
        snapshot = { cityId, configHash, generatedAt: previous?.generatedAt ?? null, attemptedAt: new Date().toISOString(), status: products.length ? 'stale' : 'unavailable', products, groups: filterSuspiciousVariants(groupByFlavor(products)) };
      }
      await saveSnapshot(snapshot);
      if (index < cities.length - 1) await delay(3000 + Math.random() * 2000);
    }
  } finally { await rm(lock, { recursive: true, force: true }); }
}
