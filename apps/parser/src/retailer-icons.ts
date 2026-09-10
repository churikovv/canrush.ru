import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import axios from 'axios';
import type { Product } from '@canrush/shared';
import { DEFAULT_USER_AGENT, delay } from './http.js';

// apps/parser/src/retailer-icons.ts -> apps/site/public/brand/retailers
const ICONS_DIR = path.resolve(import.meta.dirname, '../../site/public/brand/retailers');
const MANIFEST_PATH = path.resolve(import.meta.dirname, '../../site/data/retailer-icons.json');
const LOCAL_ICON_PREFIX = '/brand/retailers/';

/** Пауза между скачиваниями, чтобы не нагружать сервис favicon. */
const DOWNLOAD_DELAY_MS = 300;

/**
 * Сети, у которых уже есть готовые SVG/PNG-иконки в public/brand/retailers/.
 * Их favicon не скачиваем — используем существующие.
 */
const HANDCRAFTED_RETAILERS = new Set([
  'pyaterochka',
  'perekrestok',
  'magnit',
  'lenta',
  'dixy',
]);

/**
 * Маппинг имени сети (или его части) на домен сайта для скачивания favicon.
 * Проверка идёт по включению подстроки (как в retailerAsset у сайта).
 * Дополняйте по мере появления новых сетей в выдаче Едадила.
 */
const RETAILER_DOMAINS: Array<{ match: string; domain: string }> = [
  { match: 'пятероч', domain: 'pyaterochka.ru' },
  { match: 'перекрест', domain: 'perekrestok.ru' },
  { match: 'магнит', domain: 'magnit.ru' },
  { match: 'лента', domain: 'lenta.com' },
  { match: 'дикси', domain: 'dixy.ru' },
  { match: 'бристол', domain: 'bristol.ru' },
  { match: 'metro', domain: 'metro-cc.ru' },
  { match: 'ашан', domain: 'auchan.ru' },
  { match: 'верный', domain: 'vernyy.ru' },
  { match: 'светофор', domain: 'svetofor-online.ru' },
  { match: 'монетка', domain: 'monetka.ru' },
  { match: 'карусел', domain: 'karusel.ru' },
  { match: 'покупоч', domain: 'pokupochka.ru' },
  { match: "o'key", domain: 'okey.ru' },
  { match: 'окей', domain: 'okey.ru' },
  { match: 'prisma', domain: 'prisma-market.ru' },
  { match: 'спар', domain: 'spar.ru' },
  { match: 'spar', domain: 'spar.ru' },
  { match: 'полушк', domain: 'polushka.ru' },
  { match: 'ермак', domain: 'ermak.ru' },
  { match: 'авоськ', domain: 'avoska.ru' },
  { match: 'десяточ', domain: 'desyatochka.ru' },
  { match: 'гулливер', domain: 'gulliver.ru' },
  { match: 'утконос', domain: 'utkonos.ru' },
  { match: 'вкусвилл', domain: 'vkusvill.ru' },
  { match: 'радеж', domain: 'radezh.ru' },
  { match: 'макс', domain: 'max.ru' },
  { match: 'мария-ра', domain: 'maria-ra.ru' },
  { match: 'мария ра', domain: 'maria-ra.ru' },
  { match: 'чижик', domain: 'chizhik.ru' },
  { match: 'самокат', domain: 'samokat.ru' },
  { match: 'пятёрочка', domain: 'pyaterochka.ru' },
];

/**
 * Определяет домен сайта сети по её имени.
 * Возвращает undefined, если сеть не известна — favicon не скачивается.
 */
export function resolveRetailerDomain(name: string): string | undefined {
  const normalized = name.toLocaleLowerCase('ru-RU').replace(/ё/gu, 'е');
  for (const { match, domain } of RETAILER_DOMAINS) {
    if (normalized.includes(match)) return domain;
  }
  return undefined;
}

