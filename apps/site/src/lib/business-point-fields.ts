import { CITIES, type City } from '@canrush/shared';

/** Точки продаж компании: правила без базы, общие для формы кабинета и сервера. */
export const POINT_KINDS = [
  { value: 'store', label: 'Магазин' },
  { value: 'kiosk', label: 'Киоск' },
  { value: 'cafe', label: 'Кафе или бар' },
  { value: 'vending', label: 'Автомат' },
  { value: 'wholesale', label: 'Опт' },
  { value: 'other', label: 'Другое' },
] as const;
export type PointKind = (typeof POINT_KINDS)[number]['value'];
export const pointKindLabel = (kind: string) => POINT_KINDS.find(item => item.value === kind)?.label ?? 'Точка';

export const POINT_LIMITS = { name: 80, city: 60, address: 200, hours: 80, note: 200 } as const;
/** Точек у одной компании. */
export const MAX_BUSINESS_POINTS = 300;
/** Сохранений за минуту на компанию: каждое — запрос к платному геокодеру. */
export const POINT_SAVES_PER_MINUTE = 20;

export class PointError extends Error {}

export interface PointDrink { brand: string; flavor: string }
export interface PointInput {
  name: string; kind: PointKind; city: string; address: string; hours: string | null; note: string | null; drinks: PointDrink[];
}

const text = (form: FormData, name: string) => String(form.get(name) ?? '').replace(/\s+/gu, ' ').trim();
const normalized = (value: string) => value.toLocaleLowerCase('ru-RU').replaceAll('ё', 'е').trim();

/** Город из списка сайта по названию («москва», «Санкт-Петербург»): у таких адрес ищется в пределах 100 км от центра. */
export function siteCity(name: string): City | undefined {
  const wanted = normalized(name);
  return CITIES.find(city => normalized(city.name) === wanted);
}

export function parsePoint(form: FormData): PointInput {
  const name = text(form, 'name');
  const kind = text(form, 'kind');
  const cityText = text(form, 'city');
  const address = text(form, 'address');
  const hours = text(form, 'hours');
  const note = text(form, 'note');
  if (!name) throw new PointError('Назовите точку: «Магазин у дома», «Пятёрочка на Ленина».');
  if (name.length > POINT_LIMITS.name) throw new PointError(`Название — до ${POINT_LIMITS.name} символов.`);
  if (!POINT_KINDS.some(item => item.value === kind)) throw new PointError('Выберите, что это за точка.');
  if (cityText.length < 2 || cityText.length > POINT_LIMITS.city || !/\p{L}/u.test(cityText)) throw new PointError('Укажите город.');
  if (address.length < 3) throw new PointError('Укажите адрес: улицу и номер дома.');
  if (address.length > POINT_LIMITS.address) throw new PointError(`Адрес — до ${POINT_LIMITS.address} символов.`);
  if (hours.length > POINT_LIMITS.hours) throw new PointError(`Часы работы — до ${POINT_LIMITS.hours} символов.`);
  if (note.length > POINT_LIMITS.note) throw new PointError(`Заметка — до ${POINT_LIMITS.note} символов.`);
  const drinks: PointDrink[] = [];
  for (const value of form.getAll('drink')) {
    try {
      const [brand, flavor] = JSON.parse(String(value)) as unknown[];
      if (typeof brand === 'string' && typeof flavor === 'string' && brand && flavor && !drinks.some(item => item.brand === brand && item.flavor === flavor)) drinks.push({ brand, flavor });
    } catch { /* A value that is not a drink of the form is skipped. */ }
  }
  return { name, kind: kind as PointKind, city: siteCity(cityText)?.name ?? cityText, address, hours: hours || null, note: note || null, drinks: drinks.slice(0, 60) };
}

export function plural(count: number, one: string, few: string, many: string): string {
  const tens = count % 100, units = count % 10;
  return units === 1 && tens !== 11 ? one : units >= 2 && units <= 4 && (tens < 12 || tens > 14) ? few : many;
}

/** Точка в Яндекс Картах: метка на координатах, а не поиск по тексту — так открывается ровно то место. */
export function yandexMapsHref(point: { latitude: number; longitude: number }): string {
  return `https://yandex.ru/maps/?pt=${point.longitude},${point.latitude}&z=17&l=map`;
}

/** Города точек по числу, первым — город посетителя: для переключателя над картой. */
export function pointCities(points: readonly { city: string }[], first?: string): { city: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const point of points) counts.set(point.city, (counts.get(point.city) ?? 0) + 1);
  return [...counts].map(([city, count]) => ({ city, count }))
    .sort((a, b) => Number(b.city === first) - Number(a.city === first) || b.count - a.count || a.city.localeCompare(b.city, 'ru'));
}
