import { archiveProducts } from './product-registry.js';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AdapterRunResult, CatalogGroup, FlavorVariant, Product } from '@canrush/shared';
import { isMixedBurnOffer } from '@canrush/shared';
import { dedupeProducts } from './normalize.js';

// apps/parser/src/storage.ts -> repo root /data
const DATA_DIR = path.resolve(import.meta.dirname, '../../../data');
const SITE_CATALOG_PATH = path.resolve(import.meta.dirname, '../../site/data/catalog.json');

function todayIso(date: Date): string {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/** Читает товары из текущего data/latest.json (пустой массив, если файла ещё нет). */
export async function loadLatestProducts(): Promise<Product[]> {
  try {
    const raw = await readFile(path.join(DATA_DIR, 'latest.json'), 'utf-8');
    const parsed = JSON.parse(raw) as { products?: Product[] };
    return parsed.products ?? [];
  } catch {
    return [];
  }
}

/**
 * Чистая логика слияния (без файловой системы, легко покрывается unit-тестами):
 * - источники со статусом "ok" — берём свежие товары как есть;
 * - источники, недоступные в этом прогоне ("stale"/"blocked"/"error") — переносим
 *   их товары из previousProducts с флагом stale=true, чтобы сайт не остался без
 *   данных из-за временной блокировки/капчи источника.
 */
export function mergeResults(results: AdapterRunResult[], previousProducts: Product[]): Product[] {
  const previousBySource = new Map<string, Product[]>();
  for (const product of previousProducts) {
    const list = previousBySource.get(product.source) ?? [];
    list.push(product);
    previousBySource.set(product.source, list);
  }

  const merged: Product[] = [];
  for (const result of results) {
    if (result.status === 'ok') {
      merged.push(...result.products);
      continue;
    }
    const staleProducts = (previousBySource.get(result.source) ?? []).map((product) => ({
      ...product,
      stale: true,
      lastSeenAt: product.lastSeenAt ?? product.fetchedAt,
    }));
    merged.push(...staleProducts);
  }
  return dedupeProducts(merged);
}

/** Читает предыдущий data/latest.json и применяет к нему mergeResults. */
export async function mergeWithPrevious(results: AdapterRunResult[]): Promise<Product[]> {
  const previous = await loadLatestProducts();
  return mergeResults(results, previous);
}

/**
 * Группирует плоский список товаров в карточки каталога по паре (бренд, вкус).
 * Товары без определённого бренда попадают в 'Unknown', без определённого вкуса — в 'unknown'.
 * Внутри каждой группы — список вариантов (по источникам/объёмам) с ценами.
 */
export function groupByFlavor(products: Product[]): CatalogGroup[] {
  const groups = new Map<string, CatalogGroup>();

  for (const product of products) {
    if (isMixedBurnOffer(product.brand, product.name)) continue;
    const brand = product.brand ?? 'Unknown';
    const flavor = product.flavor && product.flavor !== 'unknown' ? product.flavor : `unresolved:${createHash('sha256').update(JSON.stringify([product.source, product.sourceId, product.name])).digest('hex').slice(0, 24)}`;
    const key = JSON.stringify([brand, flavor]);

    const variant: FlavorVariant = {
      source: product.source,
      retailer: product.retailer,
      volumeMl: product.volumeMl,
      price: product.price,
      oldPrice: product.oldPrice,
      url: product.url,
      imageUrl: product.imageUrl,
      promoEndsAt: product.promoEndsAt,
      stale: product.stale,
      fetchedAt: product.fetchedAt,
    };

    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        brand,
        flavor,
        variants: [variant],
        minPrice: variant.price,
        coverImageUrl: variant.imageUrl,
      });
    } else {
      existing.variants.push(variant);
      if (variant.price < existing.minPrice) {
        existing.minPrice = variant.price;
      }
      if (!existing.coverImageUrl && variant.imageUrl) {
        existing.coverImageUrl = variant.imageUrl;
      }
    }
  }

  return [...groups.values()];
}

/**
 * Пороговое отношение цены к медиане группы, ниже которого вариант считается
 * подозрительно дешёвым и удаляется. Например 0.5 — цена ниже половины медианы.
 */
const SUSPICIOUS_PRICE_RATIO = 0.5;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/**
 * Удаляет из каждой группы варианты с ценой ниже SUSPICIOUS_PRICE_RATIO от медианы
 * цен группы. Пересчитывает minPrice и убирает группы, оставшиеся без вариантов.
 * Группы с одним вариантом не фильтруются (медиана = цена единственного варианта).
 */
export function filterSuspiciousVariants(groups: CatalogGroup[]): CatalogGroup[] {
  const result: CatalogGroup[] = [];
  for (const group of groups) {
    if (group.variants.length <= 1) {
      result.push(group);
      continue;
    }
    const med = median(group.variants.map((v) => v.price));
    const threshold = med * SUSPICIOUS_PRICE_RATIO;
    const kept = group.variants.filter((v) => v.price >= threshold);
    if (kept.length === 0) {
      result.push(group);
      continue;
    }
    if (kept.length === group.variants.length) {
      result.push(group);
      continue;
    }
    const minPrice = kept.reduce((min, v) => (v.price < min ? v.price : min), kept[0]!.price);
    result.push({ ...group, variants: kept, minPrice });
  }
  return result;
}

/** Сохраняет сырой результат запуска одного адаптера в data/raw/<source>/<timestamp>.json */
export async function saveRawSnapshot(result: AdapterRunResult): Promise<string> {
  const timestamp = result.finishedAt.replace(/[:.]/g, '-');
  const filePath = path.join(DATA_DIR, 'raw', result.source, `${timestamp}.json`);
  await writeJson(filePath, result);
  return filePath;
}

export async function saveSiteCatalog(groups: CatalogGroup[], generatedAt: string = new Date().toISOString()): Promise<string> {
  let previous: CatalogGroup[] = [];
  try { previous = (JSON.parse(await readFile(SITE_CATALOG_PATH, 'utf8')) as { groups?: CatalogGroup[] }).groups ?? []; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  await archiveProducts([...previous, ...groups]);
  await writeJson(SITE_CATALOG_PATH, {
    generatedAt,
    count: groups.length,
    groups,
  });
  return SITE_CATALOG_PATH;
}

/** Перезаписывает консолидированный срез всех источников для использования на сайте. */
export async function saveLatest(products: Product[]): Promise<string> {
  const filePath = path.join(DATA_DIR, 'latest.json');
  const generatedAt = new Date().toISOString();
  const groups = filterSuspiciousVariants(groupByFlavor(products));
  await Promise.all([
    writeJson(filePath, {
      generatedAt,
      count: products.length,
      products,
      groups,
    }),
    saveSiteCatalog(groups, generatedAt),
  ]);
  return filePath;
}

/** Дописывает/перезаписывает историю цен за текущий день (data/history/<YYYY-MM-DD>.json). */
export async function saveHistorySnapshot(
  products: Product[],
  date: Date = new Date(),
): Promise<string> {
  const filePath = path.join(DATA_DIR, 'history', `${todayIso(date)}.json`);
  const groups = filterSuspiciousVariants(groupByFlavor(products));
  await writeJson(filePath, {
    date: todayIso(date),
    count: products.length,
    products,
    groups,
  });
  return filePath;
}

export { DATA_DIR };
