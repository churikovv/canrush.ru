#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { config } from 'dotenv';
import { GigaChatClient } from './gigachat.js';
import { nutritionExcerpt, nutritionPrompt, verifyNutrition } from './nutrition.js';
import { nutritionFile, nutritionKey, type NutritionSnapshot } from './publish.js';
import type { IngredientBinding } from './publish.js';

const parserRoot = path.resolve(import.meta.dirname, '../..');
const runs = path.resolve(parserRoot, '../../data/ingredients/runs');
const NUTRITION_FILE = nutritionFile(parserRoot);
config({ path: path.join(parserRoot, '.env.local'), quiet: true });
config({ path: path.join(parserRoot, '.env'), quiet: true });
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

function parseArgs(args: string[]) {
  const flags: Record<string, string> = {};
  for (const arg of args) {
    const match = /^--([a-z]+)(?:=(.*))?$/.exec(arg);
    if (!match?.[1] || !['product', 'limit', 'refresh', 'help'].includes(match[1])) throw new Error('Неизвестный аргумент. Используйте --help.');
    flags[match[1]] = match[2] ?? 'true';
  }
  return flags;
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    console.log('КБЖУ, таурин и кофеин из сохранённых страниц источников через GigaChat.\n[--product=Burn/tropical] [--limit=5] [--refresh]\nЗатем npm run ingredients:publish добавит данные к составам сайта.');
    return;
  }
  const limit = Number(flags.limit ?? 1000);
  if (!Number.isInteger(limit) || limit < 1) throw new Error('limit — целое число от 1.');
  const client = new GigaChatClient(process.env.GIGACHAT_AUTH_KEY ?? '', process.env.GIGACHAT_MODEL || 'GigaChat-2-Pro');
  const bindings = (JSON.parse(await readFile(path.join(parserRoot, 'config/ingredient-products.json'), 'utf8')) as IngredientBinding[])
    .filter((b) => !flags.product || `${b.brand}/${b.flavor}` === flags.product);
  if (!bindings.length) throw new Error('Нет таких товаров в config/ingredient-products.json.');
  let snapshot: NutritionSnapshot = { version: 1, items: {} };
  try { snapshot = JSON.parse(await readFile(NUTRITION_FILE, 'utf8')) as NutritionSnapshot; } catch { /* First run. */ }

  let asked = 0;
  const counts = { found: 0, empty: 0, cached: 0, failed: 0 };
  for (const binding of bindings) {
    if (asked >= limit) break;
    const key = nutritionKey(binding.brand, binding.flavor);
    const evidence = await readFile(path.join(runs, binding.reportId, `${sha(binding.sourceUrl).slice(0, 24)}.txt`), 'utf8').catch(() => '');
    const excerpt = nutritionExcerpt(evidence);
    const saved = snapshot.items[key];
    if (!excerpt) { counts.empty++; continue; }
    // The same page keeps the model's saved reply; it is only checked again, so stricter rules cost no requests.
    const reuse = !flags.refresh && saved?.sourceUrl === binding.sourceUrl && saved.excerptSha256 === sha(excerpt) && saved.reply;
    if (!reuse) {
      if (asked) await sleep(1000);
      asked++;
    }
    try {
      const reply = reuse ? saved.reply : await client.chat(nutritionPrompt(excerpt));
      const model = reuse ? saved.model : client.model;
      const { nutrition, dropped } = verifyNutrition(reply, excerpt, model, reuse ? saved.extractedAt : new Date().toISOString());
      snapshot.items[key] = { sourceUrl: binding.sourceUrl, excerptSha256: sha(excerpt), model, extractedAt: nutrition?.extractedAt ?? new Date().toISOString(), reply, nutrition, dropped };
      if (reuse) counts.cached++;
      if (nutrition) counts.found++; else counts.empty++;
      const values = nutrition ? Object.entries(nutrition).filter(([k]) => !['method', 'model', 'extractedAt'].includes(k)).map(([k, v]) => `${k}=${v}`).join(' ') : 'нет данных';
      console.log(`${binding.brand}/${binding.flavor}: ${values}${dropped.length ? ` · отброшено: ${dropped.join(', ')}` : ''}`);
    } catch (error) {
      counts.failed++;
      console.log(`${binding.brand}/${binding.flavor}: ${error instanceof Error && /^gigachat_[a-z_0-9]+$/.test(error.message) ? error.message : 'request_failed'}`);
    }
  }
  await mkdir(path.dirname(NUTRITION_FILE), { recursive: true });
  const temp = `${NUTRITION_FILE}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify(snapshot, null, 2));
  await rename(temp, NUTRITION_FILE);
  console.log(`С данными: ${counts.found}, без данных: ${counts.empty}, ответов из кэша: ${counts.cached}, ошибок: ${counts.failed}. Файл: ${NUTRITION_FILE}`);
  if (counts.failed) process.exitCode = 1;
}

main().catch((error: unknown) => {
  // Error messages never carry the key or token: the client only raises fixed codes.
  console.error(error instanceof Error && !/Basic |Bearer /.test(error.message) ? error.message : 'Ошибка извлечения пищевой ценности');
  process.exitCode = 1;
});
