import { randomUUID } from 'node:crypto';
import { isAxiosError } from 'axios';
import type { BrandAliases, Product, SourceAdapter, SourceQueryConfig } from '@canrush/shared';
import { SourceBlockedError, StrategyNotApplicableError } from '../fetch/errors.js';
import { runStrategies, type StrategyDefinition } from '../fetch/strategy.js';
import { delay, httpGet } from '../http.js';
import { dedupeProducts, detectBrand, normalizeProduct } from '../normalize.js';
import { isAllowedByRobots } from '../robots.js';

/**
 * Едадил (Yandex) — агрегатор акционных каталогов ритейлеров: Пятёрочка, Магнит,
 * Лента, Перекрёсток, Дикси, Ашан и др. сами публикуют туда свои акции. Поиск сайта
 * ходит в открытый JSON API search.edadeal.io — без антибота, кук и браузера; город
 * задаётся заголовками x-locality-geoid (Yandex geoid: 213 — Москва, 2 — Петербург).
 *
 * Важно: это только акционные цены (Едадил = каталоги скидок), а не полный прайс.
 * Ответ сгруппирован по SKU, внутри — meta_offer по каждой сети; каждый такой оффер
 * становится отдельным Product с полем retailer, чтобы сайт мог показать
 * «Red Bull 0.355 л — 89 ₽ в Пятёрочке (по данным Едадила)».
 *
 * Ходим бережно: 100 SKU за запрос (максимум API), пауза между страницами, объём
 * ограничен maxItems. robots.txt у API-хоста нет; запрещённые для роботов страницы
 * самого edadeal.ru (поиск, /offers/*) не трогаем — ссылки на карточки только для людей.
 */

const API_URL = 'https://search.edadeal.io/api/v4/search';
const SITE_URL = 'https://edadeal.ru';
/** Максимальный размер страницы, который принимает API. */
const PAGE_LIMIT = 100;
const PAGE_DELAY_MS = 800;
const BRAND_BATCH_MAX_COUNT = 500;
const DRINKS_SEGMENT_UUID = '3b336f02-6311-11e6-849f-52540010b608';
const DEFAULT_GEO_ID = '213';

export interface EdadealLocality {
  /** Yandex geoid города — уходит в заголовок x-locality-geoid */
  geoId: string;
  /** Слаг города в URL edadeal.ru, нужен для ссылок на карточки */
  slug: string;
  lat: number;
  lng: number;
}

/** Города, для которых знаем и geoid, и слаг в URL. Добавлять по мере необходимости. */
export const KNOWN_LOCALITIES: Record<string, EdadealLocality> = {
  '213': { geoId: '213', slug: 'moskva', lat: 55.755863, lng: 37.6177 },
  '2': { geoId: '2', slug: 'sankt-peterburg', lat: 59.938784, lng: 30.314997 },
};

interface EdadealPriceValue {
  type: 'value';
  value: number;
}

interface EdadealPriceRange {
  type: 'range';
  from: number;
  to: number;
}

type EdadealPrice = EdadealPriceValue | EdadealPriceRange;

/** Оффер конкретной сети. Цены — в копейках. */
export interface EdadealMetaOffer {
  itemType: 'meta_offer';
  uuid: string;
  title?: string;
  brandUuid?: string;
  partner?: { uuid?: string; name?: string; slug?: string };
  priceData?: { new?: EdadealPrice; old?: EdadealPrice };
  imageUrl?: string;
  quantity?: number;
  quantityUnit?: string;
  dateStart?: number;
  dateEnd?: number;
  offerUuids?: string[];
}

/** Группа по SKU: сам товар и вложенные офферы сетей. */
export interface EdadealSkuItem {
  itemType: 'sku';
  uuid: string;
  title?: string;
  items?: EdadealMetaOffer[];
}

export interface EdadealBrandEntity {
  uuid: string;
  name: string;
  count: number;
}

export interface EdadealSearchResponse {
  total?: number;
  entities?: { brands?: EdadealBrandEntity[] };
  /** На верхнем уровне встречаются и SKU-группы, и одиночные meta_offer. */
  items?: Array<EdadealSkuItem | EdadealMetaOffer>;
}

export function resolveLocality(regionId: string | undefined): EdadealLocality {
  const geoId = regionId && regionId.trim() !== '' ? regionId.trim() : DEFAULT_GEO_ID;
  const known = KNOWN_LOCALITIES[geoId];
  if (known) return known;
  // Неизвестный geoid: цены по нему API отдаст, но слаг для ссылок неизвестен —
  // ведём на общий каталог Москвы, чем на несуществующий город.
  const fallback = KNOWN_LOCALITIES[DEFAULT_GEO_ID]!;
  return { ...fallback, geoId };
}

