import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CatalogGroup, FlavorVariant } from '@canrush/shared';
import { HomeMetrics } from '@/components/home-metrics';
import { catalogMetrics } from '@/lib/home-metrics';

const variant = (retailer: string, price: number): FlavorVariant => ({ source: 'edadeal', retailer, price, volumeMl: 449, url: 'https://example.test', fetchedAt: '2026-10-01T00:00:00Z' });
const group = (brand: string, variants: FlavorVariant[]): CatalogGroup => ({ brand, flavor: 'original', variants, minPrice: Math.min(...variants.map(v => v.price)) });

describe('home metrics', () => {
  it('counts drinks and distinct stores with prices', () => {
    expect(catalogMetrics([group('Red Bull', [variant('Магнит', 99), variant('Лента', 109)]), group('Burn', [variant('Магнит', 89)])])).toEqual({ stores: 2, drinks: 2 });
    expect(catalogMetrics([])).toEqual({ stores: 0, drinks: 0 });
  });

  it('renders a tile per non-zero total, each linking to its section', () => {
    const html = renderToStaticMarkup(createElement(HomeMetrics, { data: { reviews: 1234, tierLists: 0, stores: 6, drinks: 21 } }));
    expect(html).toContain(`<strong>${(1234).toLocaleString('ru-RU')}</strong><span>оценки</span>`);
    expect(html).toContain('<strong>6</strong><span>магазинов с ценами</span>');
    expect(html).toContain('<strong>21</strong><span>напиток</span>');
    expect(html).toContain('href="/prices"');
    expect(html).not.toContain('тирлист');
  });

  it('renders nothing without data', () => {
    expect(renderToStaticMarkup(createElement(HomeMetrics, { data: { reviews: 0, tierLists: 0, stores: 0, drinks: 0 } }))).toBe('');
  });
});
