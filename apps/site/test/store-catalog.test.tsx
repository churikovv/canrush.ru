import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
vi.mock('@/lib/catalog', () => ({ loadAllCatalogGroups: async () => [
  { brand: 'Monster', flavor: 'monster_ultra_white', variants: [], minPrice: 0, coverImageUrl: '/images/monster.jpg' },
  { brand: 'Monster', flavor: 'unresolved:abc', variants: [], minPrice: 0 },
  { brand: 'unknown', flavor: 'original', variants: [], minPrice: 0 },
] }));
const { linkStoreCatalog, storeDrinkOptions, withCatalogLinks } = await import('@/lib/store-catalog');
const { StoreCard, StoreMapPopup, storeStations } = await import('@/components/store-card');
import type { Store } from '@/lib/stores';
import { METRO } from '@/lib/store-fields';
const PUSHKIN = METRO.moscow!.find(s => s.name === 'Пушкинская')!;
const FAR = METRO.moscow!.find(s => s.name === 'Новокосино')!;

const store: Store = { id: '00000000-0000-4000-8000-000000000001', ownerId: '', name: 'Энергия', city: 'moscow', address: 'Тверская, 1', latitude: PUSHKIN.lat + 0.0005, longitude: PUSHKIN.lng, locationSource: 'geocoded', metro: null, description: '', status: 'published', moderationNote: '', updatedAt: new Date('2026-10-01'), reviewedAt: null, photos: [],
  catalog: [{ name: 'Monster · Ultra White', price: 15900, availability: 'available', brand: 'Monster', flavor: 'monster_ultra_white' }, { name: 'Местный', price: 9900, availability: 'available' }] };

it('offers only resolved catalog drinks with readable names', async () => {
  expect(await storeDrinkOptions()).toEqual([{ brand: 'Monster', flavor: 'monster_ultra_white', label: 'Monster · Ultra White', cover: '/images/monster.jpg' }]);
});
it('renames linked drinks canonically and turns unknown links into custom drinks', async () => {
  expect(await linkStoreCatalog([
    { name: 'monster white', price: null, availability: 'unknown', brand: 'Monster', flavor: 'monster_ultra_white' },
    { name: 'Подделка', price: 100, availability: 'available', brand: 'Fake', flavor: 'none' },
  ])).toEqual([
    { name: 'Monster · Ultra White', price: null, availability: 'unknown', brand: 'Monster', flavor: 'monster_ultra_white' },
    { name: 'Подделка', price: 100, availability: 'available' },
  ]);
});
it('renders metro with lines, catalog links and the map popup', async () => {
  const [view] = await withCatalogLinks([store]);
  expect(view!.catalog[0]).toMatchObject({ href: expect.stringMatching(/^\/catalog\//), cover: '/images/monster.jpg' });
  expect(view!.catalog[1]!.href).toBeUndefined();
  expect(storeStations(view!)[0]?.name).toBe('Пушкинская');
  const card = renderToStaticMarkup(createElement(StoreCard, { store: view!, index: 0 }));
  expect(card).toContain('Пушкинская');
  expect(card).toContain(`href="/market/stores/${store.id}"`);
  expect(card).toContain(`href="${view!.catalog[0]!.href}"`);
  expect(card).toContain('Свой напиток');
  const popup = renderToStaticMarkup(createElement(StoreMapPopup, { store: view!, index: 2, onClose: () => {} }));
  expect(popup).toContain('2 напитка');
  expect(popup).toMatch(/от <strong>99/);
  expect(popup).toContain('Подробнее');
});
it('shows the chosen station first even when it is not the nearest', () => {
  const groups = storeStations({ ...store, metro: FAR.id });
  expect(groups.map(group => [group.name, group.km])).toEqual([['Новокосино', null], ['Пушкинская', expect.any(Number)]]);
  expect(storeStations({ ...store, latitude: null, longitude: null })).toEqual([]);
});