function kopecksToRub(value: number): number {
  return Math.round(value) / 100;
}

/** Минимальная цена из value/range (диапазон — разные магазины одной сети). */
function minPrice(price: EdadealPrice | undefined): number | undefined {
  if (!price) return undefined;
  const raw = price.type === 'range' ? price.from : price.value;
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? kopecksToRub(raw) : undefined;
}

function quantityToMl(quantity: number | undefined, unit: string | undefined): number | undefined {
  if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0) return undefined;
  const u = (unit ?? '').toLowerCase();
  if (u === 'мл') return Math.round(quantity);
  if (u === 'л') return Math.round(quantity * 1000);
  return undefined;
}

function flattenMetaOffers(items: EdadealSearchResponse['items']): EdadealMetaOffer[] {
  const result: EdadealMetaOffer[] = [];
  for (const item of items ?? []) {
    if (item.itemType === 'meta_offer') {
      result.push(item);
    } else if (item.itemType === 'sku') {
      result.push(...(item.items ?? []));
    }
  }
  return result;
}

function matchesCategory(
  name: string,
  keywords: string[],
  brands: string[],
  aliases: BrandAliases,
  apiBrand: string | undefined,
): boolean {
  const lower = name.toLowerCase();
  const explicitEnergy =
    keywords.some((keyword) => lower.includes(keyword.toLowerCase())) ||
    /энерг|энерджи|\benergy\b|тонизирующ/i.test(lower);
  const isotonicOnly = /изотонич|\bisotonic\b/i.test(lower) && !/энерг|энерджи|\benergy\b/i.test(lower);
  return (
    !isotonicOnly &&
    (explicitEnergy ||
      detectBrand(name, brands, aliases) !== undefined ||
      (apiBrand !== undefined && detectBrand(apiBrand, brands, aliases) !== undefined))
  );
}

function offerUrl(meta: EdadealMetaOffer, locality: EdadealLocality): string {
  const base = `${SITE_URL}/${locality.slug}/metaoffers/${meta.uuid}`;
  const baseOffer = meta.offerUuids?.[0];
  return baseOffer ? `${base}?baseOfferUuid=${baseOffer}` : base;
}

/**
 * Чистый маппинг ответа API в Product[] (без сети — покрыт unit-тестами).
 * Отсекает офферы без цены/названия и не относящиеся к энергетикам.
 */
export function mapEdadealResponse(
  data: EdadealSearchResponse,
  config: SourceQueryConfig,
  locality: EdadealLocality,
  fetchedAt: string,
  brandByUuid: ReadonlyMap<string, string> = new Map(),
): Product[] {
  const keywords = config.keywords && config.keywords.length > 0 ? config.keywords : ['энергетик'];
  const brands = config.brands ?? [];
  const brandAliases = config.brandAliases ?? {};
  const flavors = config.flavors ?? [];
  const flavorAliases = config.flavorAliases ?? {};

  const products: Product[] = [];
  for (const meta of flattenMetaOffers(data.items)) {
    const name = meta.title?.trim();
    const price = minPrice(meta.priceData?.new);
    const apiBrand = meta.brandUuid ? brandByUuid.get(meta.brandUuid) : undefined;
    if (!name || price === undefined) continue;
    if (!matchesCategory(name, keywords, brands, brandAliases, apiBrand)) continue;

    const oldPrice = minPrice(meta.priceData?.old);
    const product = normalizeProduct(
      'edadeal',
      {
        sourceId: meta.uuid,
        name,
        brand: apiBrand,
        price,
        oldPrice: oldPrice !== undefined && oldPrice > price ? oldPrice : undefined,
        url: offerUrl(meta, locality),
        imageUrl: meta.imageUrl,
        category: 'energy_drinks',
      },
      brands,
      fetchedAt,
      brandAliases,
      flavors,
      flavorAliases,
    );

    products.push({
      ...product,
      volumeMl: product.volumeMl ?? quantityToMl(meta.quantity, meta.quantityUnit),
      retailer: meta.partner?.name,
      promoEndsAt: meta.dateEnd ? new Date(meta.dateEnd).toISOString() : undefined,
    });
  }

  return dedupeProducts(products);
}

function buildHeaders(locality: EdadealLocality, deviceId: string): Record<string, string> {
  return {
    Accept: 'application/json',
    Origin: SITE_URL,
    Referer: `${SITE_URL}/`,
    'x-app-id': 'edadeal',
    'x-platform': 'desktop',
    'x-app-version': '1.93.0',
    'x-locality-geoid': locality.geoId,
    'x-locality-countrygeoid': '225',
    'x-position-latitude': String(locality.lat),
    'x-position-longitude': String(locality.lng),
    'edadeal-duid': deviceId,
  };
}

