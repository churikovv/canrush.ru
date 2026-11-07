import { describe, expect, it } from 'vitest';
import {
  anchorSeries, buildSeries, canPrices, dayRows, indexView, mainVolume, monthSlice, packCount, packSlice, previousMonthOf, seriesKey, unpackSlice,
  type IndexOffer,
} from '../src/lib/price-index-fields';
import { resolveIndexFilter, type PriceIndexData } from '../src/lib/price-index';

const offer = (retailer: string, flavor: string, price: number, extra: Partial<IndexOffer> = {}): IndexOffer =>
  ({ source: 'edadeal', retailer, brand: 'Burn', flavor, volumeMl: 450, price, ...extra });
const loose = { chainMin: 1, cityMin: 1, productCities: 2, brandMin: 1, changeMin: 1, brandChangeMin: 1 };

describe('price index', () => {
  it('reads a can’s price from the offer: packs per can, the shelf from the crossed-out price, no shelf for a bare promo', () => {
    expect(packCount('Энергетический напиток Red Bull, 355мл x 24 шт')).toBe(24);
    expect(packCount('Red Bull 250мл х 12 шт')).toBe(12);
    expect(packCount('Напиток Burn 0,449 л')).toBe(1);
    expect(canPrices({ ...offer('Metro', 'mango', 2400), name: 'Burn 450мл x 24 шт' })).toEqual({ paid: 100, shelf: 100, promo: false });
    expect(canPrices(offer('Магнит', 'mango', 90, { oldPrice: 120 }))).toEqual({ paid: 90, shelf: 120, promo: true });
    expect(canPrices(offer('Магнит', 'mango', 90, { promoEndsAt: '2026-11-10' }))).toEqual({ paid: 90, shelf: null, promo: true });
    expect(canPrices(offer('Metro', 'mango', 3000))).toBeNull();
    expect(canPrices({ ...offer('Metro', 'mango', 100), brand: 'unknown' })).toBeNull();
    expect(canPrices({ ...offer('Metro', 'mango', 100), volumeMl: 2000 })).toBeNull();
    // The same position twice a day counts once, at the lower price.
    expect(dayRows('moscow', [offer('A', 'cherry', 95), offer('A', 'cherry', 90)]).map(row => row.paid)).toEqual([90]);
    expect(mainVolume([{ volumeMl: 449 }, { volumeMl: 450 }, { volumeMl: 250 }])).toBe(450);
  });

  const days = (month: string, list: [string, IndexOffer[]][]) => ['01', '02'].map(day => ({ day: `${month}-${day}`, rows: list.flatMap(([city, offers]) => dayRows(city, offers)) }));
  const october = monthSlice('2026-10', days('2026-10', [
    ['moscow', [offer('A', 'mango', 100), offer('B', 'mango', 110), offer('A', 'cherry', 90), { ...offer('A', 'original', 160), brand: 'Red Bull', volumeMl: 250 }]],
    ['kazan', [offer('A', 'mango', 120), offer('B', 'mango', 120), offer('A', 'cherry', 100)]],
  ]));
  const november = monthSlice('2026-11', days('2026-11', [
    // Chain A raises mango by 10%; B lists it on promo with the old shelf price.
    ['moscow', [offer('A', 'mango', 110), offer('B', 'mango', 99, { oldPrice: 110 }), offer('A', 'cherry', 90), { ...offer('A', 'original', 160), brand: 'Red Bull', volumeMl: 250 }]],
    ['kazan', [offer('A', 'mango', 120), { ...offer('B', 'mango', 2880), name: 'Burn 450мл x 24 шт' }, offer('A', 'cherry', 100)]],
  ]));

  it('sums a month and keeps it through the file', () => {
    expect(november).toMatchObject({ month: '2026-11', days: ['2026-11-01', '2026-11-02'], cityDays: { moscow: 2, kazan: 2 } });
    // Prices keep kopecks and the discount a tenth of a percent through the file.
    expect(unpackSlice(JSON.parse(JSON.stringify(packSlice(november))))).toEqual({ ...november, positions: november.positions.map(position => ({ ...position, discount: position.discount === null ? null : Math.round(position.discount * 1000) / 1000 })) });
  });

  it('shows the country, a city or a brand: typical can, change on the same positions, cities and chains on the shelf', () => {
    const all = indexView(november, october, {}, loose)!;
    expect(all).toMatchObject({ month: '2026-11', previousMonth: '2026-10', days: 2, positions: 7, cityCount: 2, volumeMl: 450, can: { shelf: 110, paid: 105 } });
    // On the shelf only A's mango moved (+10% of seven positions); paid, B's promo cancels it.
    expect(all.change).toEqual({ shelf: 1.4, paid: -0.1, matched: 7 });
    expect(all.cities.map(city => city.city)).toEqual(['moscow', 'kazan']);
    expect(all.promo.discount).toBe(10);
    // Red Bull alone: its own can (0,25) and price; cities still compare (only Moscow has it — not enough of them).
    const redBull = indexView(november, october, { brand: 'red bull' }, loose)!;
    expect(redBull).toMatchObject({ volumeMl: 250, can: { shelf: 160, paid: 160 }, positions: 1, cities: [] });
    // Kazan: its chains, and brands of Kazan only.
    const kazan = indexView(november, october, { city: 'kazan' }, loose)!;
    expect(kazan.chains.map(chain => chain.retailer).sort()).toEqual(['A', 'B']);
    expect(kazan.brands.map(brand => brand.brand)).toEqual(['Burn']);
    expect(indexView(november, october, { city: 'omsk' }, loose)).toBeNull();
    expect(previousMonthOf('2026-01')).toBe('2025-12');
  });

  it('draws a chain index day by day: same positions only, a missed day does not break it', () => {
    const day = (date: string, prices: number[], cities = ['moscow']) => ({ day: date, rows: cities.flatMap(city => dayRows(city, prices.map((price, index) => offer(`S${index}`, 'mango', price)))) });
    const series = buildSeries([
      day('2026-10-01', [100, 100, 100, 100, 100]),
      day('2026-10-02', [110, 110, 110, 110, 110]),
      // A new shop at 300 joins: the line does not jump; from then on its unchanged price counts like the others.
      day('2026-10-03', [110, 110, 110, 110, 110, 300]),
      day('2026-10-05', [121, 121, 121, 121, 121, 300]),
    ]);
    expect(series[seriesKey({})]).toEqual({ volumeMl: 450, points: [['2026-10-01', 100, 100], ['2026-10-02', 110, 110], ['2026-10-03', 110, 110], ['2026-10-05', 119.09, 119.09]] });
    expect(Object.keys(series).sort()).toEqual(['all', 'brand:burn', 'city:moscow', 'city:moscow|brand:burn']);
    expect(buildSeries([day('2026-10-01', [100, 100]), day('2026-10-02', [100, 100])])).toEqual({});
    // On the card's level: the month's average point becomes the month's typical can.
    expect(anchorSeries({ volumeMl: 450, points: [['2026-10-31', 90, 80], ['2026-11-01', 100, 90], ['2026-11-02', 110, 110]] }, '2026-11', { shelf: 210, paid: 200 }).points)
      .toEqual([['2026-10-31', 180, 160], ['2026-11-01', 200, 180], ['2026-11-02', 220, 220]]);
  });

  it('reads the search: a city or a brand in any spelling becomes the filter, other text narrows the lists', () => {
    const data = { cities: ['moscow', 'kazan'], brands: ['Burn', 'Red Bull'] } as PriceIndexData;
    expect(resolveIndexFilter({ q: 'Казань' }, data)).toEqual({ filter: { city: 'kazan' }, query: '' });
    expect(resolveIndexFilter({ q: 'берн', city: 'moscow' }, data)).toEqual({ filter: { city: 'moscow', brand: 'Burn' }, query: '' });
    expect(resolveIndexFilter({ q: 'Пятёрочка', brand: 'red bull', city: 'omsk' }, data)).toEqual({ filter: { brand: 'Red Bull' }, query: 'Пятёрочка' });
  });
});
