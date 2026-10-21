import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { CITIES, isIngredientNutrition, isPublishedIngredients, isResolvedFlavor, type IngredientNutrition, type PublishedIngredients } from '@canrush/shared';
import { extractIngredients, sourceForUrl, type IngredientSource } from './core.js';

export interface IngredientBinding {
  brand: string;
  flavor: string;
  productTitle: string;
  volumeMl: number;
  reportId: string;
  sourceUrl: string;
  ingredientsSha256: string;
  status?: PublishedIngredients['status'];
  reviewNote?: string;
}

/** Label numbers read by GigaChat (nutrition-cli.ts), keyed by product; publication only attaches them. */
export const nutritionFile = (parserRoot: string) => path.resolve(parserRoot, '../../data/ingredients/nutrition.json');
export interface NutritionSnapshot {
  version: 1;
  /** `reply` is the model's raw answer, kept so verification can be rerun without new requests. */
  items: Record<string, { sourceUrl: string; excerptSha256: string; model: string; extractedAt: string; reply: string; nutrition: IngredientNutrition | null; dropped: string[] }>;
}
export const nutritionKey = (brand: string, flavor: string) => JSON.stringify([brand, flavor]);

/** Cards of the big Yandex Lavka (lavka-cli.ts): «Полный состав» and the card's nutrition fields, keyed by product. */
export const lavkaFile = (parserRoot: string) => path.resolve(parserRoot, '../../data/ingredients/lavka.json');
export interface LavkaSnapshot {
  version: 1;
  items: Record<string, { sourceUrl: string; title: string; volumeMl: number | null; fetchedAt: string; ingredients: string | null; nutrition: IngredientNutrition | null }>;
}
/** Compositions and numbers GigaChat wrote from general knowledge (ai-cli.ts), for products with no source at all. */
export const aiFile = (parserRoot: string) => path.resolve(parserRoot, '../../data/ingredients/ai.json');
export interface AiSnapshot {
  version: 1;
  items: Record<string, { title: string; volumeMl: number; model: string; generatedAt: string; reply: string; ingredients: string | null; nutrition: IngredientNutrition | null; dropped: string[] }>;
}

/**
 * The last resort: shown with an «ИИ» chip and replaced as soon as a reviewed binding or a Lavka card exists.
 * Only the ingredient list is published. The model's numbers stay in the snapshot: a blind check against known drinks
 * matched 14 of 33, and the full run gave the same defaults to most brands (taurine 80 mg, 23–31 kcal).
 */
export function aiRecord(brand: string, flavor: string, item: AiSnapshot['items'][string]): PublishedIngredients | null {
  if (!isResolvedFlavor(flavor) || !item.ingredients) return null;
  const record = {
    brand, flavor, productTitle: item.title, volumeMl: item.volumeMl, market: 'RU' as const, ingredients: item.ingredients,
    sourceName: 'GigaChat', fetchedAt: item.generatedAt, status: 'ai_generated' as const, model: item.model,
  };
  return isPublishedIngredients(record) ? record : null;
}

export const LAVKA_REVIEW_NOTE = 'Состав и пищевая ценность взяты из карточки Яндекс Лавки и ещё не сверены вручную.';

/**
 * A preliminary record from a Lavka card, for a product without a reviewed binding. The parser already matched the
 * card to the catalog by brand and flavor; the record still needs a catalog volume and no sugar conflict.
 */
export function lavkaRecord(brand: string, flavor: string, item: LavkaSnapshot['items'][string]): PublishedIngredients | null {
  if (!isResolvedFlavor(flavor) || !item.ingredients || !item.volumeMl) return null;
  if (extractIngredients(`Состав: ${item.ingredients}`, item.title).warnings.includes('possible_sugar_conflict')) return null;
  const record = {
    brand, flavor, productTitle: item.title, volumeMl: item.volumeMl, market: 'RU' as const, ingredients: item.ingredients,
    sourceName: 'Яндекс Лавка', sourceUrl: item.sourceUrl, fetchedAt: item.fetchedAt, status: 'unverified' as const, reviewNote: LAVKA_REVIEW_NOTE,
    ...(isIngredientNutrition(item.nutrition) ? { nutrition: item.nutrition } : {}),
  };
  return isPublishedIngredients(record) ? record : null;
}

