import type { Page } from 'playwright';
import type { SourceAdapter } from '@canrush/shared';
import { detectChallenge, waitForClear } from '../browser/challenge.js';
import { fetchJsonInPage } from '../browser/inPageFetch.js';
import { withSession } from '../browser/session.js';
import { sniffRequestHeaders } from '../browser/sniffHeaders.js';
import { ChallengeRequiredError, SourceBlockedError } from '../fetch/errors.js';
import { runStrategies, type StrategyDefinition } from '../fetch/strategy.js';
import { dedupeProducts, normalizeProduct } from '../normalize.js';

/**
 * Пятёрочка (5ka.ru) отдаёт каталог через внутренний JSON API на отдельном
 * домене (5d.5ka.ru), который требует нескольких нестандартных заголовков
 * (x-app-version/x-device-id/x-platform) и выбранного магазина доставки в сессии.
 * Структура эндпоинтов и ответа подтверждена по опубликованным тестовым фикстурам
 * справочной библиотеки Open-Inflation/pyaterochka_api (MIT), а не угадана.
 *
 * Стратегия in_page_fetch:
 *  1. Открываем главную страницу в персистентной сессии — сама SPA при загрузке
 *     обращается к CATALOG_URL, и мы пассивно подслушиваем нужные заголовки
 *     из этого запроса (sniffRequestHeaders), не подделывая их.
 *  2. Берём sapCode выбранного магазина из localStorage.DeliveryPanelStore —
 *     если магазин не выбран, нужен ручной session:unlock.
 *  3. Дёргаем /catalog/v3/stores/{sapCode}/search?q=... из контекста страницы.
 */

const CATALOG_URL = 'https://5d.5ka.ru/api';
const MAIN_SITE_URL = 'https://5ka.ru';

interface FiveKaPrices {
  regular: string | null;
  discount: string | null;
}

interface FiveKaProductRaw {
  plu: number;
  name: string;
  image_links?: { small?: string[]; normal?: string[] };
  prices: FiveKaPrices;
  is_available?: boolean;
}

interface FiveKaSearchResponse {
  products?: FiveKaProductRaw[];
}

interface DeliveryPanelStore {
  selectedStore?: { sapCode?: string };
}

function parsePrice(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : undefined;
}

function extractPrices(raw: FiveKaProductRaw): { price?: number; oldPrice?: number } {
  const regular = parsePrice(raw.prices?.regular);
  const discount = parsePrice(raw.prices?.discount);
  if (discount != null && regular != null && discount < regular) {
    return { price: discount, oldPrice: regular };
  }
  return { price: discount ?? regular };
}

async function getSapCode(page: Page): Promise<string | undefined> {
  const raw = await page.evaluate(() => localStorage.getItem('DeliveryPanelStore'));
  if (!raw) return undefined;
  try {
    return (JSON.parse(raw) as DeliveryPanelStore).selectedStore?.sapCode;
  } catch {
    return undefined;
  }
}

async function getDeviceId(page: Page): Promise<string | undefined> {
  return (await page.evaluate(() => localStorage.getItem('deviceId'))) ?? undefined;
}

/** У 5ka.ru встречается простой чекбокс-антибот (не полноценная капча) — кликаем, если он есть. */
async function tryClickRobotCheckbox(page: Page): Promise<void> {
  try {
    await page.locator('label[for="is-robot"].captcha-label').click({ timeout: 5000 });
  } catch {
    // чекбокса нет либо клик не потребовался — это нормально
  }
}

const inPageFetchStrategy: StrategyDefinition = {
  name: 'in_page_fetch',
  async run({ config }) {
    return withSession('pyaterochka', { headless: true }, async (context) => {
      const page = await context.newPage();
      const headersPromise = sniffRequestHeaders(page, CATALOG_URL, [
        'x-app-version',
        'x-device-id',
        'x-platform',
      ]);

      const response = await page.goto(MAIN_SITE_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await tryClickRobotCheckbox(page);

      const waited = await waitForClear(page, 12_000);
      const finalState = waited === 'challenge' ? await detectChallenge(page, response) : waited;
      if (finalState === 'blocked') {
        throw new SourceBlockedError('pyaterochka', `HTTP ${response?.status() ?? '?'}`);
      }
      if (finalState === 'challenge') {
        throw new ChallengeRequiredError(
          'pyaterochka',
          'проверка браузера не пройдена автоматически — выполните "session:unlock --source=pyaterochka"',
        );
      }

      const sapCode = config.sapCode ?? (await getSapCode(page));
      if (!sapCode) {
        throw new ChallengeRequiredError(
          'pyaterochka',
          'не выбран магазин доставки — выполните "session:unlock --source=pyaterochka" и укажите адрес',
        );
      }

      const sniffedHeaders = await headersPromise;
      const deviceId = sniffedHeaders['x-device-id'] ?? (await getDeviceId(page));
      const query = config.query ?? config.keywords?.[0] ?? 'энергетик';
      const limit = Math.min(config.maxItems ?? 48, 100);
      const url =
        `${CATALOG_URL}/catalog/v3/stores/${sapCode}/search` +
        `?mode=store&include_restrict=true&limit=${limit}&q=${encodeURIComponent(query)}`;

      let data: FiveKaSearchResponse;
      try {
        data = await fetchJsonInPage<FiveKaSearchResponse>(page, url, {
          headers: {
            Accept: 'application/json, text/plain, */*',
            ...sniffedHeaders,
            ...(deviceId ? { 'x-device-id': deviceId } : {}),
          },
        });
      } catch (err) {
        throw new ChallengeRequiredError(
          'pyaterochka',
          `внутренний API отклонил запрос (${(err as Error).message}) — возможно, протухла сессия, выполните session:unlock`,
        );
      }

      const fetchedAt = new Date().toISOString();
      const products = (data.products ?? []).map((item) => {
        const { price, oldPrice } = extractPrices(item);
        return normalizeProduct(
          'pyaterochka',
          {
            sourceId: String(item.plu),
            name: item.name,
            price: price ?? 0,
            oldPrice,
            // Точный URL карточки товара не подтверждён живым запросом (сайт был
            // заблокирован при разведке) — разумное предположение по структуре SPA,
            // стоит перепроверить вручную после первого успешного unlock.
            url: `https://5ka.ru/product/${item.plu}`,
            imageUrl: item.image_links?.normal?.[0] ?? item.image_links?.small?.[0],
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

export const pyaterochkaAdapter: SourceAdapter = {
  source: 'pyaterochka',
  strategies: ['in_page_fetch'],
  async fetchPrices(config) {
    const result = await runStrategies({ source: 'pyaterochka', config }, [inPageFetchStrategy]);
    return { products: result.products, strategyUsed: result.strategy };
  },
};
