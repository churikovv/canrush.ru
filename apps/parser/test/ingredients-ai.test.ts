import { describe, expect, it } from 'vitest';
import { ingredientOverlap, isSugarFree, verifyAiReply } from '../src/ingredients/ai.js';
import { aiRecord } from '../src/ingredients/publish.js';

const list = 'Вода, сахар, регуляторы кислотности (лимонная кислота), таурин, кофеин, ароматизаторы, витамины.';
const reply = (value: object) => JSON.stringify({ known: true, ingredients: list, per: '100ml', energyKcal: 45, carbs: 11, sugar: 11, taurineMg: 400, caffeineMg: 32, ...value });
const verify = (value: object, flavor = 'original', title = 'Энергетик Red Bull, 250 мл') => verifyAiReply(reply(value), flavor, title, 'GigaChat-2-Pro', '2026-10-21T00:00:00Z');

describe('compositions written by the model', () => {
  it('keeps a known drink with plausible numbers, marked as the model’s', () => {
    expect(verify({})).toEqual({ ingredients: list, dropped: [],
      nutrition: { per: '100ml', energyKcal: 45, carbs: 11, sugar: 11, taurineMg: 400, caffeineMg: 32, method: 'ai', model: 'GigaChat-2-Pro', extractedAt: '2026-10-21T00:00:00Z' } });
  });
  it('drops an unknown drink, an implausible list and out-of-range numbers', () => {
    expect(verify({ known: false })).toEqual({ ingredients: null, nutrition: null, dropped: ['unknown'] });
    expect(verifyAiReply('Не знаю', 'original', 't', 'm', '2026-10-21T00:00:00Z').dropped).toEqual(['invalid_json']);
    expect(verify({ ingredients: 'Таурин и кофеин' }).dropped).toContain('ingredients:implausible');
    expect(verify({ caffeineMg: 300 })).toMatchObject({ dropped: ['caffeineMg:out_of_range'], nutrition: { taurineMg: 400 } });
  });
  it('rejects a sugared description of a sugar-free version, by flavor or by title', () => {
    expect(isSugarFree('citrus:sugarfree', 'Burn Цитрус')).toBe(true);
    expect(isSugarFree('original', 'Red Bull Zero, 250 мл')).toBe(true);
    expect(verify({}, 'sugarfree')).toEqual({ ingredients: null, nutrition: null, dropped: ['sugar_conflict'] });
    const sweetener = 'Вода, регуляторы кислотности (лимонная кислота), таурин, кофеин, подсластители (сукралоза), ароматизаторы.';
    expect(verify({ ingredients: sweetener }, 'sugarfree')).toMatchObject({ ingredients: sweetener, nutrition: null, dropped: ['nutrition:sugar_conflict'] });
    expect(verify({ ingredients: sweetener, energyKcal: 3, carbs: 0.5, sugar: 0 }, 'sugarfree').nutrition).toMatchObject({ energyKcal: 3, method: 'ai' });
  });
  it('compares lists by shared words and publishes only the list, as ai_generated without a source page', () => {
    expect(ingredientOverlap(list, 'Вода, сахар, таурин')).toBeCloseTo(3 / 9, 1);
    const item = { title: 'Энергетик Red Bull, 250 мл', volumeMl: 250, model: 'GigaChat-2-Pro', generatedAt: '2026-10-21T00:00:00Z', reply: '', dropped: [], ...verify({}) };
    const record = aiRecord('Red Bull', 'original', item);
    expect(record).toMatchObject({ status: 'ai_generated', sourceName: 'GigaChat', model: 'GigaChat-2-Pro', ingredients: list });
    // Only the list goes to the site: the model's numbers were mostly defaults.
    expect(record).not.toHaveProperty('nutrition');
    expect(record).not.toHaveProperty('sourceUrl');
    expect(aiRecord('Red Bull', 'unknown', item)).toBeNull();
    expect(aiRecord('Red Bull', 'original', { ...item, ingredients: null })).toBeNull();
  });
});
