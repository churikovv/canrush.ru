import type { WholesaleOffer } from '@canrush/shared';
import { delay, httpGet } from '../http.js';
import { isAllowedByRobots } from '../robots.js';
import { readJsonValue } from './json-scan.js';

/**
 * «Отличные цены» (otlichnye-tseny.ru) — a wholesale shop on Tilda that sells by the case itself, in Moscow and
 * St Petersburg. The catalog grid is filled by Tilda's store API (`store.tildaapi.com`), whose robots.txt closes
 * everything, so we never call it. Instead: the shop's own sitemap lists every product page, and each page carries
 * `product = {…}` with the title, brand, price per can and «12 шт в упаковке · Товар в наличии» in the description.
 * One page every few seconds — about a hundred energy drinks, a few minutes a night.
 */
const SITE = 'https://otlichnye-tseny.ru';
const CATEGORY = '/catalog/energeticheskiye-napitkki/tproduct/';
const SUPPLIER = 'Отличные цены';
const PAUSE_MS = 2500;
const MAX_PRODUCTS = 400;

interface RawTildaProduct { uid: number | string; title: string; brand?: string; descr?: string; price?: string | number; url?: string }

/** Product page links of the energy drinks category from the store's sitemap (an index of parts, or one urlset). */
export function storeSitemapLinks(xml: string): { parts: string[]; products: string[] } {
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(match => match[1]!.replace(/&amp;/g, '&'));
  return xml.includes('<sitemapindex')
    ? { parts: locs, products: [] }
    : { parts: [], products: locs.filter(url => url.startsWith(`${SITE}${CATEGORY}`)) };
}

/** The `product = {…}` object of a Tilda product page. */
export function tildaProduct(html: string): RawTildaProduct | null {
  const at = html.search(/\bproduct\s*=\s*\{/);
  if (at < 0) return null;
  const value = readJsonValue(html, html.indexOf('{', at)) as RawTildaProduct;
  return value && typeof value.title === 'string' ? value : null;
}

const plain = (html: string) => html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/** A page as a wholesale offer; a product out of stock or without a price is skipped. */
export function otlichnyeOffer(product: RawTildaProduct, url: string): (Omit<WholesaleOffer, 'brand' | 'flavor' | 'volumeMl'> & { siteBrand?: string }) | null {
  const price = Number(product.price);
  const description = plain(product.descr ?? '');
  if (!Number.isFinite(price) || price <= 0 || /нет в наличии|под заказ/i.test(description)) return null;
  const pack = Number(description.match(/(\d+)\s*шт/i)?.[1]);
  return {
    source: 'otlichnye',
    sourceId: String(product.uid),
    name: product.title.trim(),
    price,
    packSize: Number.isInteger(pack) && pack > 0 ? pack : 1,
    supplier: SUPPLIER,
    suppliers: 1,
    url: product.url?.startsWith(`${SITE}/`) ? product.url : url,
    siteBrand: product.brand?.trim() || undefined,
  };
}

export async function fetchOtlichnye(log: (message: string) => void = () => {}): Promise<Array<Omit<WholesaleOffer, 'brand' | 'flavor' | 'volumeMl'> & { siteBrand?: string }>> {
  const get = async (url: string) => {
    if (!(await isAllowedByRobots(url))) throw new Error(`otlichnye: robots.txt closes ${url}`);
    return String((await httpGet<string>(url, { responseType: 'text', headers: { Accept: 'text/html,application/xml', 'Accept-Language': 'ru-RU,ru;q=0.9' }, timeout: 30_000 })).data);
  };
  const index = storeSitemapLinks(await get(`${SITE}/sitemap-store.xml`));
  const links = new Set(index.products);
  for (const part of index.parts) { await delay(1000); for (const link of storeSitemapLinks(await get(part)).products) links.add(link); }
  const pages = [...links].slice(0, MAX_PRODUCTS);
  log(`otlichnye: в sitemap ${pages.length} страниц энергетиков`);
  const offers: Array<Omit<WholesaleOffer, 'brand' | 'flavor' | 'volumeMl'> & { siteBrand?: string }> = [];
  let failed = 0;
  for (const [position, url] of pages.entries()) {
    await delay(PAUSE_MS + Math.round(Math.random() * 1500));
    try {
      const product = tildaProduct(await get(url));
      const offer = product && otlichnyeOffer(product, url);
      if (offer) offers.push(offer);
    } catch (error) {
      failed += 1;
      if (failed > 10 && failed > position / 2) throw error;
    }
    if ((position + 1) % 25 === 0) log(`otlichnye: ${position + 1} из ${pages.length}, в наличии ${offers.length}`);
  }
  return offers;
}
