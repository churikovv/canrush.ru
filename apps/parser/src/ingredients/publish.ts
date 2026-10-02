import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { CITIES, isPublishedIngredients, isResolvedFlavor, type PublishedIngredients } from '@canrush/shared';
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
    records.push(record);
  }
  const directory = bundled ? path.resolve(parserRoot, '../site/src/content') : siteData;
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, 'ingredients.json');
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), products: records }, null, 2));
  await rename(temp, file);
  return { count: records.length, file };
}
