import { describe, expect, it } from 'vitest';
import type { AdapterRunResult, Product } from '@canrush/shared';
import { filterSuspiciousVariants, groupByFlavor, mergeResults } from '../src/storage.js';

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

describe('groupByFlavor', () => {
  it('группирует товары по паре бренд+вкус', () => {
    const products = [
      product({ source: 'wildberries', sourceId: '1', brand: 'Red Bull', flavor: 'original', price: 129 }),
      product({ source: 'ozon', sourceId: '2', brand: 'Red Bull', flavor: 'original', price: 119 }),
      product({ source: 'wildberries', sourceId: '3', brand: 'Red Bull', flavor: 'kiwi', price: 139 }),
    ];

    const groups = groupByFlavor(products);
    expect(groups).toHaveLength(2);

    const original = groups.find((g) => g.flavor === 'original');
    expect(original?.brand).toBe('Red Bull');
    expect(original?.variants).toHaveLength(2);
    expect(original?.minPrice).toBe(119);

    const kiwi = groups.find((g) => g.flavor === 'kiwi');
    expect(kiwi?.variants).toHaveLength(1);
    expect(kiwi?.minPrice).toBe(139);
  });

  it('не смешивает неопределённый вкус с оригинальным', () => {
    const products = [product({ source: 'wildberries', sourceId: '1', price: 100 })];
    const groups = groupByFlavor(products);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.brand).toBe('Unknown');
    expect(groups[0]?.flavor).toMatch(/^unresolved:/);
  });

  it('выбирает coverImageUrl из первого варианта с изображением', () => {
    const products = [
      product({ source: 'wildberries', sourceId: '1', brand: 'Burn', flavor: 'original', price: 100, imageUrl: undefined }),
      product({ source: 'ozon', sourceId: '2', brand: 'Burn', flavor: 'original', price: 90, imageUrl: 'https://img.ru/burn.jpg' }),
    ];

    const groups = groupByFlavor(products);
    expect(groups[0]?.coverImageUrl).toBe('https://img.ru/burn.jpg');
  });

  it('возвращает пустой массив для пустого входа', () => {
    expect(groupByFlavor([])).toEqual([]);
  });
});

describe('filterSuspiciousVariants', () => {
  it('удаляет варианты дешевле 50% от медианы группы', () => {
    // Медиана = 100 (сортируем [20, 100, 120] → mid=100), порог = 50
    const products = [
      product({ source: 'edadeal', sourceId: '1', brand: 'Red Bull', flavor: 'original', price: 100 }),
      product({ source: 'edadeal', sourceId: '2', brand: 'Red Bull', flavor: 'original', price: 120 }),
      product({ source: 'edadeal', sourceId: '3', brand: 'Red Bull', flavor: 'original', price: 20 }),
    ];
    const groups = groupByFlavor(products);
    const filtered = filterSuspiciousVariants(groups);

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.variants).toHaveLength(2);
    expect(filtered[0]?.variants.map((v) => v.price).sort((a, b) => a - b)).toEqual([100, 120]);
    expect(filtered[0]?.minPrice).toBe(100);
  });

  it('не фильтрует группы с одним вариантом', () => {
    const products = [
      product({ source: 'wildberries', sourceId: '1', brand: 'Burn', flavor: 'original', price: 10 }),
    ];
    const groups = groupByFlavor(products);
    const filtered = filterSuspiciousVariants(groups);

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.variants).toHaveLength(1);
    expect(filtered[0]?.minPrice).toBe(10);
  });

  it('оставляет группу, если фильтрация удалила бы все варианты', () => {
    // Все цены ниже 50% медианы → оставляем как есть
    const products = [
      product({ source: 'edadeal', sourceId: '1', brand: 'Flash', flavor: 'original', price: 10 }),
      product({ source: 'edadeal', sourceId: '2', brand: 'Flash', flavor: 'original', price: 12 }),
    ];
    const groups = groupByFlavor(products);
    const filtered = filterSuspiciousVariants(groups);

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.variants).toHaveLength(2);
  });

  it('работает с чётным числом вариантов (медиана = среднее двух центральных)', () => {
    // Цены: [10, 50, 100, 110] → медиана = (50+100)/2 = 75, порог = 37.5
    const products = [
      product({ source: 'edadeal', sourceId: '1', brand: 'X', flavor: 'original', price: 100 }),
      product({ source: 'edadeal', sourceId: '2', brand: 'X', flavor: 'original', price: 110 }),
      product({ source: 'edadeal', sourceId: '3', brand: 'X', flavor: 'original', price: 50 }),
      product({ source: 'edadeal', sourceId: '4', brand: 'X', flavor: 'original', price: 10 }),
    ];
    const groups = groupByFlavor(products);
    const filtered = filterSuspiciousVariants(groups);

    expect(filtered[0]?.variants).toHaveLength(3);
    expect(filtered[0]?.variants.map((v) => v.price).sort((a, b) => a - b)).toEqual([50, 100, 110]);
  });

  it('не трогает группы, где все варианты выше порога', () => {
    const products = [
      product({ source: 'wildberries', sourceId: '1', brand: 'Y', flavor: 'original', price: 100 }),
      product({ source: 'ozon', sourceId: '2', brand: 'Y', flavor: 'original', price: 90 }),
    ];
    const groups = groupByFlavor(products);
    const filtered = filterSuspiciousVariants(groups);

    expect(filtered[0]?.variants).toHaveLength(2);
  });
});
