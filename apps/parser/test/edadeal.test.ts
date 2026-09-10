import { describe, expect, it } from 'vitest';
import {
  batchBrandEntities,
  KNOWN_LOCALITIES,
  mapEdadealResponse,
  resolveLocality,
  type EdadealSearchResponse,
} from '../src/adapters/edadeal.js';

const MOSCOW = KNOWN_LOCALITIES['213']!;
const BRANDS = ['Red Bull', 'Adrenaline Rush', 'Flash Up', 'Burn', 'BOMBBAR'];
const BRAND_ALIASES = { 'Red Bull': ['Ред Булл'], BOMBBAR: ['Бомббар'] };
const BRAND_BY_UUID = new Map([
  ['flash', 'Flash up'],
  ['red-bull', 'Red Bull'],
  ['bombbar', 'BOMBBAR'],
]);
const FETCHED_AT = '2026-09-01T10:00:00.000Z';

// Форма ответа воспроизведена по реальному ответу search.edadeal.io (цены — в копейках).
const SAMPLE: EdadealSearchResponse = {
  total: 600,
  items: [
    {
      itemType: 'sku',
      uuid: 'sku-1',
      title: 'Энергетический напиток Flash Up Energy Банан-Фейхоа 450мл',
      items: [
        {
          itemType: 'meta_offer',
          uuid: 'meta-magnit',
          title: 'Энергетический напиток Flash Up Energy Банан-Фейхоа 450мл',
          brandUuid: 'flash',
          partner: { name: 'Магнит', slug: 'magnit' },
          priceData: { new: { type: 'range', from: 4699, to: 4999 } },
          quantity: 450,
          quantityUnit: 'мл',
          dateStart: 1788134400000,
          dateEnd: 1789430400000,
          imageUrl: 'https://leonardo.edadeal.io/img/1',
          offerUuids: ['offer-a', 'offer-b'],
        },
        {
          itemType: 'meta_offer',
          uuid: 'meta-5ka',
          title: 'Напиток энергетический Flash Up Банан-фейхоа',
          partner: { name: 'Пятёрочка', slug: '5ka' },
          priceData: { new: { type: 'value', value: 6700 }, old: { type: 'value', value: 9800 } },
          quantity: 0.45,
          quantityUnit: 'л',
          dateStart: 1788134400000,
          offerUuids: ['offer-c'],
        },
      ],
    },
    {
      itemType: 'meta_offer',
      uuid: 'meta-bristol',
      title: 'Энергетический Б/А Напиток Red Bull Blue Edition Ж/Б 0,355Л',
      brandUuid: 'red-bull',
      partner: { name: 'Бристоль' },
      priceData: { new: { type: 'value', value: 13499 }, old: { type: 'value', value: 12000 } },
      quantity: 355,
      quantityUnit: 'г',
      dateEnd: 1789430400000,
    },
    {
      itemType: 'meta_offer',
      uuid: 'meta-juice',
      title: 'Сок яблочный J7 0,3 л',
      partner: { name: 'Перекрёсток' },
      priceData: { new: { type: 'value', value: 5990 } },
    },
    {
      itemType: 'meta_offer',
      uuid: 'meta-isotonic',
      title: 'Напиток Bombbar Isotonic Лесные ягоды, 500мл',
      brandUuid: 'bombbar',
      partner: { name: 'Metro' },
      priceData: { new: { type: 'value', value: 9900 } },
    },
    {
      itemType: 'meta_offer',
      uuid: 'meta-no-price',
      title: 'Энергетик Burn без цены',
      partner: { name: 'Дикси' },
      priceData: {},
    },
  ],
};

