import { describe, expect, it } from 'vitest';
import { dedupeProducts, detectBrand, extractVolumeMl, normalizeProduct } from '../src/normalize.js';

describe('extractVolumeMl', () => {
  it('извлекает объём в литрах и переводит в мл', () => {
    expect(extractVolumeMl('Энергетик Adrenaline Rush 0.449л')).toBe(449);
    expect(extractVolumeMl('Напиток 0,5 л')).toBe(500);
  });

  it('извлекает объём в мл напрямую', () => {
    expect(extractVolumeMl('Red Bull 355 мл')).toBe(355);
  });

  it('возвращает undefined, если объём не найден', () => {
    expect(extractVolumeMl('Энергетический напиток без объёма')).toBeUndefined();
  });
});

describe('detectBrand', () => {
  it('находит бренд без учёта регистра', () => {
    expect(detectBrand('red bull энергетик 355мл', ['Red Bull', 'Burn'])).toBe('Red Bull');
  });

  it('возвращает undefined, если бренд не из списка', () => {
    expect(detectBrand('Неизвестный напиток', ['Red Bull', 'Burn'])).toBeUndefined();
  });
});

describe('normalizeProduct', () => {
  it('собирает Product с объёмом и брендом', () => {
    const product = normalizeProduct(
      'wildberries',
      {
        sourceId: '123',
        name: 'Red Bull Энергетический напиток 0.355л',
        price: 129,
        oldPrice: 149,
        url: 'https://www.wildberries.ru/catalog/123/detail.aspx',
      },
      ['Red Bull'],
      '2026-08-11T00:00:00.000Z',
    );

    expect(product).toMatchObject({
      source: 'wildberries',
      sourceId: '123',
      brand: 'Red Bull',
      volumeMl: 355,
      price: 129,
      oldPrice: 149,
      currency: 'RUB',
      fetchedAt: '2026-08-11T00:00:00.000Z',
    });
  });
});

describe('dedupeProducts', () => {
  it('оставляет последнюю запись по паре source+sourceId', () => {
    const base = {
      source: 'wildberries' as const,
      sourceId: '1',
      name: 'Товар',
      currency: 'RUB' as const,
      url: 'https://example.com',
      fetchedAt: '2026-08-11T00:00:00.000Z',
    };
    const result = dedupeProducts([
      { ...base, price: 100 },
      { ...base, price: 120 },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.price).toBe(120);
  });
});
