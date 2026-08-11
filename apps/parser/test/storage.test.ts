import { describe, expect, it } from 'vitest';
import type { AdapterRunResult, Product } from '@canrush/shared';
import { mergeResults } from '../src/storage.js';

function product(overrides: Partial<Product>): Product {
  return {
    source: 'wildberries',
    sourceId: '1',
    name: 'Товар',
    price: 100,
    currency: 'RUB',
    url: 'https://example.com',
    fetchedAt: '2026-08-10T00:00:00.000Z',
    ...overrides,
  };
}

function runResult(overrides: Partial<AdapterRunResult>): AdapterRunResult {
  return {
    source: 'wildberries',
    status: 'ok',
    products: [],
    startedAt: '2026-08-11T00:00:00.000Z',
    finishedAt: '2026-08-11T00:00:05.000Z',
    ...overrides,
  };
}

describe('mergeResults', () => {
  it('берёт свежие товары источника со статусом ok как есть', () => {
    const fresh = product({ source: 'wildberries', sourceId: '1', price: 150 });
    const merged = mergeResults([runResult({ source: 'wildberries', status: 'ok', products: [fresh] })], []);

    expect(merged).toEqual([fresh]);
  });

  it('подставляет старые товары со stale=true, если источник недоступен', () => {
    const previous = [product({ source: 'ozon', sourceId: '42', price: 200 })];
    const merged = mergeResults(
      [runResult({ source: 'ozon', status: 'blocked', products: [], error: 'заблокирован' })],
      previous,
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ sourceId: '42', price: 200, stale: true });
    expect(merged[0]?.lastSeenAt).toBe(previous[0]?.fetchedAt);
  });

  it('не трогает товары других источников из previousProducts', () => {
    const previous = [
      product({ source: 'ozon', sourceId: '1' }),
      product({ source: 'lenta', sourceId: '2' }),
    ];
    const merged = mergeResults(
      [runResult({ source: 'ozon', status: 'ok', products: [] })],
      previous,
    );

    // ozon сейчас ok но без товаров -> его старые товары не переносятся;
    // lenta вообще не участвовала в этом прогоне -> её товары тоже не попадают.
    expect(merged).toHaveLength(0);
  });

  it('дедуплицирует товары по source+sourceId после слияния', () => {
    const previous = [product({ source: 'wildberries', sourceId: '1', price: 100 })];
    const merged = mergeResults(
      [
        runResult({
          source: 'wildberries',
          status: 'ok',
          products: [product({ source: 'wildberries', sourceId: '1', price: 130 })],
        }),
      ],
      previous,
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.price).toBe(130);
    expect(merged[0]?.stale).toBeUndefined();
  });
});
