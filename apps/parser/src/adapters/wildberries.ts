import type { Product, SourceAdapter, SourceQueryConfig } from '@canrush/shared';
import { detectChallenge, waitForClear } from '../browser/challenge.js';
import { collectJsonResponses } from '../browser/intercept.js';
import { withSession } from '../browser/session.js';
import { ChallengeRequiredError, SourceBlockedError } from '../fetch/errors.js';
import { runStrategies, type StrategyDefinition } from '../fetch/strategy.js';
import { dedupeProducts, normalizeProduct } from '../normalize.js';

/**
 * Wildberries отдаёт данные каталога через внутренний JSON API (search.wb.ru).
 * Прямые HTTP-запросы к нему сейчас упираются в JS proof-of-work челлендж
 * (см. план, раздел "Результаты живой разведки"), поэтому единственная надёжная
 * стратегия — открыть страницу поиска в настоящем браузере (сохранённая сессия
 * после session:unlock) и пассивно перехватить ответы, которые страница
 * запрашивает сама.
 */

interface WbSizePrice {
  basic?: number;
  product?: number;
}

interface WbProductRaw {
  id: number;
  name: string;
  brand?: string;
  sizes?: Array<{ price?: WbSizePrice }>;
  priceU?: number;
  salePriceU?: number;
}

interface WbSearchResponse {
  data?: {
    products?: WbProductRaw[];
  };
}

const SEARCH_API_MARKER = 'search.wb.ru';

function kopecksToRub(kopecks: number | undefined): number | undefined {
  return typeof kopecks === 'number' ? Math.round(kopecks / 100) : undefined;
}

/** Цены у WB приходят в копейках, актуальная цена — в sizes[].price.product (см. план). */
function extractPrices(raw: WbProductRaw): { price?: number; oldPrice?: number } {
  const size = raw.sizes?.find((s) => s.price?.product != null);
  const price = kopecksToRub(size?.price?.product ?? raw.salePriceU);
  const oldPrice = kopecksToRub(size?.price?.basic ?? raw.priceU);
  if (price == null) return {};
  return { price, oldPrice: oldPrice != null && oldPrice > price ? oldPrice : undefined };
}

function toProducts(raw: WbProductRaw[], config: SourceQueryConfig): Product[] {
  const fetchedAt = new Date().toISOString();
  const maxItems = config.maxItems ?? 200;

  const products = raw.slice(0, maxItems).map((item) => {
    const { price, oldPrice } = extractPrices(item);
    return normalizeProduct(
      'wildberries',
      {
        sourceId: String(item.id),
        name: item.name,
        brand: item.brand,
        price: price ?? 0,
        oldPrice,
        url: `https://www.wildberries.ru/catalog/${item.id}/detail.aspx`,
        category: 'energy_drinks',
      },
      config.brands ?? [],
      fetchedAt,
    );
  });

  return dedupeProducts(products.filter((p) => p.price > 0));
}

const interceptStrategy: StrategyDefinition = {
  name: 'intercept',
  async run({ config }) {
    const query = config.query ?? 'энергетический напиток';
    const searchUrl = `https://www.wildberries.ru/catalog/0/search.aspx?search=${encodeURIComponent(query)}`;

    return withSession('wildberries', { headless: true }, async (context) => {
      const page = await context.newPage();
      const { response, items } = await collectJsonResponses<WbSearchResponse>(page, {
        url: searchUrl,
        matchUrl: (url) => url.includes(SEARCH_API_MARKER),
        scrolls: 8,
      });

      if (items.length > 0) {
        const raw = items.flatMap((item) => item.data?.products ?? []);
        return toProducts(raw, config);
      }

      const state = await waitForClear(page, 10_000);
      const finalState = state === 'challenge' ? await detectChallenge(page, response) : state;
      if (finalState === 'blocked') {
        throw new SourceBlockedError('wildberries', `HTTP ${response?.status() ?? '?'}`);
      }
      throw new ChallengeRequiredError(
        'wildberries',
        'не удалось перехватить ответы search.wb.ru — выполните "session:unlock --source=wildberries"',
      );
    });
  },
};

export const wildberriesAdapter: SourceAdapter = {
  source: 'wildberries',
  strategies: ['intercept'],
  async fetchPrices(config) {
    const result = await runStrategies({ source: 'wildberries', config }, [interceptStrategy]);
    return { products: result.products, strategyUsed: result.strategy };
  },
};
