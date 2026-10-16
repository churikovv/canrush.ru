import { isAxiosError } from 'axios';
import { CITIES, type City, type Product, type SourceAdapter, type SourceQueryConfig } from '@canrush/shared';
import { SourceBlockedError, StrategyNotApplicableError } from '../fetch/errors.js';
import { runStrategies, type StrategyDefinition } from '../fetch/strategy.js';
import { httpGet } from '../http.js';
import { dedupeProducts, extractVolumeMl, normalizeProduct } from '../normalize.js';
import { isAllowedByRobots } from '../robots.js';

/**
 * Яндекс Лавка — полный прайс даркстора (не только акции). Парсим только «большую
 * лавку» (супермаркет, префикс /supermarket/ в URL): у неё ассортимент примерно вдвое
 * шире, чем у «лавки у дома». Сейчас она есть только в Москве и Петербурге.
 *
 * Одна страница категории на город — обычный GET без браузера. Сервер рендерит
 * каталог в SSR (`<script id="storedehydratedstate-data">`), адрес доставки берётся
 * из cookie `lastGeoCoordinate=[lat,lon]`; без неё Лавка отдаёт демо-каталог.
 * `/api/` закрыт в robots.txt — его не трогаем, страницы каталога разрешены.
 * Без cookie сессии персональных скидок нет, поэтому `currentPrice` — общая цена.
 *
 * Headless-браузеры Лавка блокирует (403 «Доступ к сервису временно запрещён»),
 * а с зарубежных IP часто показывает капчу: не обходим, отдаём SourceBlockedError.
 */

const SITE_URL = 'https://lavka.yandex.ru';
const DEFAULT_CATEGORY = 'energy_beer';
const RETAILER = 'Яндекс Лавка';
const IMAGE_SIZE = '400x400';
const STATE_SCRIPT = /<script[^>]*\bid="storedehydratedstate-data"[^>]*>([\s\S]*?)<\/script>/;
const ENERGY_SUBCATEGORY = /энергетик/iu;
const PERSONAL_PRICE = /только для вас/iu;
const BLOCK_MARKERS = /showcaptcha|smartcaptcha|Доступ к сервису временно запрещ/iu;

export interface LavkaGood {
  type?: string;
  id: string;
  deepLink?: string;
  title?: string;
  longTitle?: string;
  amount?: string;
  currentPrice?: number;
  oldPrice?: number;
  available?: boolean;
  snippetImage?: { url?: string };
  discountPricing?: { promoLabels?: { items?: Array<{ longLabel?: string }> } };
}

interface LavkaSubcategory {
  value?: { title?: string };
  items?: Array<{ id: string }>;
}

/** Часть SSR-состояния страницы категории, которую читает адаптер. */
export interface LavkaPageState {
  startup?: { exists?: boolean; demoLavka?: unknown; depots?: Array<{ isSupermarket?: boolean }> };
  products?: { supermarket?: LavkaGood[] };
  catalog?: { data?: Record<string, { data?: { categories?: Array<{ items?: LavkaSubcategory[] }> } }> };
}

export function lavkaCity(regionId: string | undefined): City | undefined {
  return CITIES.find(city => city.geoId === regionId);
}

export function lavkaCategoryUrl(category: string = DEFAULT_CATEGORY): string {
  return `${SITE_URL}/supermarket/catalog/technical/category/${encodeURIComponent(category)}`;
}

/** Cookie адреса: Лавка выбирает ближайший даркстор по этой точке. */
export function lavkaLocationCookie(city: Pick<City, 'lat' | 'lng'>): string {
  return `lastGeoCoordinate=${encodeURIComponent(JSON.stringify([city.lat, city.lng]))}`;
}

export function extractLavkaState(html: string): LavkaPageState | undefined {
  const raw = html.match(STATE_SCRIPT)?.[1];
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as LavkaPageState;
  } catch {
    return undefined;
  }
}

function cleanText(value: string): string {
  // В названиях Лавки встречаются мягкие переносы, zero-width и разметка <notr>.
  return value.replace(/<\/?notr>/giu, '').replace(/[­​]/gu, '').replace(/\s+/gu, ' ').trim();
}

/** Есть ли у адреса настоящий супермаркет, а не демо-каталог или только «лавка у дома». */
export function hasSupermarket(state: LavkaPageState): boolean {
  const startup = state.startup;
  return startup?.exists === true && !startup.demoLavka
    && (startup.depots ?? []).some(depot => depot.isSupermarket === true)
    && (state.products?.supermarket?.length ?? 0) > 0;
}

