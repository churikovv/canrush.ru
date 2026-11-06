import { describe, expect, it } from 'vitest';
import { parsePoint, plural, pointCities, PointError, siteCity, yandexMapsHref } from '../src/lib/business-point-fields';
import { parseAnywhereResponse } from '../src/lib/store-geocoder';

const form = (fields: Record<string, string | string[]>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) for (const item of [value].flat()) data.append(name, item);
  return data;
};
const base = { name: '  Магазин   у дома ', kind: 'store', city: 'москва', address: 'ул. Ленина,  12' };

describe('business points', () => {
  it('reads the form: trims, takes the site city by name, keeps drinks once', () => {
    expect(parsePoint(form({ ...base, hours: '', note: 'Вход со двора', drink: [JSON.stringify(['Burn', 'mango']), JSON.stringify(['Burn', 'mango']), 'not json', JSON.stringify([1, 2])] })))
      .toEqual({ name: 'Магазин у дома', kind: 'store', city: 'Москва', address: 'ул. Ленина, 12', hours: null, note: 'Вход со двора', drinks: [{ brand: 'Burn', flavor: 'mango' }] });
    // A city outside the site's list stays as written.
    expect(parsePoint(form({ ...base, city: 'Тула' })).city).toBe('Тула');
    expect(siteCity('САНКТ-ПЕТЕРБУРГ')?.id).toBe('saint-petersburg');
    expect(siteCity('Тула')).toBeUndefined();
  });

  it('says what is missing', () => {
    expect(() => parsePoint(form({ ...base, name: ' ' }))).toThrow(PointError);
    expect(() => parsePoint(form({ ...base, kind: 'bar' }))).toThrow('Выберите, что это за точка.');
    expect(() => parsePoint(form({ ...base, city: '1' }))).toThrow('Укажите город.');
    expect(() => parsePoint(form({ ...base, address: 'ул' }))).toThrow('Укажите адрес: улицу и номер дома.');
    expect(() => parsePoint(form({ ...base, hours: 'x'.repeat(81) }))).toThrow('Часы работы — до 80 символов.');
  });

  it('orders the city switch: the visitor’s city first, then by points', () => {
    const points = [{ city: 'Тула' }, { city: 'Москва' }, { city: 'Тула' }, { city: 'Казань' }];
    expect(pointCities(points, 'Москва')).toEqual([{ city: 'Москва', count: 1 }, { city: 'Тула', count: 2 }, { city: 'Казань', count: 1 }]);
    expect(pointCities(points).map(item => item.city)).toEqual(['Тула', 'Казань', 'Москва']);
    expect(yandexMapsHref({ latitude: 54.19, longitude: 37.61 })).toBe('https://yandex.ru/maps/?pt=37.61,54.19&z=17&l=map');
    expect([1, 3, 5, 11, 22].map(count => plural(count, 'точка', 'точки', 'точек'))).toEqual(['точка', 'точки', 'точек', 'точек', 'точки']);
  });

  it('takes a geocoder answer outside the site cities only when it names the city and a street in Russia', () => {
    const answer = (text: string, precision = 'exact', country = 'RU') => ({ response: { GeoObjectCollection: { featureMember: [{ GeoObject: {
      Point: { pos: '37.617 54.193' }, metaDataProperty: { GeocoderMetaData: { text, precision, Address: { country_code: country } } },
    } }] } } });
    expect(parseAnywhereResponse(answer('Россия, Тульская область, Тула, проспект Ленина, 12'), 'Тула'))
      .toEqual({ latitude: 54.193, longitude: 37.617, address: 'Россия, Тульская область, Тула, проспект Ленина, 12', precise: true });
    expect(parseAnywhereResponse(answer('Россия, Москва, улица Ленина'), 'Тула')).toBeNull();
    expect(parseAnywhereResponse(answer('Россия, Тула', 'other'), 'Тула')).toBeNull();
    expect(parseAnywhereResponse(answer('Беларусь, Тула', 'exact', 'BY'), 'Тула')).toBeNull();
    expect(parseAnywhereResponse({}, 'Тула')).toBeNull();
  });
});
