import type { WholesaleOffer } from '@canrush/shared';
import { delay, httpGet } from '../http.js';
import { isAllowedByRobots } from '../robots.js';
import { readJsonValue } from './json-scan.js';

/**
 * НаПолке (napolke.ru) — a B2B marketplace where many suppliers sell by the case. The category page is a Next.js app
 * whose server HTML already carries the products as an RSC payload (`self.__next_f.push`), 60 per page: the cheapest
 * offer per can, the order step (`deliveryUnit.mult`), the supplier with that price, its minimal order and how many
 * suppliers sell the product. Prices are for the default address — Moscow. robots.txt allows the category pages for
 * every bot (only filter slices, cart and sign-in are closed); we never send filters, only `offset`.
 */
const SITE = 'https://napolke.ru';
const CATEGORY = '/catalog/soki_vody_napitki/ehnergeticheskie_napitki';
const PAGE_SIZE = 60;
const MAX_PAGES = 20;
const PAUSE_MS = 3000;

interface RawOffer {
  supplier_display_name?: string;
  price?: { delivery_prepaid?: number; pickup_prepaid?: number };
  minOrderCost?: number;
  deliveryUnit?: { mult?: number };
  pricelist_updated_date?: string;
  taxationSystem?: { vatTaxation?: boolean };
}
export interface RawNapolkeProduct {
  uuid: string;
  name: string;
  brand_name?: string;
  seo_name?: string;
  price?: number;
  deliveryUnit?: { mult?: number };
  offer_with_min_price?: RawOffer;
  offers?: { count?: number };
}

/** The RSC strings of the page, decoded and joined in order. */
export function rscPayload(html: string): string {
  const parts: string[] = [];
  for (const match of html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)) parts.push(JSON.parse(match[1]!) as string);
  return parts.join('');
}

/** The JSON value that follows `"key":` in the payload. */
export function jsonAfter(payload: string, key: string): unknown {
  const at = payload.indexOf(`"${key}":`);
  return at < 0 ? undefined : readJsonValue(payload, at + key.length + 3);
}

export function parseNapolkePage(html: string): { products: RawNapolkeProduct[]; total: number } {
  const payload = rscPayload(html);
  const response = jsonAfter(payload, 'productsResponse') as { data?: RawNapolkeProduct[] } | undefined;
  if (!response || !Array.isArray(response.data)) throw new Error('napolke: no products in the page');
  const total = jsonAfter(payload, 'totalProductCount');
  return { products: response.data, total: typeof total === 'number' ? total : response.data.length };
}

/** A product as a wholesale offer (identity comes later); products without a usable price are skipped. */
export function napolkeOffer(product: RawNapolkeProduct): Omit<WholesaleOffer, 'brand' | 'flavor' | 'volumeMl'> | null {
  const offer = product.offer_with_min_price;
  const price = offer?.price?.delivery_prepaid ?? offer?.price?.pickup_prepaid ?? product.price;
  if (!price || !Number.isFinite(price) || price <= 0 || !offer?.supplier_display_name) return null;
  return {
    source: 'napolke',
    sourceId: product.uuid,
    name: product.name.trim(),
    price,
    packSize: offer.deliveryUnit?.mult ?? product.deliveryUnit?.mult ?? 1,
    supplier: offer.supplier_display_name.trim(),
    suppliers: product.offers?.count ?? 1,
    minOrder: offer.minOrderCost || undefined,
    vat: offer.taxationSystem?.vatTaxation,
    priceDate: offer.pricelist_updated_date,
    url: `${SITE}${CATEGORY}/product/${product.seo_name ?? product.uuid}`,
  };
}

/** Every page of the category, one request every few seconds; the brand from the site goes along for the identity. */
export async function fetchNapolke(log: (message: string) => void = () => {}): Promise<Array<Omit<WholesaleOffer, 'brand' | 'flavor' | 'volumeMl'> & { siteBrand?: string }>> {
  const offers: Array<Omit<WholesaleOffer, 'brand' | 'flavor' | 'volumeMl'> & { siteBrand?: string }> = [];
  let total = Infinity;
  for (let page = 0; page < MAX_PAGES && page * PAGE_SIZE < total; page += 1) {
    const url = `${SITE}${CATEGORY}${page ? `?offset=${page * PAGE_SIZE}` : ''}`;
    if (!(await isAllowedByRobots(url))) throw new Error(`napolke: robots.txt closes ${url}`);
    if (page) await delay(PAUSE_MS + Math.round(Math.random() * 1500));
    const { data } = await httpGet<string>(url, { responseType: 'text', headers: { Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'ru-RU,ru;q=0.9' }, timeout: 30_000 });
    const parsed = parseNapolkePage(String(data));
    total = parsed.total;
    for (const product of parsed.products) {
      const offer = napolkeOffer(product);
      if (offer) offers.push({ ...offer, siteBrand: product.brand_name });
    }
    log(`napolke: страница ${page + 1}, товаров ${offers.length} из ${total}`);
    if (!parsed.products.length) break;
  }
  return offers;
}