interface SearchUrlOptions {
  noContent?: boolean;
  brandUuids?: string[];
}

function buildUrl(query: string, offset: number, options: SearchUrlOptions = {}): string {
  const params = new URLSearchParams({
    text: query,
    checkAdult: 'true',
    excludeAlcohol: 'true',
    disablePlatformSourceExclusion: 'true',
    groupBy: 'sku_or_meta',
    segmentUuid: DRINKS_SEGMENT_UUID,
    limit: String(options.noContent ? 1 : PAGE_LIMIT),
    offset: String(offset),
  });
  if (options.noContent) {
    params.set('noContent', 'true');
  } else {
    params.set('addContent', 'true');
    params.set('allNanoOffers', 'true');
  }
  for (const uuid of options.brandUuids ?? []) params.append('brandUuid', uuid);
  return `${API_URL}?${params.toString()}`;
}

export function batchBrandEntities(
  entities: EdadealBrandEntity[],
  maxCount: number = BRAND_BATCH_MAX_COUNT,
): EdadealBrandEntity[][] {
  const batches: EdadealBrandEntity[][] = [];
  let batch: EdadealBrandEntity[] = [];
  let count = 0;

  for (const entity of entities) {
    const entityCount = Number.isFinite(entity.count) ? Math.max(1, entity.count) : 1;
    if (batch.length > 0 && count + entityCount > maxCount) {
      batches.push(batch);
      batch = [];
      count = 0;
    }
    batch.push(entity);
    count += entityCount;
  }
  if (batch.length > 0) batches.push(batch);
  return batches;
}

const httpApiStrategy: StrategyDefinition = {
  name: 'http_api',
  async run({ source, config }): Promise<Product[]> {
    if (!(await isAllowedByRobots(API_URL))) {
      throw new StrategyNotApplicableError(source, 'http_api', 'robots.txt запрещает обращение к search.edadeal.io');
    }

    const locality = resolveLocality(config.regionId);
    const query = config.query ?? config.keywords?.[0] ?? 'энергетик';
    const maxItems = config.maxItems ?? 2000;
    const headers = buildHeaders(locality, randomUUID());
    const fetchedAt = new Date().toISOString();
    let requestCount = 0;

    const fetchApi = async (url: string): Promise<EdadealSearchResponse> => {
      if (requestCount > 0) await delay(PAGE_DELAY_MS);
      requestCount += 1;
      try {
        const response = await httpGet<EdadealSearchResponse>(url, { headers, retries: 2 });
        return response.data;
      } catch (err) {
        const status = isAxiosError(err) ? err.response?.status : undefined;
        if (status === 401 || status === 403 || status === 429) {
          throw new SourceBlockedError(source, `HTTP ${status}`);
        }
        throw err;
      }
    };

    const facets = await fetchApi(buildUrl(query, 0, { noContent: true }));
    const brandEntities = facets.entities?.brands ?? [];
    const brandByUuid = new Map(brandEntities.map((brand) => [brand.uuid, brand.name]));
    const products = new Map<string, Product>();

    const fetchPages = async (brandUuids: string[] = []): Promise<void> => {
      let offset = 0;
      let total = Number.POSITIVE_INFINITY;
      while (products.size < maxItems && offset < total) {
        const data = await fetchApi(buildUrl(query, offset, { brandUuids }));
        const pageItems = data.items ?? [];
        if (pageItems.length === 0) break;
        total = typeof data.total === 'number' ? data.total : offset + pageItems.length;
        for (const product of mapEdadealResponse(data, config, locality, fetchedAt, brandByUuid)) {
          products.set(product.sourceId, product);
        }
        offset += pageItems.length;
      }
    };

    await fetchPages();
    for (const batch of batchBrandEntities(brandEntities)) {
      if (products.size >= maxItems) break;
      await fetchPages(batch.map((brand) => brand.uuid));
    }

    if (products.size === 0) {
      throw new StrategyNotApplicableError(source, 'http_api', `по запросу "${query}" не найдено акций на энергетики`);
    }

    return [...products.values()].slice(0, maxItems);
  },
};

export const edadealAdapter: SourceAdapter = {
  source: 'edadeal',
  strategies: ['http_api'],
  async fetchPrices(config) {
    const result = await runStrategies({ source: 'edadeal', config }, [httpApiStrategy]);
    return { products: result.products, strategyUsed: result.strategy };
  },
};
