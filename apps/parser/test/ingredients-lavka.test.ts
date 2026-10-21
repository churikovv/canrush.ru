import { describe, expect, it } from 'vitest';
import { compositionDose, parseLavkaCard } from '../src/ingredients/lavka.js';
import { LAVKA_REVIEW_NOTE, lavkaRecord } from '../src/ingredients/publish.js';

// Shape of a product card's storedehydratedstate-data on /supermarket/good/<deepLink> (Red Bull, October 2026).
const good = (deepLink: string, composition: string) => ({
  type: 'good', deepLink, title: 'Энер­ге­тик Red Bull', longTitle: 'Энергетический напиток Red Bull', amount: '250 мл',
  options: { ingredients: { pfcTraits: [
    { title: 'ккал', id: 'calories', measures: { per100g: '46' } }, { title: 'белки', id: 'protein', measures: { per100g: '0' } },
    { title: 'жиры', id: 'fat', measures: { per100g: '0' } }, { title: 'углеводы', id: 'carbohydrate', measures: { per100g: '11' } },
    { title: 'клетчатка', id: 'fiber', measures: { per100g: '0' } }, { title: 'ккал', id: 'calories', measures: { per_portion: '115' } },
  ], pfcSettings: { per100gTitle: 'На 100 г', perPortionTitle: 'На 250 мл' } } },
  descriptionBlocks: [
    { title: 'aiIngredients', type: 'aiIngredients', items: [{ title: 'Краткий состав', text: 'Вода, таурин 999 мг' }] },
    { title: 'Полный состав', type: 'text', attributes: ['ingredientsLoc'], value: composition },
  ],
});
const page = (...goods: object[]) => `<html><script id="storedehydratedstate-data" type="mime/invalid">${JSON.stringify({ products: { supermarket: goods } })}</script></html>`;
const composition = 'Газированная вода, сахароза, глюкоза, регуляторы кислотности (лимонная кислота), таурин (400 мг/100 мл), кофеин (32 мг/100 мл), витамины.';

describe('Lavka product cards', () => {
  it('takes the card fields per 100 g and doses from the full composition, never the AI summary', () => {
    const card = parseLavkaCard(page(good('other', 'Вода'), good('red-bull-250', composition)), 'red-bull-250', '2026-10-21T00:00:00Z');
    expect(card).toEqual({
      title: 'Энергетический напиток Red Bull, 250 мл',
      ingredients: composition,
      nutrition: { per: '100g', energyKcal: 46, protein: 0, fat: 0, carbs: 11, taurineMg: 400, caffeineMg: 32, method: 'store', extractedAt: '2026-10-21T00:00:00Z' },
    });
    expect(parseLavkaCard(page(good('other', composition)), 'red-bull-250', '2026-10-21T00:00:00Z')).toBeNull();
    expect(parseLavkaCard('<html>captcha</html>', 'red-bull-250', '2026-10-21T00:00:00Z')).toBeNull();
  });
  it('reads doses in mg, g and per cent, and refuses a number without a unit or two different doses', () => {
    expect(compositionDose('таурин (0,4%), кофеин (0,03%)', 'taurineMg')).toBe(400);
    expect(compositionDose('таурин (0,4%), кофеин (0,03%)', 'caffeineMg')).toBe(30);
    expect(compositionDose('таурин 0,4 г; кoфеин - не более 30 мг', 'caffeineMg')).toBe(30);
    for (const text of ['таурин, кофеин', 'таурин 400', 'таурин 400 мг, ещё таурин 300 мг', 'таурин 5 г']) expect(compositionDose(text, 'taurineMg')).toBeUndefined();
  });
  it('publishes a card only as a preliminary record and skips sugar conflicts or missing parts', () => {
    const item = { sourceUrl: 'https://lavka.yandex.ru/supermarket/good/red-bull-250', title: 'Энергетический напиток Red Bull, 250 мл', volumeMl: 250, fetchedAt: '2026-10-21T00:00:00Z', ingredients: composition, nutrition: null };
    expect(lavkaRecord('Red Bull', 'original', item)).toMatchObject({ sourceName: 'Яндекс Лавка', market: 'RU', status: 'unverified', reviewNote: LAVKA_REVIEW_NOTE, volumeMl: 250 });
    expect(lavkaRecord('Red Bull', 'unknown', item)).toBeNull();
    expect(lavkaRecord('Red Bull', 'original', { ...item, ingredients: null })).toBeNull();
    expect(lavkaRecord('Red Bull', 'original', { ...item, volumeMl: null })).toBeNull();
    expect(lavkaRecord('Red Bull', 'sugarfree', { ...item, title: 'Энергетический напиток Red Bull без сахара, 250 мл' })).toBeNull();
  });
});
