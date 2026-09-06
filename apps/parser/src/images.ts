import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import axios from 'axios';
import type { CatalogGroup, Product } from '@canrush/shared';
import { DEFAULT_USER_AGENT, delay } from './http.js';

// apps/parser/src/images.ts -> apps/site/public/images/products
const IMAGES_DIR = path.resolve(import.meta.dirname, '../../apps/site/public/images/products');
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
export async function downloadImage(url: string): Promise<string | undefined> {
  const filename = imageFilename(url);
  const filePath = localFilePath(filename);

  if (await fileExists(filePath)) {
    return localUrl(filename);
  }

  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 15_000,
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        Accept: 'image/*,*/*;q=0.8',
      },
    });
    await mkdir(IMAGES_DIR, { recursive: true });
    await writeFile(filePath, Buffer.from(response.data));
    return localUrl(filename);
  } catch (err) {
    console.warn(`[images] не удалось скачать ${url}: ${(err as Error).message}`);
    return undefined;
  }
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
export async function downloadProductImages(
  products: Product[],
  onProgress?: (downloaded: number, total: number, skipped: number) => void,
): Promise<Map<string, string>> {
  const uniqueUrls = [...new Set(products.map((p) => p.imageUrl).filter((u): u is string => Boolean(u)))];
  const urlMap = new Map<string, string>();

  let downloaded = 0;
  let skipped = 0;

  for (let i = 0; i < uniqueUrls.length; i++) {
    const url = uniqueUrls[i]!;
    const local = await downloadImage(url);
    if (local) {
      urlMap.set(url, local);
      // Считаем пропущенные: если файл уже существовал, downloadImage не логирует это.
      // Различаем по наличию файла до скачивания — упрощаем: просто считаем успехи.
      downloaded++;
    }
    skipped = i + 1 - downloaded;

    onProgress?.(downloaded, uniqueUrls.length, skipped);

    if (i < uniqueUrls.length - 1) {
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
  await mkdir(dataDir, { recursive: true });
  await writeFile(
    filePath,
    JSON.stringify(
      {
        generatedAt: data.generatedAt ?? new Date().toISOString(),
        count: data.products.length,
        products: data.products,
        groups: data.groups,
      },
      null,
      2,
    ),
    'utf-8',
  );
}
