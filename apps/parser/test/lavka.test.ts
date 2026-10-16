import { describe, expect, it } from 'vitest';
import {
  extractLavkaState,
  hasSupermarket,
  lavkaCategoryUrl,
  lavkaCity,
  lavkaLocationCookie,
  mapLavkaState,
  type LavkaGood,
  type LavkaPageState,
} from '../src/adapters/lavka.js';

const CONFIG = { brands: ['Red Bull', 'Burn', 'Tornado'], flavors: ['original'] };
const FETCHED_AT = '2026-10-16T06:00:00.000Z';
const CATALOG_KEY = 'location=37.6179,55.7557;depotType=supermarket;categoryId=energy_beer;layoutSlugKey=technical';

function good(id: string, overrides: Partial<LavkaGood> = {}): LavkaGood {
  return {
    type: 'good',
    id,
    deepLink: `good-${id}`,
    longTitle: 'Энергетический напиток Red Bull',
    amount: '250 мл',
    currentPrice: 177,
    available: true,
    snippetImage: { url: 'https://avatars.mds.yandex.net/get-grocery-goods/1/abc/{w}x{h}' },
    ...overrides,
  };
}

// Форма воспроизведена по storedehydratedstate-data страницы /supermarket/catalog/technical/category/energy_beer.
function state(goods: LavkaGood[], overrides: Partial<LavkaPageState> = {}): LavkaPageState {
  return {
    startup: { exists: true, depots: [{ isSupermarket: false }, { isSupermarket: true }] },
    products: { supermarket: goods },
    catalog: {
      data: {
        'default:energy_beer-supermarket': { data: { categories: [{ items: [{ value: { title: 'Энергетики' }, items: [{ id: 'default-only' }] }] }] } },
        [CATALOG_KEY]: {
          data: {
            categories: [{
              items: [
                { value: { title: 'Из Лавки' }, items: [{ id: 'cider' }, { id: 'red-bull' }] },
                { value: { title: 'Энергетики' }, items: [{ id: 'red-bull' }, { id: 'burn' }, { id: 'sold-out' }, { id: 'personal' }] },
                { value: { title: 'Энергетики без сахара' }, items: [{ id: 'tornado' }] },
                { value: { title: 'Безалкогольное пиво' }, items: [{ id: 'beer' }] },
              ],
            }],
          },
        },
      },
    },
    ...overrides,
  };
}

const GOODS = [
  good('red-bull'),
  good('burn', { longTitle: 'Энер­ге­тик <notr>Burn</notr> яблоко-киви', amount: '449 мл', currentPrice: 139, oldPrice: 159 }),
  good('tornado', { longTitle: 'Энергетический напиток Tornado 0,45 л', amount: '450 мл', currentPrice: 99 }),
  good('sold-out', { available: false }),
  good('personal', { currentPrice: 328, oldPrice: 339, amount: '473 мл', discountPricing: { promoLabels: { items: [{ longLabel: 'цена только для вас' }] } } }),
  good('beer', { longTitle: 'Пиво безалкогольное Clausthaler', currentPrice: 168 }),
  good('cider', { longTitle: 'Сидр безалкогольный «Из Лавки»', currentPrice: 185 }),
  good('default-only'),
];

describe('Lavka SSR page', () => {
  it('reads the dehydrated store state from the page', () => {
    const html = `<html><script id="storedehydratedstate-data" type="mime/invalid" nonce="x">${JSON.stringify(state(GOODS))}</script></html>`;
    expect(extractLavkaState(html)?.products?.supermarket).toHaveLength(GOODS.length);
    expect(extractLavkaState('<html>captcha</html>')).toBeUndefined();
    expect(extractLavkaState('<script id="storedehydratedstate-data">{broken</script>')).toBeUndefined();
  });

  it('builds the supermarket URL and the delivery-point cookie', () => {
    expect(lavkaCategoryUrl()).toBe('https://lavka.yandex.ru/supermarket/catalog/technical/category/energy_beer');
    expect(lavkaLocationCookie({ lat: 55.75, lng: 37.61 })).toBe('lastGeoCoordinate=%5B55.75%2C37.61%5D');
    expect(lavkaCity('2')?.id).toBe('saint-petersburg');
    expect(lavkaCity('999')).toBeUndefined();
  });
});

describe('mapLavkaState', () => {
  const products = mapLavkaState(state(GOODS), CONFIG, FETCHED_AT);
  const byId = new Map(products.map(product => [product.sourceId, product]));

  it('keeps only available goods from the energy subcategories', () => {
    expect([...byId.keys()].sort()).toEqual(['burn', 'personal', 'red-bull', 'tornado']);
    expect(products.every(product => product.source === 'lavka' && product.retailer === 'Яндекс Лавка')).toBe(true);
  });

  it('maps names, volume, price, link and image', () => {
    expect(byId.get('burn')).toMatchObject({
      name: 'Энергетик Burn яблоко-киви 449 мл',
      brand: 'Burn',
      volumeMl: 449,
      price: 139,
      oldPrice: 159,
      url: 'https://lavka.yandex.ru/supermarket/good/good-burn',
      imageUrl: 'https://avatars.mds.yandex.net/get-grocery-goods/1/abc/400x400',
      fetchedAt: FETCHED_AT,
    });
    expect(byId.get('red-bull')).toMatchObject({ brand: 'Red Bull', volumeMl: 250, price: 177 });
    expect(byId.get('tornado')).toMatchObject({ name: 'Энергетический напиток Tornado 0,45 л', volumeMl: 450 });
  });

  it('replaces a personal-only price with the regular one', () => {
    expect(byId.get('personal')).toMatchObject({ price: 339, oldPrice: undefined, volumeMl: 473 });
  });

  it('returns nothing for a demo catalog or a city with only the small Lavka', () => {
    const demo = state(GOODS, { startup: { exists: false, demoLavka: { location: [37.65, 55.73] } } });
    const small = state(GOODS, { startup: { exists: true, depots: [{ isSupermarket: false }] } });
    const empty = state([]);
    for (const page of [demo, small, empty]) {
      expect(hasSupermarket(page)).toBe(false);
      expect(mapLavkaState(page, CONFIG, FETCHED_AT)).toEqual([]);
    }
  });
});