describe('mapEdadealResponse', () => {
  const products = mapEdadealResponse(
    SAMPLE,
    { brands: BRANDS, brandAliases: BRAND_ALIASES, keywords: ['энергетик'] },
    MOSCOW,
    FETCHED_AT,
    BRAND_BY_UUID,
  );

  it('разворачивает SKU-группы в офферы по сетям и отсекает не-энергетики и офферы без цены', () => {
    expect(products.map((p) => p.sourceId)).toEqual(['meta-magnit', 'meta-5ka', 'meta-bristol']);
    expect(products.every((p) => p.source === 'edadeal')).toBe(true);
    expect(products.every((p) => p.brand !== undefined)).toBe(true);
  });

  it('переводит копейки в рубли, из диапазона берёт минимум', () => {
    const magnit = products.find((p) => p.sourceId === 'meta-magnit')!;
    expect(magnit.price).toBe(46.99);
    expect(magnit.oldPrice).toBeUndefined();
    expect(magnit.retailer).toBe('Магнит');
  });

  it('заполняет oldPrice только если старая цена выше новой', () => {
    const fiveKa = products.find((p) => p.sourceId === 'meta-5ka')!;
    expect(fiveKa.price).toBe(67);
    expect(fiveKa.oldPrice).toBe(98);

    const bristol = products.find((p) => p.sourceId === 'meta-bristol')!;
    expect(bristol.price).toBe(134.99);
    expect(bristol.oldPrice).toBeUndefined();
  });

  it('определяет объём из названия, а при его отсутствии — из quantity в мл/л (граммы игнорирует)', () => {
    const magnit = products.find((p) => p.sourceId === 'meta-magnit')!;
    expect(magnit.volumeMl).toBe(450);
    const fiveKa = products.find((p) => p.sourceId === 'meta-5ka')!;
    expect(fiveKa.volumeMl).toBe(450);
    const bristol = products.find((p) => p.sourceId === 'meta-bristol')!;
    expect(bristol.volumeMl).toBe(355); // из «0,355Л» в названии, а не из quantityUnit «г»
  });

  it('определяет бренд, срок акции и собирает ссылку на поиск Едадила', () => {
    const magnit = products.find((p) => p.sourceId === 'meta-magnit')!;
    expect(magnit.brand).toBe('Flash Up');
    expect(magnit.promoEndsAt).toBe(new Date(1789430400000).toISOString());
    expect(magnit.url).toBe(
      'https://edadeal.ru/moskva/search?text=' + encodeURIComponent('Энергетический напиток Flash Up Energy Банан-Фейхоа 450мл').replace(/%20/g, '+'),
    );
    expect(magnit.imageUrl).toBe('https://leonardo.edadeal.io/img/1');
    expect(magnit.fetchedAt).toBe(FETCHED_AT);

    const fiveKa = products.find((p) => p.sourceId === 'meta-5ka')!;
    expect(fiveKa.promoEndsAt).toBeUndefined();

    const bristol = products.find((p) => p.sourceId === 'meta-bristol')!;
    expect(bristol.url).toBe(
      'https://edadeal.ru/moskva/search?text=' + encodeURIComponent('Энергетический Б/А Напиток Red Bull Blue Edition Ж/Б 0,355Л').replace(/%20/g, '+'),
    );
    expect(bristol.brand).toBe('Red Bull');
  });

  it('сохраняет неизвестный канонический бренд из справочника API', () => {
    const result = mapEdadealResponse(
      {
        items: [
          {
            itemType: 'meta_offer',
            uuid: 'meta-bizon',
            title: 'Энергетический напиток Bizon 450 мл',
            brandUuid: 'bizon',
            priceData: { new: { type: 'value', value: 7500 } },
          },
        ],
      },
      { brands: BRANDS, keywords: ['энергетик'] },
      MOSCOW,
      FETCHED_AT,
      new Map([['bizon', 'Bizon']]),
    );
    expect(result[0]?.brand).toBe('Bizon');
  });

  it('возвращает пустой массив на пустом ответе', () => {
    expect(mapEdadealResponse({}, {}, MOSCOW, FETCHED_AT)).toEqual([]);
  });
});

describe('batchBrandEntities', () => {
  it('разбивает бренды так, чтобы сумма count не превышала лимит', () => {
    const batches = batchBrandEntities(
      [
        { uuid: 'a', name: 'A', count: 288 },
        { uuid: 'b', name: 'B', count: 278 },
        { uuid: 'c', name: 'C', count: 269 },
        { uuid: 'd', name: 'D', count: 224 },
        { uuid: 'e', name: 'E', count: 1 },
      ],
      500,
    );
    expect(batches.map((batch) => batch.map((brand) => brand.uuid))).toEqual([['a'], ['b'], ['c', 'd', 'e']]);
  });
});

describe('resolveLocality', () => {
  it('по умолчанию — Москва', () => {
    expect(resolveLocality(undefined)).toEqual(MOSCOW);
    expect(resolveLocality('')).toEqual(MOSCOW);
  });

  it('знает Санкт-Петербург', () => {
    expect(resolveLocality('2').slug).toBe('sankt-peterburg');
  });

  it('для неизвестного geoid сохраняет geoid, но ссылки строит на слаг Москвы', () => {
    const spb = resolveLocality('54');
    expect(spb.geoId).toBe('54');
    expect(spb.slug).toBe('moskva');
  });
});

describe('expired offer filtering', () => {
  it('отсекает офферы с dateEnd в прошлом', () => {
    const pastTimestamp = new Date('2026-08-01').getTime();
    const result = mapEdadealResponse(
      {
        items: [
          {
            itemType: 'meta_offer',
            uuid: 'meta-expired',
            title: 'Энергетический напиток Burn 450 мл',
            partner: { name: 'Дикси' },
            priceData: { new: { type: 'value', value: 5000 } },
            dateEnd: pastTimestamp,
          },
          {
            itemType: 'meta_offer',
            uuid: 'meta-active',
            title: 'Энергетический напиток Burn 450 мл',
            partner: { name: 'Пятёрочка' },
            priceData: { new: { type: 'value', value: 6000 } },
            dateEnd: new Date('2026-12-31').getTime(),
          },
        ],
      },
      { brands: BRANDS, keywords: ['энергетик'] },
      MOSCOW,
      FETCHED_AT,
    );
    expect(result.map((p) => p.sourceId)).toEqual(['meta-active']);
  });

  it('оставляет офферы без dateEnd (бессрочные)', () => {
    const result = mapEdadealResponse(
      {
        items: [
          {
            itemType: 'meta_offer',
            uuid: 'meta-no-end',
            title: 'Энергетический напиток Burn 450 мл',
            partner: { name: 'Магнит' },
            priceData: { new: { type: 'value', value: 5000 } },
          },
        ],
      },
      { brands: BRANDS, keywords: ['энергетик'] },
      MOSCOW,
      FETCHED_AT,
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.sourceId).toBe('meta-no-end');
  });
});
