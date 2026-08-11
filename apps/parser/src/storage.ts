import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AdapterRunResult, Product } from '@canrush/shared';
import { dedupeProducts } from './normalize.js';

// apps/parser/src/storage.ts -> repo root /data
const DATA_DIR = path.resolve(import.meta.dirname, '../../../data');

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

/** Сохраняет сырой результат запуска одного адаптера в data/raw/<source>/<timestamp>.json */
export async function saveRawSnapshot(result: AdapterRunResult): Promise<string> {
  const timestamp = result.finishedAt.replace(/[:.]/g, '-');
  const filePath = path.join(DATA_DIR, 'raw', result.source, `${timestamp}.json`);
  await writeJson(filePath, result);
  return filePath;
}

/** Перезаписывает консолидированный срез всех источников для использования на сайте. */
export async function saveLatest(products: Product[]): Promise<string> {
  const filePath = path.join(DATA_DIR, 'latest.json');
  await writeJson(filePath, {
    generatedAt: new Date().toISOString(),
    count: products.length,
    products,
  });
  return filePath;
}

/** Дописывает/перезаписывает историю цен за текущий день (data/history/<YYYY-MM-DD>.json). */
export async function saveHistorySnapshot(
  products: Product[],
  date: Date = new Date(),
): Promise<string> {
  const filePath = path.join(DATA_DIR, 'history', `${todayIso(date)}.json`);
  await writeJson(filePath, {
    date: todayIso(date),
    count: products.length,
    products,
  });
  return filePath;
}

export { DATA_DIR };
