#!/usr/bin/env node
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isAxiosError } from 'axios';
import { CITIES, isResolvedFlavor, type Product } from '@canrush/shared';
import { lavkaLocationCookie } from '../adapters/lavka.js';
import { delay, httpGet } from '../http.js';
import { isAllowedByRobots } from '../robots.js';
import { parseLavkaCard } from './lavka.js';
import { lavkaFile, nutritionKey, type LavkaSnapshot } from './publish.js';

const parserRoot = path.resolve(import.meta.dirname, '../..');
const regions = path.resolve(parserRoot, '../../data/regions');
const SITE = 'https://lavka.yandex.ru/supermarket/good/';
const BLOCK_MARKERS = /showcaptcha|smartcaptcha|Доступ к сервису временно запрещ/iu;
const CACHE_DAYS = 30;

function parseArgs(args: string[]) {
  const flags: Record<string, string> = {};
  for (const arg of args) {
    const match = /^--([a-z]+)(?:=(.*))?$/.exec(arg);
    if (!match?.[1] || !['limit', 'refresh', 'help'].includes(match[1])) throw new Error('Неизвестный аргумент. Используйте --help.');
    flags[match[1]] = match[2] ?? 'true';
  }
  return flags;
}

/** One Lavka card per catalog product (brand + resolved flavor), from the latest regional price runs. */
async function lavkaProducts() {
  const found = new Map<string, Product & { city: string }>();
  for (const city of CITIES) {
    let products: Product[] = [];
    try { products = (JSON.parse(await readFile(path.join(regions, city.id, 'latest.json'), 'utf8')) as { products: Product[] }).products; }
    catch { continue; }
    for (const product of products) {
      const { brand, flavor } = product;
      if (product.source !== 'lavka' || !brand || !flavor || !isResolvedFlavor(flavor) || !product.url.startsWith(SITE)) continue;
      const key = nutritionKey(brand, flavor);
      if (!found.has(key)) found.set(key, { ...product, city: city.id });
    }
  }
  return [...found.entries()];
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    console.log('Состав и пищевая ценность с карточек большой Яндекс Лавки (товары из последнего регионального прогона).\n[--limit=10] [--refresh]\nЗатем npm run ingredients:publish добавит их на сайт со статусом «не проверено».');
    return;
  }
  const limit = Number(flags.limit ?? 1000);
  if (!Number.isInteger(limit) || limit < 1) throw new Error('limit — целое число от 1.');
  const file = lavkaFile(parserRoot);
  let snapshot: LavkaSnapshot = { version: 1, items: {} };
  try { snapshot = JSON.parse(await readFile(file, 'utf8')) as LavkaSnapshot; } catch { /* First run. */ }
  const save = async () => {
    await mkdir(path.dirname(file), { recursive: true });
    const temp = `${file}.${process.pid}.tmp`;
    await writeFile(temp, JSON.stringify(snapshot, null, 2));
    await rename(temp, file);
  };

  const counts = { saved: 0, empty: 0, cached: 0, failed: 0 };
  let asked = 0;
  for (const [key, product] of await lavkaProducts()) {
    if (asked >= limit) break;
    const saved = snapshot.items[key];
    if (!flags.refresh && saved?.sourceUrl === product.url && Date.now() - Date.parse(saved.fetchedAt) < CACHE_DAYS * 86400000) { counts.cached++; continue; }
    const url = product.url;
    if (!(await isAllowedByRobots(url))) { console.log(`${product.brand}/${product.flavor}: robots.txt запрещает`); continue; }
    // The same pace as the price runs: 3 s plus jitter between requests.
    if (asked) await delay(3000 + Math.round(Math.random() * 1500));
    asked++;
    const city = CITIES.find((c) => c.id === product.city)!;
    let html: string;
    try {
      // Lavka answers a card with 404 while still rendering it; the SSR state decides, not the status.
      const response = await httpGet<string>(url, {
        retries: 0, responseType: 'text', validateStatus: (status) => status === 200 || status === 404,
        headers: { Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'ru-RU,ru;q=0.9', Cookie: lavkaLocationCookie(city) },
      });
      html = String(response.data);
    } catch (error) {
      const status = isAxiosError(error) ? error.response?.status : undefined;
      console.log(`${product.brand}/${product.flavor}: ${status ? `HTTP ${status}` : 'request_failed'}`);
      counts.failed++;
      // A ban or captcha is not something to push through: stop and keep what was collected.
      if (status === 401 || status === 403 || status === 429) break;
      continue;
    }
    const deepLink = decodeURIComponent(url.slice(SITE.length));
    const card = parseLavkaCard(html, deepLink, new Date().toISOString());
    if (!card) {
      counts.failed++;
      console.log(`${product.brand}/${product.flavor}: ${BLOCK_MARKERS.test(html) ? 'капча — обход остановлен' : 'нет данных товара в странице'}`);
      if (BLOCK_MARKERS.test(html)) break;
      continue;
    }
    snapshot.items[key] = { sourceUrl: url, title: card.title, volumeMl: product.volumeMl ?? null, fetchedAt: new Date().toISOString(), ingredients: card.ingredients, nutrition: card.nutrition };
    if (card.ingredients || card.nutrition) counts.saved++; else counts.empty++;
    const values = card.nutrition ? Object.entries(card.nutrition).filter(([k]) => !['method', 'extractedAt'].includes(k)).map(([k, v]) => `${k}=${v}`).join(' ') : 'без КБЖУ';
    console.log(`${product.brand}/${product.flavor}: ${values}${card.ingredients ? '' : ' · без состава'}`);
    if (asked % 10 === 0) await save();
  }
  await save();
  console.log(`Сохранено: ${counts.saved}, пустых карточек: ${counts.empty}, из кэша: ${counts.cached}, ошибок: ${counts.failed}. Файл: ${file}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Ошибка сбора карточек Лавки');
  process.exitCode = 1;
});
