/** Yandex region IDs: https://yandex.ru/dev/tasks-api/doc/ru/regions */
export const CITIES = [
  { id: 'moscow', name: 'Москва', geoId: '213', slug: 'moskva', lat: 55.755863, lng: 37.6177 },
  { id: 'saint-petersburg', name: 'Санкт-Петербург', geoId: '2', slug: 'sankt-peterburg', lat: 59.938784, lng: 30.314997 },
  { id: 'novosibirsk', name: 'Новосибирск', geoId: '65', slug: 'novosibirsk', lat: 55.030199, lng: 82.92043 },
  { id: 'yekaterinburg', name: 'Екатеринбург', geoId: '54', slug: 'ekaterinburg', lat: 56.838011, lng: 60.597465 },
  { id: 'kazan', name: 'Казань', geoId: '43', slug: 'kazan', lat: 55.796127, lng: 49.106414 },
  { id: 'nizhny-novgorod', name: 'Нижний Новгород', geoId: '47', slug: 'nizhniy-novgorod', lat: 56.326887, lng: 44.005986 },
  { id: 'krasnoyarsk', name: 'Красноярск', geoId: '62', slug: 'krasnoyarsk', lat: 56.010563, lng: 92.852572 },
  { id: 'chelyabinsk', name: 'Челябинск', geoId: '56', slug: 'chelyabinsk', lat: 55.159902, lng: 61.402554 },
  { id: 'samara', name: 'Самара', geoId: '51', slug: 'samara', lat: 53.195878, lng: 50.100202 },
  { id: 'ufa', name: 'Уфа', geoId: '172', slug: 'ufa', lat: 54.735147, lng: 55.958727 },
  { id: 'rostov-on-don', name: 'Ростов-на-Дону', geoId: '39', slug: 'rostov-na-donu', lat: 47.222078, lng: 39.720358 },
  { id: 'omsk', name: 'Омск', geoId: '66', slug: 'omsk', lat: 54.989347, lng: 73.368221 },
  { id: 'krasnodar', name: 'Краснодар', geoId: '35', slug: 'krasnodar', lat: 45.03547, lng: 38.975313 },
  { id: 'voronezh', name: 'Воронеж', geoId: '193', slug: 'voronezh', lat: 51.660781, lng: 39.200296 },
  { id: 'perm', name: 'Пермь', geoId: '50', slug: 'perm', lat: 58.010455, lng: 56.229443 },
  { id: 'volgograd', name: 'Волгоград', geoId: '38', slug: 'volgograd', lat: 48.707067, lng: 44.516975 },
] as const;
export type City = (typeof CITIES)[number];
export type CityId = City['id'];
export const DEFAULT_CITY = CITIES[0];
export const CITY_COOKIE = 'canrush-city';
export function findCity(id: unknown): City | undefined { return CITIES.find(city => city.id === id); }
export function distanceKm(lat: number, lng: number, city: City): number {
  const rad = Math.PI / 180;
  const a = Math.sin((lat - city.lat) * rad / 2) ** 2 + Math.cos(lat * rad) * Math.cos(city.lat * rad) * Math.sin((lng - city.lng) * rad / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}
/** Never silently assign a distant city to someone outside supported areas. */
export function nearestCity(lat: number, lng: number): City | undefined {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return undefined;
  const nearest = [...CITIES].sort((a, b) => distanceKm(lat, lng, a) - distanceKm(lat, lng, b))[0];
  return nearest && distanceKm(lat, lng, nearest) <= 60 ? nearest : undefined;
}