/** id товаров из подразделов «Энергетики…»: пиво, вино и коктейли той же категории отбрасываются. */
function energyGoodIds(state: LavkaPageState): Set<string> {
  const ids = new Set<string>();
  for (const [key, entry] of Object.entries(state.catalog?.data ?? {})) {
    if (!key.includes('depotType=supermarket')) continue;
    for (const category of entry.data?.categories ?? []) {
      for (const subcategory of category.items ?? []) {
        if (!ENERGY_SUBCATEGORY.test(subcategory.value?.title ?? '')) continue;
        for (const item of subcategory.items ?? []) ids.add(item.id);
      }
    }
  }
  return ids;
}

function isPositivePrice(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/** Чистый маппинг SSR-состояния в Product[] (без сети — покрыт unit-тестами). */
export function mapLavkaState(state: LavkaPageState, config: SourceQueryConfig, fetchedAt: string): Product[] {
  if (!hasSupermarket(state)) return [];
  const energy = energyGoodIds(state);
  const products: Product[] = [];

  for (const good of state.products?.supermarket ?? []) {
    if (good.type !== 'good' || !energy.has(good.id) || good.available === false || !good.deepLink) continue;
    const title = cleanText(good.longTitle ?? good.title ?? '');
    if (!title || !isPositivePrice(good.currentPrice)) continue;

    // Персональная скидка видна только этому посетителю — показываем обычную цену.
    const personal = (good.discountPricing?.promoLabels?.items ?? []).some(label => PERSONAL_PRICE.test(label.longLabel ?? ''));
    const regular = isPositivePrice(good.oldPrice) && good.oldPrice > good.currentPrice ? good.oldPrice : undefined;
    const price = personal && regular ? regular : good.currentPrice;
    const amount = cleanText(good.amount ?? '');
    const name = amount && extractVolumeMl(title) === undefined ? `${title} ${amount}` : title;
    const imageUrl = good.snippetImage?.url?.replace('{w}x{h}', IMAGE_SIZE);

    const product = normalizeProduct(
      'lavka',
      {
        sourceId: good.id,
        name,
        price,
        oldPrice: personal ? undefined : regular,
        url: `${SITE_URL}/supermarket/good/${encodeURIComponent(good.deepLink)}`,
        imageUrl: imageUrl?.startsWith('https://') ? imageUrl : undefined,
        category: 'energy_drinks',
      },
      config.brands ?? [],
      fetchedAt,
      config.brandAliases ?? {},
      config.flavors ?? [],
      config.flavorAliases ?? {},
    );
    products.push({ ...product, retailer: RETAILER });
  }

  return dedupeProducts(products);
}

const ssrPageStrategy: StrategyDefinition = {
  name: 'http_api',
  async run({ source, config }): Promise<Product[]> {
    const city = lavkaCity(config.regionId);
    if (!city || !(config.cities ?? []).includes(city.id)) {
      throw new StrategyNotApplicableError(source, 'http_api', `большая Лавка не настроена для региона ${config.regionId ?? '—'}`);
    }
    const url = lavkaCategoryUrl(config.categorySlug);
    if (!(await isAllowedByRobots(url))) {
      throw new StrategyNotApplicableError(source, 'http_api', 'robots.txt запрещает страницу каталога Лавки');
    }

    let html: string;
    try {
      const response = await httpGet<string>(url, {
        retries: 1,
        responseType: 'text',
        headers: { Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'ru-RU,ru;q=0.9', Cookie: lavkaLocationCookie(city) },
      });
      html = typeof response.data === 'string' ? response.data : String(response.data);
    } catch (err) {
      const status = isAxiosError(err) ? err.response?.status : undefined;
      if (status === 401 || status === 403 || status === 429) throw new SourceBlockedError(source, `HTTP ${status}`);
      throw err;
    }

    const state = extractLavkaState(html);
    if (!state) {
      if (BLOCK_MARKERS.test(html)) throw new SourceBlockedError(source, 'капча или временный запрет доступа');
      throw new StrategyNotApplicableError(source, 'http_api', 'в странице нет SSR-состояния каталога');
    }
    if (!hasSupermarket(state)) {
      throw new StrategyNotApplicableError(source, 'http_api', `в городе ${city.name} нет большой Лавки`);
    }
    const products = mapLavkaState(state, config, new Date().toISOString()).slice(0, config.maxItems ?? 500);
    if (products.length === 0) {
      throw new StrategyNotApplicableError(source, 'http_api', 'в большой Лавке не найдено энергетиков');
    }
    return products;
  },
};

export const lavkaAdapter: SourceAdapter = {
  source: 'lavka',
  strategies: ['http_api'],
  async fetchPrices(config) {
    const result = await runStrategies({ source: 'lavka', config }, [ssrPageStrategy]);
    return { products: result.products, strategyUsed: result.strategy };
  },
};
