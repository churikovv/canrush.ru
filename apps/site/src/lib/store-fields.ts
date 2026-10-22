import { findCity, distanceKm } from '@canrush/shared';
import metroData from './stores/metro.json';
/** Metro, МЦК and МЦД stations from api.hh.ru/metro (`npm -w apps/site run metro:update`). */
export interface MetroStation { id: string; name: string; line: string; color: string; lat: number; lng: number }
export const METRO = metroData as Record<string, MetroStation[]>;
/** XP for a store that passes moderation, once per store and for up to 20 stores (migration 0089 pays it). */
export const STORE_XP = 75;
export type StockStatus = 'available' | 'unavailable' | 'unknown';
export type LocationSource = 'manual' | 'geocoded';
/** `brand`+`flavor` link the drink to a catalog group; without them it is a drink the author typed in. */
export interface StoreItem { name: string; price: number | null; availability: StockStatus; brand?: string; flavor?: string }
export interface StoreInput { name: string; city: string; address: string; latitude: number | null; longitude: number | null; locationSource: LocationSource | null; metro: string | null; description: string; catalog: StoreItem[] }
export class StoreError extends Error {}
/** Automatic nearest station only when it is within walking distance. */
export const NEAREST_METRO_KM = 2;
function text(form: FormData, key: string, max: number, required = true) {
  const raw = form.get(key); const value = typeof raw === 'string' ? raw.trim() : '';
  if ((required && !value) || value.length > max) throw new StoreError(`Проверьте поле «${({name:'Название',address:'Адрес',description:'Описание'} as Record<string,string>)[key] ?? key}».`);
  return value;
}
export function stationDistanceKm(lat: number, lng: number, station: Pick<MetroStation,'lat'|'lng'>) {
  const rad = Math.PI / 180, dLat = (station.lat - lat) * rad, dLng = (station.lng - lng) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * rad) * Math.cos(station.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
}
/** Closest stations, nearest first (metro, МЦК and МЦД alike; transfer stations give one entry per line). */
export function nearestStations(city: string, lat: number, lng: number, limit = 3, maxKm = NEAREST_METRO_KM) {
  return (METRO[city] ?? []).map(station => ({ station, km: stationDistanceKm(lat, lng, station) }))
    .filter(item => item.km <= maxKm).sort((a, b) => a.km - b.km).slice(0, limit);
}
export function formatDistance(km: number) {
  return km < 1 ? `${Math.max(10, Math.round(km * 100) * 10)} м` : `${km.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} км`;
}
export function parseStore(form: FormData): StoreInput {
  const city = findCity(form.get('city'));
  if (!city) throw new StoreError('Выберите город из списка.');
  const lat = text(form,'latitude',30,false), lng = text(form,'longitude',30,false);
  let latitude: number | null = null, longitude: number | null = null, locationSource: LocationSource | null = null;
  if (lat || lng) {
    latitude = Number(lat.replace(',', '.')); longitude = Number(lng.replace(',', '.'));
    if (!lat || !lng || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude)>90 || Math.abs(longitude)>180 || distanceKm(latitude,longitude,city)>100) throw new StoreError('Укажите точку магазина в выбранном городе (не дальше 100 км от центра).');
    locationSource = form.get('locationSource') === 'geocoded' ? 'geocoded' : 'manual';
  }
  let station = text(form,'metro',40,false);
  if (station && !METRO[city.id]?.some(s=>s.id===station)) throw new StoreError('Выберите станцию метро в этом городе.');
  if (!station && latitude !== null && longitude !== null) station = nearestStations(city.id, latitude, longitude, 1)[0]?.station.id ?? '';
  let raw: unknown;
  try { raw = JSON.parse(String(form.get('catalog') ?? '[]')); } catch { throw new StoreError('Проверьте список напитков.'); }
  if (!Array.isArray(raw) || raw.length>50) throw new StoreError('В каталоге можно указать до 50 напитков.');
  const catalog: StoreItem[] = raw.map((item: unknown) => {
    if (!item || typeof item!=='object') throw new StoreError('Проверьте напиток в каталоге.');
    const { name, price, availability, brand, flavor } = item as StoreItem;
    if (typeof name!=='string' || !name.trim() || name.trim().length>150 || !['available','unavailable','unknown'].includes(availability) || (price!==null && (!Number.isSafeInteger(price) || price<1 || price>100000000))) throw new StoreError('Укажите название напитка и корректную цену (либо оставьте цену пустой).');
    const linked = typeof brand==='string' && typeof flavor==='string' && brand.length>0 && brand.length<=100 && flavor.length>0 && flavor.length<=200;
    return linked ? {name:name.trim(),price,availability,brand,flavor} : {name:name.trim(),price,availability};
  });
  const keys = catalog.map(i=>i.brand!==undefined ? JSON.stringify([i.brand,i.flavor]) : i.name.toLocaleLowerCase('ru-RU'));
  if(new Set(keys).size!==catalog.length) throw new StoreError('Удалите повторяющиеся напитки из каталога.');
  return {name:text(form,'name',120),address:text(form,'address',300),description:text(form,'description',1500,false),city:city.id,latitude,longitude,locationSource,metro:station||null,catalog};
}
export function storeMapUrl(store: Pick<StoreInput,'latitude'|'longitude'|'address'|'city'>) {
  if (store.latitude === null || store.longitude === null) return `https://yandex.ru/maps/?text=${encodeURIComponent([findCity(store.city)?.name, store.address].filter(Boolean).join(', '))}`;
  return `https://yandex.ru/maps/?pt=${store.longitude},${store.latitude}&z=17&l=map`;
}
export const STOCK_LABELS: Record<StockStatus,string> = {available:'Есть в наличии',unavailable:'Нет в наличии',unknown:'Наличие не уточнено'};

const STORE_ID = /[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}/i;
/** Store id from a pasted store link (`…/market/stores/<id>`, also `/edit`) or the bare id. */
export function parseStoreReference(value: string): string | null {
  return value.trim().match(STORE_ID)?.[0]?.toLowerCase() ?? null;
}
export type StoreTransferTarget = { kind: 'email'; value: string } | { kind: 'username'; value: string };
/** New store owner from an email, @username or profile link (canrush.ru/profile/<username>). */
export function parseStoreTransferTarget(value: string): StoreTransferTarget | null {
  const trimmed = value.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(trimmed)) return trimmed.length <= 254 ? { kind: 'email', value: trimmed.toLowerCase() } : null;
  const username = trimmed.replace(/^https?:\/\/[^/]+/i, '').replace(/^\/?profile\//i, '').replace(/^@+/, '').replace(/\/.*$/, '').toLowerCase();
  return /^[a-z0-9_]{3,24}$/u.test(username) ? { kind: 'username', value: username } : null;
}
