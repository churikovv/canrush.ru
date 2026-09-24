import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { publishCandidate, type IngredientBinding } from '../src/ingredients/publish.js';
import type { IngredientSource } from '../src/ingredients/core.js';

const ingredients = 'Вода, сахар, таурин, кофеин (не более 30 мг/100 мл).';
const source: IngredientSource = { id: 'shop', name: 'Магазин', host: 'example.com', market: 'BY', strategy: 'http', paths: ['/product/'], priority: 1, evidence: '', notes: '', examples: [] };
const binding: IngredientBinding = { brand: 'Burn', flavor: 'tropical', productTitle: 'Burn Tropical 449 мл', volumeMl: 449, reportId: '2026-09-24T00-00-00-000Z', sourceUrl: 'https://example.com/product/1', ingredientsSha256: createHash('sha256').update(ingredients).digest('hex') };
const candidate = { url: binding.sourceUrl, sourceId: 'shop', market: 'BY', status: 'needs_review', ingredients, warnings: [], fetchedAt: '2026-09-24T00:00:00Z' };

describe('composition publication boundary', () => {
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
