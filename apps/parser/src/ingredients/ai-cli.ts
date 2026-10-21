#!/usr/bin/env node
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { config } from 'dotenv';
import { CITIES, NUTRITION_FIELDS, isPublishedIngredients, isResolvedFlavor, type Product, type PublishedIngredients } from '@canrush/shared';
import { aiPrompt, ingredientOverlap, verifyAiReply } from './ai.js';
import { GigaChatClient } from './gigachat.js';
import { aiFile, nutritionKey, type AiSnapshot } from './publish.js';

const parserRoot = path.resolve(import.meta.dirname, '../..');
const dataRoot = path.resolve(parserRoot, '../../data');
const siteRoot = path.resolve(parserRoot, '../site');
config({ path: path.join(parserRoot, '.env.local'), quiet: true });
config({ path: path.join(parserRoot, '.env'), quiet: true });

function parseArgs(args: string[]) {
  const flags: Record<string, string> = {};
  for (const arg of args) {
    const match = /^--([a-z]+)(?:=(.*))?$/.exec(arg);
    if (!match?.[1] || !['limit', 'control', 'refresh', 'help'].includes(match[1])) throw new Error('Неизвестный аргумент. Используйте --help.');
    flags[match[1]] = match[2] ?? 'true';
  }
  return flags;
}

const readJson = async <T>(file: string): Promise<T | undefined> => {
  try { return JSON.parse(await readFile(file, 'utf8')) as T; } catch { return undefined; }
};

