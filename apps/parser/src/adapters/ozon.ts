import type { Product, SourceAdapter } from '@canrush/shared';
import { detectChallenge, waitForClear } from '../browser/challenge.js';
import { collectJsonResponses } from '../browser/intercept.js';
import { withSession } from '../browser/session.js';
import { ChallengeRequiredError, SourceBlockedError } from '../fetch/errors.js';
import { runStrategies, type StrategyDefinition } from '../fetch/strategy.js';
import { ozonFeedStrategy } from '../feed/ozonFeed.js';
import { dedupeProducts, normalizeProduct } from '../normalize.js';

/**
 * У Ozon нет публичного API для покупателей и сайт закрыт антиботом (см. план).
 * Приоритет — партнёрский фид (ozonFeedStrategy, полностью легально и без браузера).
 * Фоллбэк — открыть страницу поиска в браузере и перехватить внутренний JSON,
 * который сама страница запрашивает у composer-api.bx/page/json/v2.
 *
 * ВАЖНО: точная форма виджетов composer-api у Ozon нередко меняется (это отмечают
 * все независимые парсеры). extractItemFields ниже — намеренно эвристический
 * разбор (ищем текст с "₽" и самую длинную "похожую на название" строку), а не
 * жёстко прописанные пути полей. Если после реального session:unlock результат
 * пустой/некорректный — первое, что нужно перепроверить, это SEARCH_WIDGET_KEY_PATTERN
 * и структуру item.mainState на актуальной выдаче.
 */

interface OzonAction {
  link?: string;
}

interface OzonRawItem {
  action?: OzonAction;
  skuId?: string | number;
  id?: string | number;
  sku?: string | number;
  mainState?: unknown;
}

interface OzonComposerResponse {
  widgetStates?: Record<string, string>;
}

const COMPOSER_API_MARKER = 'composer-api.bx/page/json/v2';
const SEARCH_WIDGET_KEY_PATTERN = /searchresults/i;

function collectStrings(node: unknown, out: string[]): void {
  if (typeof node === 'string') {
    out.push(node);
  } else if (Array.isArray(node)) {
    for (const item of node) collectStrings(item, out);
  } else if (node && typeof node === 'object') {
    for (const value of Object.values(node)) collectStrings(value, out);
  }
}

function extractPriceRub(text: string): number | undefined {
  const match = text.match(/(\d[\d\s]{0,9})\s*₽/);
  if (!match?.[1]) return undefined;
  const value = parseInt(match[1].replace(/\s/g, ''), 10);
  return Number.isFinite(value) ? value : undefined;
}

interface ExtractedFields {
  id?: string;
  name?: string;
  price?: number;
  oldPrice?: number;
  url?: string;
}

function extractItemFields(item: OzonRawItem): ExtractedFields {
  const id = item.skuId ?? item.id ?? item.sku;
  const link = item.action?.link;

  const strings: string[] = [];
  collectStrings(item.mainState ?? item, strings);

  const prices = [...new Set(strings.map(extractPriceRub).filter((p): p is number => p != null))].sort(
    (a, b) => a - b,
  );
  const name = strings
    .filter((s) => !s.includes('₽') && s.trim().length > 3 && !/^\d+([.,]\d+)?$/.test(s.trim()))
    .sort((a, b) => b.length - a.length)[0];

  return {
    id: id != null ? String(id) : undefined,
    name,
    price: prices[0],
    oldPrice: prices.length > 1 ? prices[prices.length - 1] : undefined,
    url: link ? `https://www.ozon.ru${link}` : undefined,
  };
}

const interceptStrategy: StrategyDefinition = {
  name: 'intercept',
  async run({ config }) {
    const query = config.query ?? 'энергетический напиток';
    const searchUrl = `https://www.ozon.ru/search/?text=${encodeURIComponent(query)}`;

    return withSession('ozon', { headless: true }, async (context) => {
      const page = await context.newPage();
      const { response, items } = await collectJsonResponses<OzonComposerResponse>(page, {
        url: searchUrl,
        matchUrl: (url) => url.includes(COMPOSER_API_MARKER),
        scrolls: 8,
      });

      const rawItems: OzonRawItem[] = [];
      for (const payload of items) {
        for (const [key, value] of Object.entries(payload.widgetStates ?? {})) {
          if (!SEARCH_WIDGET_KEY_PATTERN.test(key)) continue;
          try {
            const widget = JSON.parse(value) as { items?: OzonRawItem[] };
            if (Array.isArray(widget.items)) rawItems.push(...widget.items);
          } catch {
            // не JSON или не тот виджет — пропускаем
          }
        }
      }

      if (rawItems.length === 0) {
        const state = await waitForClear(page, 10_000);
        const finalState = state === 'challenge' ? await detectChallenge(page, response) : state;
        if (finalState === 'blocked') {
          throw new SourceBlockedError('ozon', `HTTP ${response?.status() ?? '?'}`);
        }
        throw new ChallengeRequiredError(
          'ozon',
          'не удалось перехватить composer-api — выполните "session:unlock --source=ozon"',
        );
      }

      const fetchedAt = new Date().toISOString();
      const products = rawItems
        .map((item) => {
          const fields = extractItemFields(item);
          if (!fields.id || !fields.name || fields.price == null || !fields.url) return null;
          return normalizeProduct(
            'ozon',
            {
              sourceId: fields.id,
              name: fields.name,
              price: fields.price,
              oldPrice: fields.oldPrice,
              url: fields.url,
              category: 'energy_drinks',
            },
            config.brands ?? [],
            fetchedAt,
          );
        })
        .filter((p): p is Product => p !== null);

      return dedupeProducts(products).slice(0, config.maxItems ?? 100);
    });
  },
};

export const ozonAdapter: SourceAdapter = {
  source: 'ozon',
  strategies: ['feed', 'intercept'],
  async fetchPrices(config) {
    const result = await runStrategies({ source: 'ozon', config }, [ozonFeedStrategy, interceptStrategy]);
    return { products: result.products, strategyUsed: result.strategy };
  },
};
