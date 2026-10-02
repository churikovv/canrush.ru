import { createHash } from 'node:crypto';
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import axios from 'axios';
import type { CatalogGroup, Product } from '@canrush/shared';
import { DEFAULT_USER_AGENT, delay } from './http.js';
import { writeAtomic } from './atomic-file.js';
import { saveSiteCatalog } from './storage.js';

// apps/parser/src/images.ts -> apps/site/public/images/products
const IMAGES_DIR = path.resolve(import.meta.dirname, '../../site/public/images/products');
const LOCAL_URL_PREFIX = '/images/products/';

/** Пауза между скачиваниями, чтобы не нагружать CDN источника. */
const DOWNLOAD_DELAY_MS = 200;

function imageFilename(url: string): string {
  const hash = createHash('sha256').update(url).digest('hex').slice(0, 16);
  return `${hash}.jpg`;
}

function localFilePath(filename: string): string {
  return path.join(IMAGES_DIR, filename);
}

function localUrl(filename: string): string {
  return `${LOCAL_URL_PREFIX}${filename}`;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Скачивает изображение по URL в локальный кэш, если его ещё нет.
 * Возвращает локальный путь вида `/images/products/<hash>.jpg` или
 * `undefined`, если скачать не удалось.
 */
const CACHE_DIR = path.resolve(import.meta.dirname, '../../../data/image-cache');
const inFlight = new Map<string, Promise<string | undefined>>();
async function cachedImage(url: string): Promise<string | undefined> {
  const legacy = imageFilename(url);
  try { if ((await stat(localFilePath(legacy))).size > 0) return localUrl(legacy); } catch { /* Not cached yet. */ }
  try {
    const entry = JSON.parse(await readFile(path.join(CACHE_DIR, `${legacy}.json`), 'utf8')) as { filename?: string };
    if (entry.filename && /^[a-f0-9]{64}\.(jpg|png|webp|gif)$/.test(entry.filename) && (await stat(localFilePath(entry.filename))).size > 0) return localUrl(entry.filename);
  } catch { /* Missing metadata or asset is repaired on the next request. */ }
  return undefined;
}
async function fetchImage(url: string): Promise<string | undefined> {
  const cached = await cachedImage(url);
  if (cached) return cached;
  const cachePath = path.join(CACHE_DIR, `${imageFilename(url)}.json`);
  try {
    const entry = JSON.parse(await readFile(cachePath, 'utf8')) as { failedAt?: number };
    if (entry.failedAt && Date.now() - entry.failedAt < 60 * 60 * 1000) return undefined;
  } catch { /* First request. */ }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return undefined;
    const response = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer', timeout: 15_000, maxContentLength: 8 * 1024 * 1024,
      headers: { 'User-Agent': DEFAULT_USER_AGENT, Accept: 'image/*' },
    });
    const type = String(response.headers['content-type'] ?? '').split(';')[0]!;
    const extension = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' } as Record<string, string>)[type];
    const bytes = Buffer.from(response.data);
    if (!extension || bytes.length < 100) throw new Error('Invalid image');
    const filename = `${createHash('sha256').update(bytes).digest('hex')}.${extension}`;
    if (!await fileExists(localFilePath(filename))) await writeAtomic(localFilePath(filename), bytes);
    await writeAtomic(cachePath, JSON.stringify({ filename }));
    return localUrl(filename);
  } catch {
    await writeAtomic(cachePath, JSON.stringify({ failedAt: Date.now() }));
    console.warn('[images] изображение недоступно, повторная попытка не раньше чем через час');
    return undefined;
  }
}
export function downloadImage(url: string): Promise<string | undefined> {
  const pending = inFlight.get(url);
  if (pending) return pending;
  const request = fetchImage(url).finally(() => inFlight.delete(url));
  inFlight.set(url, request);
  return request;
}

