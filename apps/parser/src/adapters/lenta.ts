import type { Page } from 'playwright';
import type { SourceAdapter } from '@canrush/shared';
import { detectChallenge, waitForClear } from '../browser/challenge.js';
import { fetchJsonInPage } from '../browser/inPageFetch.js';
import { withSession } from '../browser/session.js';
import { ChallengeRequiredError, SourceBlockedError } from '../fetch/errors.js';
import { runStrategies, type StrategyDefinition } from '../fetch/strategy.js';
import { dedupeProducts, normalizeProduct } from '../normalize.js';

/**
 * lenta.com отдаёт каталог через собственный JSON API (тот же домен, что и сайт),
 * закрытый антибот-защитой Qrator (виден __qrator/qauth.js и HTTP 401 при прямом
 * запросе без прохождения JS-челленджа — см. план). Эндпоинты и форма ответа
 * подтверждены по опубликованному клиенту stas12312/lentacom-bot (MIT).
 *
 * Стратегия in_page_fetch: открываем главную страницу в персистентной сессии —
 * настоящий браузер проходит Qrator-челлендж сам, дальше дёргаем API из контекста
 * той же страницы (куки применяются автоматически, т.к. API на том же домене).
 */

const API_BASE = 'https://lenta.com/api';
const MAIN_SITE_URL = 'https://lenta.com/';

interface LentaImage {
  medium?: string;
  thumbnail?: string;
}

interface LentaSkuRaw {
  code: string;
  title: string;
  brand?: string | null;
  regularPrice: number;
  discountPrice?: number | null;
  webUrl: string;
  image?: LentaImage | null;
}

interface LentaSearchResponse {
  skus?: LentaSkuRaw[];
}

interface LentaStore {
  id: string;
  isEcomAvailable?: boolean;
  isDeliveryAvailable?: boolean;
}

async function getDefaultStoreId(page: Page): Promise<string | undefined> {
  try {
    const stores = await fetchJsonInPage<LentaStore[]>(page, `${API_BASE}/v1/stores`);
    const preferred = stores.find((s) => s.isDeliveryAvailable || s.isEcomAvailable);
    return (preferred ?? stores[0])?.id;
  } catch {
    return undefined;
  }
}

const inPageFetchStrategy: StrategyDefinition = {
  name: 'in_page_fetch',
  async run({ config }) {
    return withSession('lenta', { headless: true }, async (context) => {
      const page = await context.newPage();
      const response = await page.goto(MAIN_SITE_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      const waited = await waitForClear(page, 15_000);
      const finalState = waited === 'challenge' ? await detectChallenge(page, response) : waited;
      if (finalState === 'blocked') {
        throw new SourceBlockedError('lenta', `HTTP ${response?.status() ?? '?'}`);
      }
      if (finalState === 'challenge') {
        throw new ChallengeRequiredError(
          'lenta',
          'антибот-проверка (Qrator) не пройдена автоматически — выполните "session:unlock --source=lenta"',
        );
      }

      const storeId = config.storeCode ?? (await getDefaultStoreId(page));
      if (!storeId) {
        throw new ChallengeRequiredError(
          'lenta',
          'не удалось определить магазин — выполните "session:unlock --source=lenta" и выберите адрес',
        );
      }

      const query = config.query ?? config.keywords?.[0] ?? 'энергетик';
      const limit = Math.min(config.maxItems ?? 48, 100);

      let data: LentaSearchResponse;
      try {
        data = await fetchJsonInPage<LentaSearchResponse>(page, `${API_BASE}/v1/stores/${storeId}/skus`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            searchValue: query,
            limit,
            offset: 0,
            maxPrice: null,
            minPrice: null,
            sorting: null,
            onlyDiscounts: false,
            nodeCode: null,
          }),
        });
      } catch (err) {
        throw new ChallengeRequiredError(
          'lenta',
          `внутренний API отклонил запрос (${(err as Error).message}) — возможно, протухла сессия, выполните session:unlock`,
        );
      }

      const fetchedAt = new Date().toISOString();
      const products = (data.skus ?? []).map((sku) => {
        const regular = sku.regularPrice;
        const discount = sku.discountPrice ?? undefined;
        const price = discount != null && discount < regular ? discount : regular;
        const oldPrice = discount != null && discount < regular ? regular : undefined;
        return normalizeProduct(
          'lenta',
          {
            sourceId: sku.code,
            name: sku.title,
            brand: sku.brand ?? undefined,
            price,
            oldPrice,
            url: sku.webUrl,
            imageUrl: sku.image?.medium ?? sku.image?.thumbnail,
            category: 'energy_drinks',
          },
          config.brands ?? [],
          fetchedAt,
        );
      });

      return dedupeProducts(products.filter((p) => p.price > 0));
    });
  },
};

export const lentaAdapter: SourceAdapter = {
  source: 'lenta',
  strategies: ['in_page_fetch'],
  async fetchPrices(config) {
    const result = await runStrategies({ source: 'lenta', config }, [inPageFetchStrategy]);
    return { products: result.products, strategyUsed: result.strategy };
  },
};
