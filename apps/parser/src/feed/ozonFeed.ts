import type { Product } from '@canrush/shared';
import { StrategyNotApplicableError } from '../fetch/errors.js';
import type { StrategyDefinition } from '../fetch/strategy.js';
import { httpGet } from '../http.js';
import { dedupeProducts, normalizeProduct } from '../normalize.js';
import { detectFeedFormat, parseFeed } from './parseFeed.js';

/**
 * У Ozon нет публичного API для покупателей, но зато есть партнёрские товарные
 * фиды (Admitad и аналоги) — легальный и полностью автоматический способ получить
 * актуальные цены без браузера и антибота. Это первая (приоритетная) стратегия
 * для Ozon; если фид не настроен, run.ts перейдёт к intercept-стратегии.
 *
 * URL фида берётся из config.feedUrl (config/products.json) или переменной
 * окружения OZON_FEED_URL — получить его нужно в личном кабинете партнёрской
 * программы (см. apps/parser/README.md).
 */
function matchesCategory(name: string, keywords: string[], brands: string[]): boolean {
  const lower = name.toLowerCase();
  return (
    keywords.some((keyword) => lower.includes(keyword.toLowerCase())) ||
    brands.some((brand) => lower.includes(brand.toLowerCase()))
  );
}

export const ozonFeedStrategy: StrategyDefinition = {
  name: 'feed',
  async run({ source, config }): Promise<Product[]> {
    const feedUrl = config.feedUrl ?? process.env.OZON_FEED_URL;
    if (!feedUrl) {
      throw new StrategyNotApplicableError(source, 'feed', 'не задан feedUrl/OZON_FEED_URL');
    }

    const response = await httpGet<string>(feedUrl, { responseType: 'text', retries: 2 });
    const contentType = response.headers['content-type'];
    const format = detectFeedFormat(feedUrl, typeof contentType === 'string' ? contentType : undefined);
    const offers = parseFeed(String(response.data), format);

    const keywords = config.keywords && config.keywords.length > 0 ? config.keywords : ['энергетик'];
    const brands = config.brands ?? [];
    const matched = offers.filter((offer) => matchesCategory(offer.name, keywords, brands));

    if (matched.length === 0) {
      throw new StrategyNotApplicableError(source, 'feed', 'в фиде не найдено товаров категории энергетиков');
    }

    const fetchedAt = new Date().toISOString();
    const maxItems = config.maxItems ?? 200;
    const products = matched
      .slice(0, maxItems)
      .map((offer) =>
        normalizeProduct(
          source,
          offer,
          brands,
          fetchedAt,
          config.brandAliases ?? {},
          config.flavors ?? [],
          config.flavorAliases ?? {},
        ),
      );

    return dedupeProducts(products);
  },
};
