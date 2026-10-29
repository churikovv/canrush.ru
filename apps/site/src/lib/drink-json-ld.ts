import type { CatalogGroup } from '@canrush/shared';
import { catalogGroupSlug, flavorName } from '@/lib/catalog-query';
import { SITE_URL } from '@/lib/seo';

/**
 * Schema.org `Product` for a drink's page, so search engines can show its rating and prices in results: the brand, the
 * cover, the members' average (out of 10, with the number of reviews) and the offers of the visitor's city as one
 * `AggregateOffer` in roubles. Search engines reject a Product with neither a rating nor offers, so then there is none.
 */
export function drinkJsonLd(group: Pick<CatalogGroup, 'brand' | 'flavor' | 'variants' | 'coverImageUrl'> & { fullName?: string }, rating: { count: number; overall: number }, description?: string): string | null {
  const prices = group.variants.map(offer => offer.price).filter(price => Number.isFinite(price) && price > 0);
  if (!prices.length && rating.count < 1) return null;
  const name = group.fullName?.trim() || `${group.brand} ${flavorName(group.flavor)}`;
  const url = `${SITE_URL}/catalog/${catalogGroupSlug(group.brand, group.flavor)}`;
  const image = group.coverImageUrl ? (group.coverImageUrl.startsWith('/') ? `${SITE_URL}${group.coverImageUrl}` : group.coverImageUrl) : null;
  const round = (value: number) => Math.round(value * 100) / 100;
  return JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Product', name, url, category: 'Энергетические напитки',
    brand: { '@type': 'Brand', name: group.brand },
    ...(image ? { image: [image] } : {}),
    ...(description ? { description } : {}),
    ...(rating.count > 0 ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: Math.round(rating.overall * 10) / 10, bestRating: 10, worstRating: 1, ratingCount: rating.count, reviewCount: rating.count } } : {}),
    ...(prices.length ? { offers: { '@type': 'AggregateOffer', priceCurrency: 'RUB', lowPrice: round(Math.min(...prices)), highPrice: round(Math.max(...prices)), offerCount: prices.length, availability: 'https://schema.org/InStock', url } } : {}),
  }).replace(/</g, '\\u003c');
}
