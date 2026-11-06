import { distanceKm, findCity } from '@canrush/shared';

/** Server-side HTTP Geocoder: its key (`YANDEX_GEOCODER_API_KEY`) never reaches the browser. */
export interface StoreGeocode { latitude: number; longitude: number; address: string; precise: boolean }
const ENDPOINT = 'https://geocode-maps.yandex.ru/1.x/';

export function hasStoreGeocoder() {
  return Boolean(process.env.YANDEX_GEOCODER_API_KEY?.trim());
}

/**
 * First result of the answer, only if it lies within 100 km of the selected city (same rule as `parseStore`). Precision
 * `other` means no street was recognised: the geocoder falls back to the city, and that is not a store's point.
 */
export function parseGeocoderResponse(body: unknown, cityId: string): StoreGeocode | null {
  const city = findCity(cityId);
  const object = (body as { response?: { GeoObjectCollection?: { featureMember?: { GeoObject?: {
    Point?: { pos?: string };
    metaDataProperty?: { GeocoderMetaData?: { text?: string; precision?: string } };
  } }[] } } })?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
  const [longitude, latitude] = (object?.Point?.pos ?? '').split(' ').map(Number);
  if (!city || latitude === undefined || longitude === undefined || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (distanceKm(latitude, longitude, city) > 100) return null;
  const meta = object?.metaDataProperty?.GeocoderMetaData;
  if (meta?.precision === 'other') return null;
  return { latitude, longitude, address: meta?.text ?? '', precise: ['exact', 'number', 'near'].includes(meta?.precision ?? '') };
}

export async function geocodeStoreAddress(cityId: string, address: string): Promise<StoreGeocode | null> {
  const key = process.env.YANDEX_GEOCODER_API_KEY?.trim();
  const city = findCity(cityId);
  const query = address.trim();
  if (!key || !city || query.length < 3 || query.length > 300) return null;
  const params = new URLSearchParams({ apikey: key, geocode: `${city.name}, ${query}`, format: 'json', results: '1', lang: 'ru_RU', ll: `${city.lng},${city.lat}`, spn: '2.4,1.4' });
  const response = await fetch(`${ENDPOINT}?${params}`, { signal: AbortSignal.timeout(5000), cache: 'no-store' });
  if (!response.ok) throw new Error(`Geocoder HTTP ${response.status}`);
  return parseGeocoderResponse(await response.json(), city.id);
}

const normalized = (value: string) => value.toLocaleLowerCase('ru-RU').replaceAll('ё', 'е');

/** The first object of an answer, flattened; null when it has no point. */
function firstObject(body: unknown) {
  const object = (body as { response?: { GeoObjectCollection?: { featureMember?: { GeoObject?: {
    Point?: { pos?: string };
    metaDataProperty?: { GeocoderMetaData?: { text?: string; precision?: string; Address?: { country_code?: string } } };
  } }[] } } })?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
  const [longitude, latitude] = (object?.Point?.pos ?? '').split(' ').map(Number);
  const meta = object?.metaDataProperty?.GeocoderMetaData;
  if (latitude === undefined || longitude === undefined || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude, text: meta?.text ?? '', precision: meta?.precision ?? '', country: meta?.Address?.country_code ?? null };
}
const namesCity = (found: { text: string; country: string | null }, city: string) =>
  (!found.country || found.country === 'RU') && normalized(found.text).includes(normalized(city.trim()));

/**
 * The address answer for a city outside the site's list: it has to name the city and a street in Russia — the
 * geocoder otherwise falls back to some other place.
 */
export function parseAnywhereResponse(body: unknown, city: string): StoreGeocode | null {
  const found = firstObject(body);
  if (!found || !found.text || found.precision === 'other' || !namesCity(found, city)) return null;
  return { latitude: found.latitude, longitude: found.longitude, address: found.text, precise: ['exact', 'number', 'near'].includes(found.precision) };
}

/**
 * A city outside the site's list (a company's point of sale in Тула): first the city itself, then the address only
 * inside a box around it. Asked as one line, the geocoder drops the city — «Тула, Привокзальная площадь, 1» came back
 * from Волгоград.
 */
export async function geocodeAnywhere(city: string, address: string): Promise<StoreGeocode | null> {
  const key = process.env.YANDEX_GEOCODER_API_KEY?.trim();
  const query = address.trim();
  if (!key || city.trim().length < 2 || query.length < 3 || query.length > 300) return null;
  const ask = async (params: Record<string, string>) => {
    const response = await fetch(`${ENDPOINT}?${new URLSearchParams({ apikey: key, format: 'json', results: '1', lang: 'ru_RU', ...params })}`, { signal: AbortSignal.timeout(5000), cache: 'no-store' });
    if (!response.ok) throw new Error(`Geocoder HTTP ${response.status}`);
    return response.json() as Promise<unknown>;
  };
  const center = firstObject(await ask({ geocode: `Россия, ${city.trim()}`, kind: 'locality' }));
  if (!center || !namesCity(center, city)) return null;
  return parseAnywhereResponse(await ask({ geocode: `${city.trim()}, ${query}`, ll: `${center.longitude},${center.latitude}`, spn: '0.6,0.4', rspn: '1' }), city);
}
