import type { SourceAdapter } from '@canrush/shared';
import { detectChallenge, waitForClear } from '../browser/challenge.js';
import { fetchJsonInPage } from '../browser/inPageFetch.js';
import { withSession } from '../browser/session.js';
import { ChallengeRequiredError, SourceBlockedError, StrategyNotApplicableError } from '../fetch/errors.js';
import { runStrategies, type StrategyDefinition } from '../fetch/strategy.js';
import { dedupeProducts, normalizeProduct } from '../normalize.js';

/**
 * Магнит отдаёт каталог через веб-гейтвей web-gateway.middle-api.magnit.ru,
 * которому нужны выбранный магазин (storeCode) и id категории (categoryIDs) —
 * оба параметра сайт хранит в состоянии SPA, а не в URL, поэтому надёжного
 * автообнаружения нет (в отличие от Пятёрочки). Формат запроса/ответа подтверждён
 * по независимо разобранному запросу (Хабр Q&A "Парсинг сайта магнит?"), включая
 * распространённую ошибку новичка (числа/булевы отправляли строками — сервер
 * отвечал 400): в JSON-теле ниже используются настоящие number/boolean.
 *
 * storeCode и categoryId нужно один раз подсмотреть в DevTools (Network → XHR →
 * запрос "goods") при "session:unlock --source=magnit" и прописать в
 * config/products.json — см. apps/parser/README.md.
 */

const API_URL = 'https://web-gateway.middle-api.magnit.ru/v3/goods';
const MAIN_SITE_URL = 'https://magnit.ru/';

interface MagnitPromotion {
  discountPercent?: number;
  oldPrice?: number;
}

interface MagnitGoodRaw {
  id: string | number;
  name: string;
  price: number;
  promotion?: MagnitPromotion | null;
  gallery?: string[];
}

interface MagnitGoodsResponse {
  goods?: MagnitGoodRaw[];
}

function kopecksToRub(value: number | undefined | null): number | undefined {
  return typeof value === 'number' ? Math.round(value) / 100 : undefined;
}

function extractPrices(raw: MagnitGoodRaw): { price?: number; oldPrice?: number } {
  const price = kopecksToRub(raw.price);
  const oldPrice = kopecksToRub(raw.promotion?.oldPrice);
  if (price == null) return {};
  return { price, oldPrice: oldPrice != null && oldPrice > price ? oldPrice : undefined };
}

function parseCategoryIds(categoryId: string | undefined): number[] {
  return (categoryId ?? '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
}

const inPageFetchStrategy: StrategyDefinition = {
  name: 'in_page_fetch',
  async run({ config }) {
    const categoryIds = parseCategoryIds(config.categoryId);
    if (categoryIds.length === 0) {
      throw new StrategyNotApplicableError(
        'magnit',
        'in_page_fetch',
        'не задан categoryId в config/products.json (найдите через DevTools, см. README)',
      );
    }
    if (!config.storeCode) {
      throw new StrategyNotApplicableError(
        'magnit',
        'in_page_fetch',
        'не задан storeCode в config/products.json (найдите через DevTools, см. README)',
      );
    }

    return withSession('magnit', { headless: true }, async (context) => {
      const page = await context.newPage();
      const response = await page.goto(MAIN_SITE_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      const waited = await waitForClear(page, 12_000);
      const finalState = waited === 'challenge' ? await detectChallenge(page, response) : waited;
      if (finalState === 'blocked') {
        throw new SourceBlockedError('magnit', `HTTP ${response?.status() ?? '?'}`);
      }
      if (finalState === 'challenge') {
        throw new ChallengeRequiredError(
          'magnit',
          'проверка браузера не пройдена автоматически — выполните "session:unlock --source=magnit"',
        );
      }

      const pageSize = Math.min(config.maxItems ?? 36, 36);

      let data: MagnitGoodsResponse;
      try {
        data = await fetchJsonInPage<MagnitGoodsResponse>(page, API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: '*/*' },
          body: JSON.stringify({
            categoryIDs: categoryIds,
            includeForAdults: true,
            onlyDiscount: false,
            order: 'desc',
            pagination: { number: 1, size: pageSize },
            shopType: '1',
            sortBy: 'price',
            storeCodes: [config.storeCode],
          }),
        });
      } catch (err) {
        throw new ChallengeRequiredError(
          'magnit',
          `внутренний API отклонил запрос (${(err as Error).message}) — проверьте storeCode/categoryId или выполните session:unlock`,
        );
      }

      const fetchedAt = new Date().toISOString();
      const products = (data.goods ?? []).map((item) => {
        const { price, oldPrice } = extractPrices(item);
        return normalizeProduct(
          'magnit',
          {
            sourceId: String(item.id),
            name: item.name,
            price: price ?? 0,
            oldPrice,
            // Точный URL карточки товара magnit.ru не подтверждён живым запросом
            // (сайт был заблокирован при разведке) — стоит перепроверить вручную.
            url: `https://magnit.ru/product/${item.id}`,
            imageUrl: item.gallery?.[0],
            category: 'energy_drinks',
          },
          config.brands ?? [],
          fetchedAt,
          config.brandAliases ?? {},
          config.flavors ?? [],
          config.flavorAliases ?? {},
        );
      });

      return dedupeProducts(products.filter((p) => p.price > 0));
    });
  },
};

export const magnitAdapter: SourceAdapter = {
  source: 'magnit',
  strategies: ['in_page_fetch'],
  async fetchPrices(config) {
    const result = await runStrategies({ source: 'magnit', config }, [inPageFetchStrategy]);
    return { products: result.products, strategyUsed: result.strategy };
  },
};
