import { findCity, distanceKm } from '@canrush/shared';
import metroData from './stores/metro.json';
export const METRO = metroData as Record<string, { id: string; name: string; line: string; color: string }[]>;
export type StockStatus = 'available' | 'unavailable' | 'unknown';
export interface StoreItem { name: string; price: number | null; availability: StockStatus }
export interface StoreInput { name: string; city: string; address: string; latitude: number; longitude: number; metro: string | null; description: string; catalog: StoreItem[] }
export class StoreError extends Error {}
function text(form: FormData, key: string, max: number, required = true) {
  const raw = form.get(key); const value = typeof raw === 'string' ? raw.trim() : '';
  if ((required && !value) || value.length > max) throw new StoreError(`Проверьте поле «${({name:'Название',address:'Адрес',description:'Описание'} as Record<string,string>)[key] ?? key}».`);
  return value;
}
export function parseStore(form: FormData): StoreInput {
  const city = findCity(form.get('city'));
  if (!city) throw new StoreError('Выберите город из списка.');
  const lat = text(form,'latitude',30), lng = text(form,'longitude',30);
  const latitude = Number(lat.replace(',', '.')), longitude = Number(lng.replace(',', '.'));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude)>90 || Math.abs(longitude)>180 || distanceKm(latitude,longitude,city)>100) throw new StoreError('Укажите точку магазина в выбранном городе (не дальше 100 км от центра).');
  const station = text(form,'metro',40,false);
  if (station && !METRO[city.id]?.some(s=>s.id===station)) throw new StoreError('Выберите станцию метро в этом городе.');
  let raw: unknown;
  try { raw = JSON.parse(String(form.get('catalog') ?? '[]')); } catch { throw new StoreError('Проверьте список напитков.'); }
  if (!Array.isArray(raw) || raw.length>50) throw new StoreError('В каталоге можно указать до 50 напитков.');
  const catalog: StoreItem[] = raw.map((item: unknown) => {
    if (!item || typeof item!=='object') throw new StoreError('Проверьте напиток в каталоге.');
    const { name, price, availability } = item as StoreItem;
    if (typeof name!=='string' || !name.trim() || name.trim().length>150 || !['available','unavailable','unknown'].includes(availability) || (price!==null && (!Number.isSafeInteger(price) || price<1 || price>100000000))) throw new StoreError('Укажите название напитка и корректную цену (либо оставьте цену пустой).');
    return {name:name.trim(),price,availability};
  });
  if(new Set(catalog.map(i=>i.name.toLocaleLowerCase('ru-RU'))).size!==catalog.length) throw new StoreError('Удалите повторяющиеся напитки из каталога.');
  return {name:text(form,'name',120),address:text(form,'address',300),description:text(form,'description',1500,false),city:city.id,latitude,longitude,metro:station||null,catalog};
}
export function storeMapUrl(store: Pick<StoreInput,'latitude'|'longitude'>) {
  return `https://yandex.ru/maps/?pt=${store.longitude},${store.latitude}&z=17&l=map`;
}
export const STOCK_LABELS: Record<StockStatus,string> = {available:'Есть в наличии',unavailable:'Нет в наличии',unknown:'Наличие не уточнено'};