export function publishCandidate(binding: IngredientBinding, candidate: unknown, sources: IngredientSource[]): PublishedIngredients | null {
  if (!isResolvedFlavor(binding.flavor)) return null;
  if (!candidate || typeof candidate !== 'object') return null;
  const c = candidate as Record<string, unknown>;
  const source = sourceForUrl(binding.sourceUrl, sources);
  if (!source || c.url !== binding.sourceUrl || c.sourceId !== source.id || c.market !== source.market || c.status !== 'needs_review' || typeof c.ingredients !== 'string') return null;
  if (createHash('sha256').update(c.ingredients).digest('hex') !== binding.ingredientsSha256) return null;
  // Recheck old cached reports with current rules, even if their warnings predate these rules.
  if (extractIngredients(`Состав: ${c.ingredients}`, binding.productTitle).warnings.includes('possible_sugar_conflict')) return null;
  if (!Array.isArray(c.warnings) || c.warnings.some((w) => ['possible_sugar_conflict', 'unclear_section_boundary'].includes(String(w)))) return null;
  // An explicit preliminary binding may show an incomplete excerpt with a visible explanation.
  if (c.warnings.includes('possibly_truncated') && binding.status !== 'unverified') return null;
  const record = {
    brand: binding.brand, flavor: binding.flavor, productTitle: binding.productTitle,
    volumeMl: binding.volumeMl, market: source.market, ingredients: c.ingredients,
    sourceName: source.name, sourceUrl: binding.sourceUrl, fetchedAt: c.fetchedAt,
    status: binding.status ?? 'source_reported',
    ...(binding.reviewNote ? { reviewNote: binding.reviewNote } : {}),
  };
  return isPublishedIngredients(record) ? record : null;
}

export async function publishIngredients(parserRoot: string, bundled = false): Promise<{ count: number; file: string }> {
  const bindings = JSON.parse(await readFile(path.join(parserRoot, 'config/ingredient-products.json'), 'utf8')) as IngredientBinding[];
  const sources = JSON.parse(await readFile(path.join(parserRoot, 'config/ingredient-sources.json'), 'utf8')) as IngredientSource[];
  const siteData = path.resolve(parserRoot, '../site/data');
  type Group = { brand: string; flavor: string; variants: { volumeMl?: number }[] };
  const groups: Group[] = [];
  for (const file of ['catalog.json', ...CITIES.map((city) => `regions/${city.id}.json`)]) {
    try {
      const catalog = JSON.parse(await readFile(path.join(siteData, file), 'utf8')) as { groups: Group[] };
      groups.push(...catalog.groups);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  if (!groups.length) throw new Error('Нет каталогов для проверки привязок');
  let nutrition: NutritionSnapshot['items'] = {};
  try { nutrition = (JSON.parse(await readFile(nutritionFile(parserRoot), 'utf8')) as NutritionSnapshot).items ?? {}; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const records: PublishedIngredients[] = [];
  const keys = new Set<string>();
  // Fail without replacing the existing snapshot if any binding no longer matches its evidence.
  for (const binding of bindings) {
    if (!/^\d{4}-\d{2}-\d{2}T[\dTZ-]+$/.test(binding.reportId)) throw new Error('Некорректный идентификатор отчёта');
    const key = JSON.stringify([binding.brand, binding.flavor]);
    if (keys.has(key)) throw new Error('Повторная привязка состава');
    keys.add(key);
    if (!groups.some((g) => g.brand === binding.brand && g.flavor === binding.flavor && g.variants.some((v) => v.volumeMl === binding.volumeMl))) throw new Error(`Версия товара отсутствует в каталоге: ${binding.brand}/${binding.flavor}`);
    const report = JSON.parse(await readFile(path.resolve(parserRoot, '../../data/ingredients/runs', binding.reportId, 'report.json'), 'utf8')) as { candidates: unknown[] };
    const record = report.candidates.map((c) => publishCandidate(binding, c, sources)).find((c) => c !== null);
    if (!record) throw new Error(`Состав не соответствует выбранному источнику: ${binding.brand}/${binding.flavor}`);
    // Numbers belong to the page the composition came from; a rebound source drops them until the next extraction.
    const extracted = nutrition[key];
    records.push(extracted?.sourceUrl === binding.sourceUrl && isIngredientNutrition(extracted.nutrition) ? { ...record, nutrition: extracted.nutrition } : record);
  }
  // Lavka fills only products without a reviewed binding, and only versions the catalogs still carry.
  let lavka: LavkaSnapshot['items'] = {};
  try { lavka = (JSON.parse(await readFile(lavkaFile(parserRoot), 'utf8')) as LavkaSnapshot).items ?? {}; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  for (const [key, item] of Object.entries(lavka)) {
    if (keys.has(key)) continue;
    const [brand, flavor] = JSON.parse(key) as [string, string];
    if (!groups.some((g) => g.brand === brand && g.flavor === flavor && g.variants.some((v) => v.volumeMl === item.volumeMl))) continue;
    const record = lavkaRecord(brand, flavor, item);
    if (record) { keys.add(key); records.push(record); }
  }
  let ai: AiSnapshot['items'] = {};
  try { ai = (JSON.parse(await readFile(aiFile(parserRoot), 'utf8')) as AiSnapshot).items ?? {}; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  for (const [key, item] of Object.entries(ai)) {
    if (keys.has(key)) continue;
    const [brand, flavor] = JSON.parse(key) as [string, string];
    if (!groups.some((g) => g.brand === brand && g.flavor === flavor && g.variants.some((v) => v.volumeMl === item.volumeMl))) continue;
    const record = aiRecord(brand, flavor, item);
    if (record) { keys.add(key); records.push(record); }
  }
  const directory = bundled ? path.resolve(parserRoot, '../site/src/content') : siteData;
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, 'ingredients.json');
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), products: records }, null, 2));
  await rename(temp, file);
  return { count: records.length, file };
}
