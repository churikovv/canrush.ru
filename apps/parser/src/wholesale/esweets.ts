import type { WholesaleOffer } from '@canrush/shared';
import { delay, httpGet } from '../http.js';
import { isAllowedByRobots } from '../robots.js';

/**
 * E-sweets (msk.e-sweets.ru) — a Moscow wholesaler of sweets and drinks on Webasyst. robots.txt closes `/search/`,
 * sorting and filter parameters, so we read the category page itself (`/category/energeticheskie-napitki/`, 24 a page,
 * `?page=N`). Each card carries the product id, the title, «189 руб. за шт.», «В упаковке: 12 шт.» and stock; the
 * page also repeats a few cards in a «Хиты» block, so cards are kept once by id. Out-of-stock products stay, marked,
 * so a brand sees the range.
 */
const SITE = 'https://msk.e-sweets.ru';
const CATEGORY = '/category/energeticheskie-napitki/';
const SUPPLIER = 'E-sweets';
const MAX_PAGES = 10;
const PAUSE_MS = 3000;

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|\s+/g, ' ').replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim();

/** The cards of a category page, each once. */
export function esweetsCards(html: string): Array<Omit<WholesaleOffer, 'brand' | 'flavor' | 'volumeMl'>> {
  const offers = new Map<string, Omit<WholesaleOffer, 'brand' | 'flavor' | 'volumeMl'>>();
  for (const card of html.split('<div class="product">').slice(1)) {
    const id = card.match(/name="product_id" value="(\d+)"/)?.[1];
    const link = card.match(/class="h5 product_name">\s*<a href="([^"]+)"[^>]*>\s*<span>([\s\S]*?)<\/span>/);
    const price = Number(card.match(/class="price[^"]*">\s*([\d\s]+(?:[.,]\d+)?)\s*руб/)?.[1]?.replace(/\s/g, '').replace(',', '.'));
    if (!id || !link || !Number.isFinite(price) || price <= 0 || offers.has(id)) continue;
    const pack = Number(card.match(/В упаковке:\s*(\d+)/)?.[1]);
    offers.set(id, {
      source: 'esweets',
      sourceId: id,
      name: text(link[2]!),
      price,
      packSize: Number.isInteger(pack) && pack > 0 ? pack : 1,
      supplier: SUPPLIER,
      suppliers: 1,
      inStock: /class="stock yes"/.test(card),
      url: new URL(link[1]!, SITE).toString(),
    });
  }
  return [...offers.values()];
}

/** Whether the page links to the next one (`?page=N+1`). */
export const hasNextPage = (html: string, page: number) => html.includes(`${CATEGORY}?page=${page + 1}"`);

export async function fetchEsweets(log: (message: string) => void = () => {}): Promise<Array<Omit<WholesaleOffer, 'brand' | 'flavor' | 'volumeMl'>>> {
  const offers = new Map<string, Omit<WholesaleOffer, 'brand' | 'flavor' | 'volumeMl'>>();
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = `${SITE}${CATEGORY}${page > 1 ? `?page=${page}` : ''}`;
    if (!(await isAllowedByRobots(url))) throw new Error(`esweets: robots.txt closes ${url}`);
    if (page > 1) await delay(PAUSE_MS + Math.round(Math.random() * 1500));
    const html = String((await httpGet<string>(url, { responseType: 'text', headers: { Accept: 'text/html', 'Accept-Language': 'ru-RU,ru;q=0.9' }, timeout: 30_000 })).data);
    for (const offer of esweetsCards(html)) if (!offers.has(offer.sourceId)) offers.set(offer.sourceId, offer);
    log(`esweets: страница ${page}, товаров ${offers.size}`);
    if (!hasNextPage(html, page)) break;
  }
  return [...offers.values()];
}
