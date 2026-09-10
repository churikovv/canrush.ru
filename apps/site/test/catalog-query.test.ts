import { describe, expect, it } from 'vitest';
import type { CatalogGroup } from '@canrush/shared';
import {
  catalogGroupSlug,
  catalogOffers,
  decodeCatalogGroupSlug,
  filterCatalogGroups,
  flavorName,
} from '../src/lib/catalog-query.js';

function group(overrides: Partial<CatalogGroup>): CatalogGroup {
  return {
    brand: 'Burn',
    flavor: 'original',
    minPrice: 100,
    variants: [
      {
        source: 'edadeal',
        retailer: 'Пятёрочка',
        price: 100,
        url: 'https://example.com',
        fetchedAt: '2026-09-06T00:00:00.000Z',
      },
    ],
    ...overrides,
  };
}

describe('catalog query', () => {
  it('ищет по бренду и русскому названию вкуса', () => {
    const groups = [group({ brand: 'Burn', flavor: 'apple' }), group({ brand: 'Red Bull', flavor: 'original' })];

    expect(
      filterCatalogGroups(groups, { query: 'яблоко', brand: '', flavor: '', sort: 'deals' }),
    ).toHaveLength(1);
    expect(
      filterCatalogGroups(groups, { query: 'red bull', brand: '', flavor: '', sort: 'deals' })[0]?.brand,
    ).toBe('Red Bull');
  });

  it('ищет без учёта пробелов и по данным вариантов', () => {
    const redBull = group({
      brand: 'Red Bull',
      variants: [
        {
          source: 'edadeal',
          retailer: 'Пятёрочка',
          volumeMl: 473,
          price: 100,
          url: 'https://example.com',
          fetchedAt: '2026-09-06T00:00:00.000Z',
        },
      ],
    });
    const burn = group({
      brand: 'Burn',
      variants: [
        {
          source: 'edadeal',
          retailer: 'Metro',
          volumeMl: 449,
          price: 90,
          url: 'https://example.com',
          fetchedAt: '2026-09-06T00:00:00.000Z',
        },
      ],
    });
    const groups = [redBull, burn];

    expect(filterCatalogGroups(groups, { query: 'redbull', brand: '', flavor: '', sort: 'stores' })).toEqual([
      redBull,
    ]);
    expect(filterCatalogGroups(groups, { query: 'пятерочка', brand: '', flavor: '', sort: 'stores' })).toEqual([
      redBull,
    ]);
    expect(filterCatalogGroups(groups, { query: '473 мл', brand: '', flavor: '', sort: 'stores' })).toEqual([
      redBull,
    ]);
    expect(filterCatalogGroups(groups, { query: 'red пятерочка', brand: '', flavor: '', sort: 'stores' })).toEqual([
      redBull,
    ]);
  });

  it('сопоставляет русские ассоциации с каноническими брендами', () => {
    const associations = [
      ['Red Bull', 'редбулл'],
      ['Burn', 'берн'],
      ['Monster', 'монстр'],
      ['Flash Up', 'флешап'],
      ['Tornado', 'торнадо'],
      ['Gorilla', 'горилла'],
      ['Jaguar', 'ягуар'],
      ['BOMBBAR', 'бомб бар'],
    ] as const;
    const groups = associations.map(([brand]) => group({ brand }));

    for (const [brand, query] of associations) {
      const result = filterCatalogGroups(groups, { query, brand: '', flavor: '', sort: 'stores' });
      expect(result.map((item) => item.brand)).toEqual([brand]);
    }
  });

  it('фильтрует по бренду и вкусу', () => {
    const groups = [group({ flavor: 'apple' }), group({ flavor: 'mango' })];
    const result = filterCatalogGroups(groups, {
      query: '',
      brand: 'Burn',
      flavor: 'mango',
      sort: 'brand',
    });

    expect(result.map((item) => item.flavor)).toEqual(['mango']);
  });

  it('показывает объём как свойство предложения, а не как фильтр', () => {
    const result = catalogOffers(
      group({
        variants: [
          { source: 'edadeal', retailer: 'Пятёрочка', volumeMl: 449, price: 100, url: '1', fetchedAt: '1' },
          { source: 'edadeal', retailer: 'Пятёрочка', volumeMl: 449, price: 90, url: '2', fetchedAt: '1' },
          { source: 'edadeal', retailer: 'Пятёрочка', volumeMl: 500, price: 120, url: '3', fetchedAt: '1' },
          { source: 'edadeal', retailer: 'Metro', volumeMl: 449, price: 80, url: '4', fetchedAt: '1' },
        ],
      }),
    );

    expect(result.map((offer) => [offer.retailer, offer.volumeMl, offer.price])).toEqual([
      ['Metro', 449, 80],
      ['Пятёрочка', 449, 90],
      ['Пятёрочка', 500, 120],
    ]);
  });

  it('показывает понятные названия новых и неопределённых вкусов', () => {
    expect(flavorName('guava')).toBe('Гуава');
    expect(flavorName('blue_raspberry')).toBe('Голубая малина');
    expect(flavorName('unknown')).toBe('Вкус не указан');
  });

  it('сортирует выгодные предложения по минимальной цене', () => {
    const groups = [group({ brand: 'A', minPrice: 120 }), group({ brand: 'B', minPrice: 70 })];
    const result = filterCatalogGroups(groups, { query: '', brand: '', flavor: '', sort: 'deals' });

    expect(result.map((item) => item.brand)).toEqual(['B', 'A']);
  });

  it('кодирует и декодирует безопасный ключ карточки', () => {
    const slug = catalogGroupSlug('Adrenaline Rush', 'strawberry');
    expect(decodeCatalogGroupSlug(slug)).toEqual({ brand: 'Adrenaline Rush', flavor: 'strawberry' });
    expect(decodeCatalogGroupSlug('invalid')).toBeNull();
  });
});
