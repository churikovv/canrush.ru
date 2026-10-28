import { describe, expect, it } from 'vitest';
import type { CatalogGroup, WholesaleOffer } from '@canrush/shared';
import { packagingOf, wholesaleRows } from '../src/lib/wholesale';

const offer = (fields: Partial<WholesaleOffer>): WholesaleOffer => ({
  source: 'napolke', sourceId: 'x', name: 'Напиток энергетический Burn манго 449 мл., ж/б', brand: 'Burn', flavor: 'mango', volumeMl: 449,
  price: 87.5, packSize: 12, supplier: 'Опт', suppliers: 2, url: 'https://napolke.ru/p', ...fields,
});
const group = { brand: 'Burn', flavor: 'mango', coverImageUrl: '/images/burn.jpg', minPrice: 99, variants: [
  { price: 129.99, volumeMl: 450 }, { price: 99, volumeMl: 250 }, { price: 109.99, volumeMl: 449 },
] } as unknown as CatalogGroup;

describe('wholesale rows', () => {
  it('matches the catalog card and compares with the cheapest shop price of the same can', () => {
    const [row] = wholesaleRows([offer({})], [group]);
    expect(row).toMatchObject({ title: 'Burn · Манго', slug: expect.any(String), cover: '/images/burn.jpg', retail: 109.99, markup: 26, packaging: 'can' });
  });

  it('leaves unknown drinks and bottles without a shop comparison', () => {
    const [unknown, bottle] = wholesaleRows([
      offer({ name: 'Напиток энергетический Power Torr Navy 500 мл., ПЭТ', brand: undefined, flavor: undefined }),
      offer({ name: 'Напиток энергетический Burn манго 449 мл., ПЭТ' }),
    ], [group]);
    expect(unknown).toMatchObject({ title: 'Power Torr Navy 500 мл., ПЭТ', slug: null, retail: null, markup: null });
    expect(bottle).toMatchObject({ packaging: 'pet', retail: null, markup: null, slug: expect.any(String) });
  });

  it('marks the cheapest of the same can across sources', () => {
    const rows = wholesaleRows([
      offer({ sourceId: 'a', price: 87.5 }),
      offer({ source: 'otlichnye', sourceId: 'b', name: 'Burn Манго ж/б 0.45 л', volumeMl: 450, price: 84.3 }),
      offer({ sourceId: 'c', name: 'Burn манго 449 мл., ПЭТ', price: 50 }),
    ], [group]);
    expect(rows.map(row => [row.others, row.cheapest])).toEqual([[1, false], [1, true], [0, false]]);
    // A cheaper offer out of stock does not take «Дешевле всего».
    const stock = wholesaleRows([offer({ sourceId: 'a', price: 87.5 }), offer({ source: 'esweets', sourceId: 'd', price: 60, inStock: false })], [group]);
    expect(stock.map(row => [row.others, row.cheapest])).toEqual([[0, false], [0, false]]);
  });

  it('reads the packaging from the title', () => {
    expect(packagingOf('Monster 500 мл., ж/б')).toBe('can');
    expect(packagingOf('Power Torr 1 л., ПЭТ')).toBe('pet');
    expect(packagingOf('Напиток 0,33 л., стекло')).toBe('glass');
    expect(packagingOf('Tornado Petrol 450 мл')).toBe('can');
  });
});
