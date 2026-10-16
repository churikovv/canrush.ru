import { afterEach, expect, it, vi } from 'vitest';
import { geocodeStoreAddress, hasStoreGeocoder, parseGeocoderResponse } from '@/lib/store-geocoder';

const answer = (pos: string, precision = 'exact') => ({ response: { GeoObjectCollection: { featureMember: [{ GeoObject: {
  Point: { pos }, metaDataProperty: { GeocoderMetaData: { text: 'Россия, Москва, Тверская улица, 18к1', precision } },
} }] } } });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it('reads "lng lat" and keeps only points near the selected city', () => {
  expect(parseGeocoderResponse(answer('37.6052 55.7658'), 'moscow')).toEqual({ latitude: 55.7658, longitude: 37.6052, address: 'Россия, Москва, Тверская улица, 18к1', precise: true });
  expect(parseGeocoderResponse(answer('37.6052 55.7658', 'street'), 'moscow')?.precise).toBe(false);
  expect(parseGeocoderResponse(answer('30.3 59.9'), 'moscow')).toBeNull();
  expect(parseGeocoderResponse({ response: { GeoObjectCollection: { featureMember: [] } } }, 'moscow')).toBeNull();
  expect(parseGeocoderResponse(null, 'moscow')).toBeNull();
});
it('asks the HTTP Geocoder with the server key only', async () => {
  vi.stubEnv('YANDEX_GEOCODER_API_KEY', '');
  expect(hasStoreGeocoder()).toBe(false);
  expect(await geocodeStoreAddress('moscow', 'Тверская, 18')).toBeNull();
  vi.stubEnv('YANDEX_GEOCODER_API_KEY', 'test-key');
  const fetch = vi.fn(async () => new Response(JSON.stringify(answer('37.6052 55.7658'))));
  vi.stubGlobal('fetch', fetch);
  expect(await geocodeStoreAddress('moscow', 'Тверская, 18')).toMatchObject({ latitude: 55.7658 });
  const url = new URL(String((fetch.mock.calls[0] as unknown[])[0]));
  expect(url.origin + url.pathname).toBe('https://geocode-maps.yandex.ru/1.x/');
  expect(url.searchParams.get('geocode')).toBe('Москва, Тверская, 18');
  expect(url.searchParams.get('apikey')).toBe('test-key');
  fetch.mockResolvedValueOnce(new Response('{}', { status: 403 }));
  await expect(geocodeStoreAddress('moscow', 'Тверская, 18')).rejects.toThrow('403');
});
