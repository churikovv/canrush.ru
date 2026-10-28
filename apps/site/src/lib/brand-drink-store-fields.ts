/** «Где купить» from the brand: rules shared by the cabinet's form and the server. */
export const MAX_DRINK_STORES = 20;
export const DRINK_STORE_LIMITS = { name: 80, url: 300, address: 200, city: 60, retailer: 80 } as const;

export type DrinkStoreKind = 'store' | 'retailer' | 'custom';
export type DrinkStoreInput =
  | { kind: 'store'; storeId: string }
  | { kind: 'retailer'; retailer: string }
  | { kind: 'custom'; name: string; url: string | null; address: string | null; city: string | null };

export class DrinkStoreError extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (form: FormData, key: string) => String(form.get(key) ?? '').replace(/\s+/g, ' ').trim();

/** A link the page can open: http(s) only; a bare domain gets https://. */
export function normalizeStoreUrl(value: string): string | null {
  if (!value) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  let url: URL;
  try { url = new URL(withScheme); } catch { throw new DrinkStoreError('Ссылка не похожа на адрес сайта.'); }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new DrinkStoreError('Ссылка — только http или https.');
  if (!url.hostname.includes('.')) throw new DrinkStoreError('Ссылка не похожа на адрес сайта.');
  const out = url.toString();
  if (out.length > DRINK_STORE_LIMITS.url) throw new DrinkStoreError(`Ссылка — до ${DRINK_STORE_LIMITS.url} символов.`);
  return out;
}

export function parseDrinkStore(form: FormData): DrinkStoreInput {
  const kind = text(form, 'kind');
  if (kind === 'store') {
    const storeId = text(form, 'storeId');
    if (!UUID.test(storeId)) throw new DrinkStoreError('Выберите магазин из списка.');
    return { kind, storeId };
  }
  if (kind === 'retailer') {
    const retailer = text(form, 'retailer');
    if (!retailer || retailer.length > DRINK_STORE_LIMITS.retailer) throw new DrinkStoreError('Выберите сеть из списка.');
    return { kind, retailer };
  }
  if (kind === 'custom') {
    const name = text(form, 'name'), address = text(form, 'address') || null, city = text(form, 'city') || null;
    if (!name) throw new DrinkStoreError('Напишите название магазина.');
    if (name.length > DRINK_STORE_LIMITS.name) throw new DrinkStoreError(`Название — до ${DRINK_STORE_LIMITS.name} символов.`);
    if (address && address.length > DRINK_STORE_LIMITS.address) throw new DrinkStoreError(`Адрес — до ${DRINK_STORE_LIMITS.address} символов.`);
    if (city && city.length > DRINK_STORE_LIMITS.city) throw new DrinkStoreError(`Город — до ${DRINK_STORE_LIMITS.city} символов.`);
    const url = normalizeStoreUrl(text(form, 'url'));
    if (!url && !address) throw new DrinkStoreError('Добавьте ссылку на магазин или его адрес.');
    return { kind, name, url, address, city };
  }
  throw new DrinkStoreError('Выберите, что добавить.');
}

/** A map search for an address, for stores the brand added by hand. */
export const mapSearchUrl = (address: string, city: string | null) =>
  `https://yandex.ru/maps/?${new URLSearchParams({ text: city ? `${city}, ${address}` : address })}`;
