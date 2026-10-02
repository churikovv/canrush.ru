import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import axios from 'axios';
import type { Product } from '@canrush/shared';
import { DEFAULT_USER_AGENT, delay } from './http.js';

// apps/parser/src/retailer-icons.ts -> apps/site/public, apps/site/data
const SITE_PUBLIC_DIR = path.resolve(import.meta.dirname, '../../site/public');
// public/images — общий с сайтом volume в docker-compose, туда же кладутся фото товаров.
const ICONS_DIR = path.join(SITE_PUBLIC_DIR, 'images/retailers');
const LOCAL_ICON_PREFIX = '/images/retailers/';
const LEGACY_ICON_PREFIX = '/brand/retailers/';
const MANIFEST_PATH = path.resolve(import.meta.dirname, '../../site/data/retailer-icons.json');

/** Пауза между скачиваниями, чтобы не нагружать CDN Едадила и сервис favicon. */
const DOWNLOAD_DELAY_MS = 300;
const MAX_ICON_BYTES = 256 * 1024;
const TILE_HOST = 'leonardo.edadeal.io';
const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

/**
 * Маппинг имени сети (или его части) на домен сайта для скачивания favicon.
 * Используется только как запасной вариант, если Едадил не прислал логотип сети.
 * Проверка идёт по включению подстроки (как в retailerAsset у сайта).
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
 * Например, «Бристоль» → «бристоль», «Metro» → «metro».
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
 * Иконка сети для сайта. `tile` — квадратный логотип Едадила с собственным фоном,
 * сайт показывает его на всю плашку; иначе это favicon на нейтральном фоне.
 */
export interface RetailerIcon {
  src: string;
  tile: boolean;
}

export type RetailerIconManifest = Record<string, RetailerIcon>;

/** Принимает только https-логотипы с CDN Едадила. */
export function isTrustedTileUrl(url: string | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === TILE_HOST;
  } catch {
    return false;
  }
}

/** Уникальные сети из товаров и первый надёжный логотип каждой из них. */
export function collectRetailers(products: Product[]): Map<string, string | undefined> {
  const retailers = new Map<string, string | undefined>();
  for (const { retailer, retailerIconUrl } of products) {
    if (!retailer) continue;
    const tile = isTrustedTileUrl(retailerIconUrl) ? retailerIconUrl : undefined;
    if (!retailers.has(retailer) || (tile && !retailers.get(retailer))) retailers.set(retailer, tile);
  }
  return retailers;
}

/** Приводит манифест к текущему формату; старые записи-строки — это favicon. */
export function normalizeRetailerIconManifest(raw: unknown): RetailerIconManifest {
  const manifest: RetailerIconManifest = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return manifest;
  for (const [name, value] of Object.entries(raw)) {
    if (typeof value === 'string') manifest[name] = { src: value, tile: false };
    else if (value && typeof value === 'object' && typeof (value as RetailerIcon).src === 'string') {
      manifest[name] = { src: (value as RetailerIcon).src, tile: (value as RetailerIcon).tile === true };
    }
  }
  return manifest;
}

/** Нужно ли (пере)скачать иконку: её нет, файл пропал или вместо favicon появился логотип. */
export function needsRetailerIcon(entry: RetailerIcon | undefined, tileUrl: string | undefined, fileAvailable: boolean): boolean {
  if (!entry || !fileAvailable) return true;
  return Boolean(tileUrl) && !entry.tile;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function iconFileExists(src: string): Promise<boolean> {
  if (src.includes('..') || !(src.startsWith(LOCAL_ICON_PREFIX) || src.startsWith(LEGACY_ICON_PREFIX))) return false;
  return fileExists(path.join(SITE_PUBLIC_DIR, src));
}

/**
 * Скачивает картинку в public/images/retailers/{basename}.{ext}.
 * Принимает только PNG/JPEG/WebP до 256 КБ. Возвращает локальный путь или undefined.
 */
async function downloadIcon(url: string, basename: string): Promise<string | undefined> {
  try {
    const response = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      timeout: 10_000,
      maxContentLength: MAX_ICON_BYTES,
      headers: { 'User-Agent': DEFAULT_USER_AGENT, Accept: 'image/png,image/jpeg,image/webp;q=0.9' },
    });
    const contentType = String(response.headers['content-type'] ?? '').split(';')[0]!.trim().toLowerCase();
    const extension = IMAGE_EXTENSIONS[contentType];
    const buffer = Buffer.from(response.data);
    if (!extension || buffer.length < 100) return undefined;

    const filename = `${basename}.${extension}`;
    await mkdir(ICONS_DIR, { recursive: true });
    await writeFile(path.join(ICONS_DIR, filename), buffer);
    return `${LOCAL_ICON_PREFIX}${filename}`;
  } catch (err) {
    console.warn(`[retailer-icons] не удалось скачать ${url}: ${(err as Error).message}`);
    return undefined;
  }
}

async function downloadRetailerIcon(name: string, tileUrl: string | undefined): Promise<RetailerIcon | undefined> {
  const slug = retailerSlug(name);
  if (tileUrl) {
    const hash = createHash('sha256').update(tileUrl).digest('hex').slice(0, 8);
    const src = await downloadIcon(tileUrl, `${slug}-${hash}`);
    if (src) return { src, tile: true };
  }
  const domain = resolveRetailerDomain(name);
  if (!domain) return undefined;
  const src = await downloadIcon(`https://www.google.com/s2/favicons?domain=${domain}&sz=64`, `${slug}-favicon`);
  return src ? { src, tile: false } : undefined;
}

/** Читает существующий манифест retailer-icons.json (пустой объект, если нет). */
export async function loadRetailerIconManifest(): Promise<RetailerIconManifest> {
  try {
    return normalizeRetailerIconManifest(JSON.parse(await readFile(MANIFEST_PATH, 'utf-8')));
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
 * Собирает сети из товаров и локализует их иконки: в первую очередь логотип
 * из Едадила (retailerIconUrl), иначе favicon по домену. Старые favicon
 * заменяются логотипом, как только он появляется. Обновляет retailer-icons.json.
 */
export async function downloadRetailerIcons(
  products: Product[],
  onProgress?: (progress: RetailerIconProgress) => void,
): Promise<RetailerIconManifest> {
  const retailers = [...collectRetailers(products)];
  const manifest = await loadRetailerIconManifest();

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  let requested = false;

  for (const [index, [name, tileUrl]] of retailers.entries()) {
    onProgress?.({ processed: index, total: retailers.length, downloaded, skipped, failed });

    const entry = manifest[name];
    const fileAvailable = entry ? await iconFileExists(entry.src) : false;
    if (!needsRetailerIcon(entry, tileUrl, fileAvailable)) {
      skipped++;
      continue;
    }

    if (requested) await delay(DOWNLOAD_DELAY_MS);
    requested = true;

    const icon = await downloadRetailerIcon(name, tileUrl);
    if (icon) {
      manifest[name] = icon;
      downloaded++;
    } else {
      if (entry && !fileAvailable && entry.src.startsWith(LOCAL_ICON_PREFIX)) delete manifest[name];
      failed++;
    }
  }

  onProgress?.({ processed: retailers.length, total: retailers.length, downloaded, skipped, failed });
  await saveRetailerIconManifest(manifest);
  return manifest;
}
