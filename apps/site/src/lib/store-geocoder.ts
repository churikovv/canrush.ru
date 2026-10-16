import { distanceKm, findCity } from '@canrush/shared';

/** Server-side HTTP Geocoder: its key (`YANDEX_GEOCODER_API_KEY`) never reaches the browser. */
export interface StoreGeocode { latitude: number; longitude: number; address: string; precise: boolean }
const ENDPOINT = 'https://geocode-maps.yandex.ru/1.x/';

export function hasStoreGeocoder() {
  return Boolean(process.env.YANDEX_GEOCODER_API_KEY?.trim());
}

/** First result of the answer, only if it lies within 100 km of the selected city (same rule as `parseStore`). */
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
