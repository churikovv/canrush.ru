import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { publishCandidate, publishIngredients, type IngredientBinding } from '../src/ingredients/publish.js';
import type { IngredientSource } from '../src/ingredients/core.js';

const ingredients = 'Вода, сахар, таурин, кофеин (не более 30 мг/100 мл).';
const source: IngredientSource = { id: 'shop', name: 'Магазин', host: 'example.com', market: 'BY', strategy: 'http', paths: ['/product/'], priority: 1, evidence: '', notes: '', examples: [] };
const binding: IngredientBinding = { brand: 'Burn', flavor: 'tropical', productTitle: 'Burn Tropical 449 мл', volumeMl: 449, reportId: '2026-09-24T00-00-00-000Z', sourceUrl: 'https://example.com/product/1', ingredientsSha256: createHash('sha256').update(ingredients).digest('hex') };
const candidate = { url: binding.sourceUrl, sourceId: 'shop', market: 'BY', status: 'needs_review', ingredients, warnings: [], fetchedAt: '2026-09-24T00:00:00Z' };

describe('composition publication boundary', () => {
  it.each(['unknown', 'unresolved:123'])('never publishes an ambiguous product identity: %s', (flavor) => {
    expect(publishCandidate({ ...binding, flavor }, candidate, [source])).toBeNull();
  });
  it('rechecks sugar conflicts in cached reports that have no warning', () => {
    expect(publishCandidate({ ...binding, flavor: 'sugarfree', productTitle: 'Burn Zero Sugar 449 мл' }, candidate, [source])).toBeNull();
  });
  it('keeps market and source attribution, never claims recipe verification', () => {
    expect(publishCandidate(binding, candidate, [source])).toMatchObject({ market: 'BY', sourceName: 'Магазин', status: 'source_reported', ingredients });
  });
  it('allows an incomplete source only with an explicit preliminary status and explanation', () => {
    const partial = { ...candidate, warnings: ['possibly_truncated'] };
    const preliminary = { ...binding, status: 'unverified' as const, reviewNote: 'В источнике приведён неполный перечень компонентов.' };
    expect(publishCandidate(preliminary, partial, [source])).toMatchObject({ status: 'unverified', reviewNote: preliminary.reviewNote });
    expect(publishCandidate({ ...preliminary, reviewNote: undefined }, partial, [source])).toBeNull();
    expect(publishCandidate({ ...preliminary, reviewNote: ' ' }, partial, [source])).toBeNull();
    expect(publishCandidate(preliminary, { ...partial, warnings: ['possible_sugar_conflict'] }, [source])).toBeNull();
    expect(publishCandidate(preliminary, { ...partial, ingredients: `${ingredients} Изменено.` }, [source])).toBeNull();
  });
  it.each([
    { ingredients: `${ingredients} Другой состав.` },
    { url: 'https://example.com/product/2' },
    { market: 'RU' },
    { status: 'missing' },
    { warnings: ['possibly_truncated'] },
    { warnings: ['possible_sugar_conflict'] },
    { fetchedAt: 'invalid' },
  ])('rejects changed or unsafe evidence: %j', (change) => {
    expect(publishCandidate(binding, { ...candidate, ...change }, [source])).toBeNull();
  });
});

it('publishes a regional-only product to the Git bundle and preserves it on evidence failure', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'canrush-ingredients-'));
  const parserRoot = path.join(root, 'apps/parser');
  const put = async (file: string, value: unknown) => {
    const target = path.join(root, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, JSON.stringify(value));
  };
  try {
    await put('apps/parser/config/ingredient-products.json', [binding]);
    await put('apps/parser/config/ingredient-sources.json', [source]);
    await put('apps/site/data/catalog.json', { groups: [{ brand: 'Burn', flavor: 'tropical', variants: [{ volumeMl: 250 }] }] });
    await put('apps/site/data/regions/saint-petersburg.json', { groups: [{ brand: 'Burn', flavor: 'tropical', variants: [{ volumeMl: 449 }] }] });
    const evidence = `data/ingredients/runs/${binding.reportId}/report.json`;
    await put(evidence, { candidates: [candidate] });
    const result = await publishIngredients(parserRoot, true);
    expect(result.count).toBe(1);
    expect(result.file).toBe(path.join(root, 'apps/site/src/content/ingredients.json'));
    const before = await readFile(result.file, 'utf8');
    expect(JSON.parse(before).products[0]).toMatchObject({ flavor: 'tropical', volumeMl: 449 });
    await put(evidence, { candidates: [{ ...candidate, ingredients: 'Изменённый состав' }] });
    await expect(publishIngredients(parserRoot, true)).rejects.toThrow('Состав не соответствует');
    expect(await readFile(result.file, 'utf8')).toBe(before);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
