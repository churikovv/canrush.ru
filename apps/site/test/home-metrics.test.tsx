import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CatalogGroup, FlavorVariant } from '@canrush/shared';
import { HomeServices } from '@/components/home-services';
import { catalogMetrics } from '@/lib/home-metrics';

const variant = (retailer: string, price: number): FlavorVariant => ({ source: 'edadeal', retailer, price, volumeMl: 449, url: 'https://example.test', fetchedAt: '2026-10-01T00:00:00Z' });
const group = (brand: string, variants: FlavorVariant[]): CatalogGroup => ({ brand, flavor: 'original', variants, minPrice: Math.min(...variants.map(v => v.price)) });

describe('home metrics', () => {
  it('counts drinks and distinct stores with prices', () => {
    const city = [group('Red Bull', [variant('Магнит', 99), variant('Лента', 109)]), group('Burn', [variant('Магнит', 89)])];
    // Drinks count the whole catalog, archive included; stores only the city's offers.
    expect(catalogMetrics(city, [...city, group('Tornado', [])])).toEqual({ stores: 2, drinks: 3 });
    expect(catalogMetrics([], [])).toEqual({ stores: 0, drinks: 0 });
  });

  it('renders the four big categories and the small icons', () => {
    const html = renderToStaticMarkup(createElement(HomeServices, {
      metrics: { reviews: 1234, tierLists: 0, stores: 6, drinks: 21 }, contest: null, joined: false,
      engine: { taken: 10, number: null } as never,
    }));
    const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map(match => match[1]);
    expect(hrefs.slice(0, 4)).toEqual(['/catalog', '/prices', '/market/stores', '/tierlists']);
    expect(hrefs).toContain('/leaderboard');
    expect(hrefs).toContain('/engine');
    expect(hrefs).not.toContain('/contest');
    expect(html).toContain('Каталог<small> · 21</small>');
    expect(html).toContain('Лидеры');
    expect(html).toContain('Бета сайта');
  });
});