/**
 * Превращает имя сети в slug для имени файла иконки.
 * Например, «Бристоль» → «bristol», «Metro» → «metro».
 */
export function retailerSlug(name: string): string {
  const normalized = name
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/gu, 'е')
    .replace(/[^a-zа-я0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'unknown';
}

/**
 * Имена файлов-иконок, которые уже есть в public/brand/retailers/ и
 * сделаны вручную (SVG/PNG хорошего качества). Их не нужно скачивать.
 */
function isHandcrafted(slug: string): boolean {
  return HANDCRAFTED_RETAILERS.has(slug);
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
 * Скачивает favicon сети через Google S2 и сохраняет в public/brand/retailers/.
 * Возвращает локальный путь вида /brand/retailers/{slug}.png или undefined.
 */
async function downloadFavicon(slug: string, domain: string): Promise<string | undefined> {
  const filename = `${slug}.png`;
  const filePath = path.join(ICONS_DIR, filename);
  const localUrl = `${LOCAL_ICON_PREFIX}${filename}`;

  if (await fileExists(filePath)) return localUrl;

  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  try {
    const response = await axios.get(faviconUrl, {
      responseType: 'arraybuffer',
      timeout: 10_000,
      headers: { 'User-Agent': DEFAULT_USER_AGENT, Accept: 'image/*,*/*;q=0.8' },
    });
    const buffer = Buffer.from(response.data);
    if (buffer.length < 100) return undefined;
    await mkdir(ICONS_DIR, { recursive: true });
    await writeFile(filePath, buffer);
    return localUrl;
  } catch (err) {
    console.warn(`[retailer-icons] не удалось скачать favicon для ${domain}: ${(err as Error).message}`);
    return undefined;
  }
}

export interface RetailerIconManifest {
  [retailerName: string]: string;
}

/** Читает существующий манифест retailer-icons.json (пустой объект, если нет). */
export async function loadRetailerIconManifest(): Promise<RetailerIconManifest> {
  try {
    const raw = await readFile(MANIFEST_PATH, 'utf-8');
    return JSON.parse(raw) as RetailerIconManifest;
  } catch {
    return {};
  }
}

/** Сохраняет манифест retailer-icons.json. */
async function saveRetailerIconManifest(manifest: RetailerIconManifest): Promise<void> {
  await mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
}

export interface RetailerIconProgress {
  processed: number;
  total: number;
  downloaded: number;
  skipped: number;
  failed: number;
}

/**
 * Собирает уникальные имена сетей из списка товаров и скачивает favicon
 * для тех, у которых ещё нет локальной иконки (ни ручной, ни скачанной).
 * Обновляет манифест retailer-icons.json.
 */
export async function downloadRetailerIcons(
  products: Product[],
  onProgress?: (progress: RetailerIconProgress) => void,
): Promise<RetailerIconManifest> {
  const retailerNames = [...new Set(products.map((p) => p.retailer).filter((r): r is string => Boolean(r)))];
  const manifest = await loadRetailerIconManifest();

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  let first = true;

  for (let i = 0; i < retailerNames.length; i++) {
    const name = retailerNames[i]!;
    const slug = retailerSlug(name);

    onProgress?.({ processed: i, total: retailerNames.length, downloaded, skipped, failed });

    // Уже есть в манифесте или ручная иконка — пропускаем
    if (manifest[name] || isHandcrafted(slug)) {
      skipped++;
      continue;
    }

    const domain = resolveRetailerDomain(name);
    if (!domain) {
      skipped++;
      continue;
    }

    if (!first) await delay(DOWNLOAD_DELAY_MS);
    first = false;

    const localUrl = await downloadFavicon(slug, domain);
    if (localUrl) {
      manifest[name] = localUrl;
      downloaded++;
    } else {
      failed++;
    }
  }

  onProgress?.({ processed: retailerNames.length, total: retailerNames.length, downloaded, skipped, failed });
  await saveRetailerIconManifest(manifest);
  return manifest;
}