/** A real shop title for each catalog product, from the latest national and regional price runs. */
async function shopTitles() {
  const titles = new Map<string, { title: string; volumeMl: number }>();
  const files = [path.join(dataRoot, 'latest.json'), ...CITIES.map((city) => path.join(dataRoot, 'regions', city.id, 'latest.json'))];
  for (const file of files) {
    for (const product of (await readJson<{ products: Product[] }>(file))?.products ?? []) {
      const { brand, flavor, name, volumeMl } = product;
      if (!brand || !flavor || !isResolvedFlavor(flavor) || !name || !volumeMl) continue;
      const key = nutritionKey(brand, flavor);
      if (!titles.has(key)) titles.set(key, { title: name.replace(/\s+/g, ' ').trim(), volumeMl });
    }
  }
  return titles;
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    console.log('Состав и пищевая ценность от GigaChat по памяти для товаров без источника (статус «Сгенерировано ИИ»).\n'
      + '--control=10 — сравнить с уже известными составами, ничего не сохраняя для сайта.\n[--limit=50] [--refresh]\nЗатем npm run ingredients:publish.');
    return;
  }
  const client = new GigaChatClient(process.env.GIGACHAT_AUTH_KEY ?? '', process.env.GIGACHAT_MODEL || 'GigaChat-2-Pro');
  const titles = await shopTitles();
  const published = ((await readJson<{ products: unknown[] }>(path.join(siteRoot, 'src/content/ingredients.json')))?.products ?? [])
    .filter(isPublishedIngredients);
  const ask = async (title: string, volumeMl: number) => client.chat(aiPrompt(title, volumeMl));

  if (flags.control) {
    // Products with a sourced composition and numbers: the model answers blind, its answer is compared, nothing is published.
    const count = Number(flags.control === 'true' ? 10 : flags.control);
    const known = published.filter((p): p is PublishedIngredients & { nutrition: NonNullable<PublishedIngredients['nutrition']> } => p.status !== 'ai_generated' && !!p.nutrition)
      .filter((p) => titles.has(nutritionKey(p.brand, p.flavor)));
    const sample = Array.from({ length: Math.min(count, known.length) }, (_, i) => known[Math.floor((i * known.length) / Math.min(count, known.length))]!);
    const rows = [];
    for (const [index, product] of sample.entries()) {
      if (index) await sleep(1000);
      const { title, volumeMl } = titles.get(nutritionKey(product.brand, product.flavor))!;
      const reply = await ask(title, volumeMl);
      const result = verifyAiReply(reply, product.flavor, title, client.model, new Date().toISOString());
      const numbers = NUTRITION_FIELDS.filter((field) => product.nutrition[field] !== undefined && result.nutrition?.[field] !== undefined)
        .map((field) => ({ field, source: product.nutrition[field]!, ai: result.nutrition![field]! }));
      const close = numbers.filter((n) => Math.abs(n.source - n.ai) <= Math.max(1, n.source * 0.15)).length;
      rows.push({ product: `${product.brand}/${product.flavor}`, title, known: result.ingredients !== null || result.nutrition !== null,
        overlap: result.ingredients ? Math.round(ingredientOverlap(product.ingredients, result.ingredients) * 100) : null, numbers, close, dropped: result.dropped, reply });
      console.log(`${product.brand}/${product.flavor}: ${result.ingredients ? `состав совпал на ${Math.round(ingredientOverlap(product.ingredients, result.ingredients) * 100)}%` : 'без состава'}`
        + ` · числа ±15%: ${close}/${numbers.length}${numbers.length ? ` (${numbers.map((n) => `${n.field} ${n.source}→${n.ai}`).join(', ')})` : ''}${result.dropped.length ? ` · отброшено: ${result.dropped.join(', ')}` : ''}`);
    }
    const file = path.join(dataRoot, 'ingredients/ai-control.json');
    await writeFile(file, JSON.stringify({ at: new Date().toISOString(), model: client.model, rows }, null, 2));
    console.log(`Контроль сохранён: ${file}`);
    return;
  }

  const limit = Number(flags.limit ?? 1000);
  if (!Number.isInteger(limit) || limit < 1) throw new Error('limit — целое число от 1.');
  const covered = new Set(published.filter((p) => p.status !== 'ai_generated').map((p) => nutritionKey(p.brand, p.flavor)));
  const file = aiFile(parserRoot);
  const snapshot: AiSnapshot = (await readJson<AiSnapshot>(file)) ?? { version: 1, items: {} };
  const save = async () => {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(`${file}.${process.pid}.tmp`, JSON.stringify(snapshot, null, 2));
    await rename(`${file}.${process.pid}.tmp`, file);
  };
  const counts = { saved: 0, unknown: 0, cached: 0, failed: 0 };
  let asked = 0;
  for (const [key, { title, volumeMl }] of titles) {
    if (covered.has(key)) continue;
    if (asked >= limit) break;
    const [, flavor] = JSON.parse(key) as [string, string];
    const saved = snapshot.items[key];
    // A saved reply is only checked again, so stricter rules never cost new requests.
    const reuse = !flags.refresh && saved?.title === title && saved.reply;
    if (!reuse) { if (asked) await sleep(1000); asked++; }
    try {
      const reply = reuse ? saved.reply : await ask(title, volumeMl);
      const generatedAt = reuse ? saved.generatedAt : new Date().toISOString();
      const model = reuse ? saved.model : client.model;
      const result = verifyAiReply(reply, flavor, title, model, generatedAt);
      snapshot.items[key] = { title, volumeMl, model, generatedAt, reply, ...result };
      if (reuse) counts.cached++;
      if (result.ingredients) counts.saved++; else counts.unknown++;
      const values = result.nutrition ? NUTRITION_FIELDS.filter((f) => result.nutrition![f] !== undefined).map((f) => `${f}=${result.nutrition![f]}`).join(' ') : 'без чисел';
      console.log(`${key}: ${result.ingredients ? 'состав' : 'без состава'} · ${values}${result.dropped.length ? ` · отброшено: ${result.dropped.join(', ')}` : ''}`);
    } catch (error) {
      counts.failed++;
      console.log(`${key}: ${error instanceof Error && /^gigachat_[a-z_0-9]+$/.test(error.message) ? error.message : 'request_failed'}`);
      if (error instanceof Error && /^gigachat_(?:oauth|chat)_(?:401|402|403|429)$/.test(error.message)) break;
    }
    if (asked && asked % 10 === 0) await save();
  }
  await save();
  console.log(`С составом: ${counts.saved}, модель не знает: ${counts.unknown}, ответов из кэша: ${counts.cached}, ошибок: ${counts.failed}. Файл: ${file}`);
  if (counts.failed) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error && !/Basic |Bearer /.test(error.message) ? error.message : 'Ошибка генерации составов');
  process.exitCode = 1;
});
