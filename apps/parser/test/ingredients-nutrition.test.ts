import { describe, expect, it } from 'vitest';
import { GigaChatClient } from '../src/ingredients/gigachat.js';
import { labelledNumbers, nutritionBasis, nutritionExcerpt, verifyNutrition } from '../src/ingredients/nutrition.js';

const glued = 'Состав\n\nВода, сахар, таурин (230 мг / 100 мл), кофеин (не более 30 мг / 100 мл), витамин В6.\n\nНа 100 грамм\n0.2Белки14Углеводы60 ккал/250 кджЭнергетическая ценность';
const lines = 'Пищевая ценность в 100 граммах\n\nКкал\n\n47\n\nБелки\n\n0\n\nУглеводы\n\n11.3\n\n• таурин - не более 10 мг\n• кoфеин - 30 мг';
const verify = (reply: object, source = glued) => verifyNutrition(JSON.stringify(reply), source, 'GigaChat-2-Pro', '2026-10-21T00:00:00Z');

describe('label numbers', () => {
  it('reads both shop layouts: glued into one line and label-then-value lines', () => {
    expect([labelledNumbers(glued, 'protein'), labelledNumbers(glued, 'carbs'), labelledNumbers(glued, 'energyKcal')]).toEqual([[0.2], [14], [60]]);
    expect([labelledNumbers(lines, 'energyKcal'), labelledNumbers(lines, 'protein'), labelledNumbers(lines, 'carbs')]).toEqual([[47], [0], [11.3]]);
  });
  it('accepts «не более» and Latin look-alike letters, never a number from another line', () => {
    expect(labelledNumbers(glued, 'taurineMg')).toEqual([230]);
    expect(labelledNumbers(lines, 'taurineMg')).toEqual([10]);
    expect(labelledNumbers(lines, 'caffeineMg')).toEqual([30]);
    expect(labelledNumbers(glued, 'sugar')).toEqual([]);
  });
  it('takes the basis from the text and keeps only the label parts of a long page', () => {
    expect(nutritionBasis(glued)).toBe('100g');
    expect(nutritionBasis('Пищевая ценность на 100 мл: 45 ккал')).toBe('100ml');
    expect(nutritionBasis('Без таблицы')).toBeNull();
    const page = `Энергетические напитки ${'меню '.repeat(2000)} Состав: вода, таурин (400 мг/100 мл). ${'цены '.repeat(2000)} Пищевая ценность: 46 ккал`;
    const excerpt = nutritionExcerpt(page);
    expect(excerpt).toContain('таурин (400 мг/100 мл)');
    expect(excerpt).toContain('46 ккал');
    expect(excerpt.length).toBeLessThan(2000);
  });
});

describe('verification of the model reply', () => {
  it('keeps values written next to their labels and the basis from the text', () => {
    expect(verify({ per: '100ml', energyKcal: 60, protein: 0.2, carbs: 14, sugar: null, taurineMg: 230, caffeineMg: 30 })).toEqual({
      nutrition: { per: '100g', energyKcal: 60, protein: 0.2, carbs: 14, taurineMg: 230, caffeineMg: 30, method: 'gigachat', model: 'GigaChat-2-Pro', extractedAt: '2026-10-21T00:00:00Z' },
      dropped: [],
    });
  });
  it('drops invented, misplaced and implausible numbers', () => {
    // 6 is written on the page (В6) but not as carbs; 14 is the carbs, not sugar.
    expect(verify({ carbs: 6, sugar: 14, caffeineMg: 300, taurineMg: '230' })).toMatchObject({ nutrition: { taurineMg: 230 }, dropped: ['carbs:not_in_source', 'sugar:not_in_source', 'caffeineMg:out_of_range'] });
    expect(verify({ taurineMg: 400 }, 'Таурин 0,4 г').nutrition?.taurineMg).toBe(400);
    expect(verify({ carbs: 6 }).nutrition).toBeNull();
    expect(verifyNutrition('Не могу ответить', glued, 'm', '2026-10-21T00:00:00Z')).toEqual({ nutrition: null, dropped: ['invalid_json'] });
    expect(verifyNutrition('```json\n{"energyKcal": 60}\n```', glued, 'm', '2026-10-21T00:00:00Z').nutrition?.energyKcal).toBe(60);
  });
});

describe('GigaChat client', () => {
  it('reuses the 30-minute token, renews it a minute early and after a 401', async () => {
    let now = 0;
    const calls: string[] = [];
    let unauthorized = false;
    const post = async (url: string, headers: Record<string, string>) => {
      calls.push(url.endsWith('/oauth') ? `oauth:${headers.Authorization}` : `chat:${headers.Authorization}`);
      if (url.endsWith('/oauth')) return { status: 200, body: JSON.stringify({ access_token: `t${calls.length}`, expires_at: now + 30 * 60_000 }) };
      if (unauthorized) { unauthorized = false; return { status: 401, body: '' }; }
      return { status: 200, body: JSON.stringify({ choices: [{ message: { content: 'ok' } }] }) };
    };
    const client = new GigaChatClient('key', 'GigaChat-2-Pro', post, () => now);
    expect(await client.chat([{ role: 'user', content: 'a' }])).toBe('ok');
    await client.chat([{ role: 'user', content: 'b' }]);
    now += 28 * 60_000;
    await client.chat([{ role: 'user', content: 'c' }]);
    expect(calls.filter((c) => c.startsWith('oauth'))).toEqual(['oauth:Basic key']);
    now += 90_000;
    await client.chat([{ role: 'user', content: 'd' }]);
    unauthorized = true;
    await client.chat([{ role: 'user', content: 'e' }]);
    expect(calls.filter((c) => c.startsWith('oauth'))).toHaveLength(3);
    expect(calls.at(-1)).toMatch(/^chat:Bearer t\d+$/);
  });
  it('refuses to start without a key and reports only fixed error codes', async () => {
    expect(() => new GigaChatClient(' ')).toThrow('GIGACHAT_AUTH_KEY');
    const client = new GigaChatClient('key', 'm', async () => ({ status: 401, body: 'Basic key echoed' }));
    await expect(client.accessToken()).rejects.toThrow(/^gigachat_oauth_401$/);
  });
});