/** Заменяет remote imageUrl на локальный путь в одном товаре. */
function applyLocalImage(product: Product, urlMap: Map<string, string>): Product {
  if (!product.imageUrl) return product;
  const local = urlMap.get(product.imageUrl);
  return local ? { ...product, imageUrl: local } : product;
}

/** Заменяет remote URL на локальные пути во всех товарах и группах. */
export function applyLocalImages(
  data: { products: Product[]; groups: CatalogGroup[] },
  urlMap: Map<string, string>,
): { products: Product[]; groups: CatalogGroup[] } {
  const products = data.products.map((p) => applyLocalImage(p, urlMap));

  const groups = data.groups.map((group) => {
    const coverLocal = group.coverImageUrl ? urlMap.get(group.coverImageUrl) : undefined;
    return {
      ...group,
      coverImageUrl: coverLocal ?? group.coverImageUrl,
      variants: group.variants.map((v) => {
        if (!v.imageUrl) return v;
        const local = urlMap.get(v.imageUrl);
        return local ? { ...v, imageUrl: local } : v;
      }),
    };
  });

  return { products, groups };
}

/**
 * Скачивает все уникальные изображения из списка товаров в локальный кэш.
 * Уже существующие файлы пропускаются. Возвращает карту remote URL → локальный путь.
 */
export interface ImageDownloadProgress {
  processed: number;
  total: number;
  downloaded: number;
  skipped: number;
  failed: number;
}

export async function downloadProductImages(
  products: Product[],
  onProgress?: (progress: ImageDownloadProgress) => void,
): Promise<Map<string, string>> {
  const uniqueUrls = [...new Set(products.map((p) => p.imageUrl).filter((u): u is string => Boolean(u)))];
  const urlMap = new Map<string, string>();

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < uniqueUrls.length; i++) {
    const url = uniqueUrls[i]!;
    const isLocal = url.startsWith(LOCAL_URL_PREFIX);
    const filename = isLocal ? url.slice(LOCAL_URL_PREFIX.length) : imageFilename(url);
    const cached = isLocal ? (await fileExists(localFilePath(filename)) ? url : undefined) : await cachedImage(url);
    const exists = Boolean(cached);
    let local: string | undefined;

    if (exists) {
      local = cached;
      skipped++;
    } else if (isLocal) {
      failed++;
    } else {
      local = await downloadImage(url);
      if (local) downloaded++;
      else failed++;
    }

    if (local) urlMap.set(url, local);
    onProgress?.({
      processed: i + 1,
      total: uniqueUrls.length,
      downloaded,
      skipped,
      failed,
    });

    if (!exists && !isLocal && i < uniqueUrls.length - 1) {
      await delay(DOWNLOAD_DELAY_MS);
    }
  }

  return urlMap;
}

/** Читает data/latest.json и возвращает распарсенный объект. */
export async function loadLatestData(): Promise<{ products: Product[]; groups: CatalogGroup[] }> {
  const dataDir = path.resolve(import.meta.dirname, '../../../data');
  const raw = await readFile(path.join(dataDir, 'latest.json'), 'utf-8');
  const parsed = JSON.parse(raw) as { products?: Product[]; groups?: CatalogGroup[] };
  return {
    products: parsed.products ?? [],
    groups: parsed.groups ?? [],
  };
}

/** Перезаписывает data/latest.json с обновлёнными imageUrl. */
export async function saveLatestData(data: {
  products: Product[];
  groups: CatalogGroup[];
  generatedAt?: string;
  count?: number;
}): Promise<void> {
  const dataDir = path.resolve(import.meta.dirname, '../../../data');
  const filePath = path.join(dataDir, 'latest.json');
  const generatedAt = data.generatedAt ?? new Date().toISOString();
  await mkdir(dataDir, { recursive: true });
  await Promise.all([
    writeFile(
      filePath,
      JSON.stringify(
        {
          generatedAt,
          count: data.products.length,
          products: data.products,
          groups: data.groups,
        },
        null,
        2,
      ),
      'utf-8',
    ),
    saveSiteCatalog(data.groups, generatedAt),
  ]);
}
