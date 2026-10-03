import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
vi.mock('../src/components/catalog-review-form', () => ({ CatalogReviewForm: () => createElement('form') }));
vi.mock('../src/components/catalog-review-item', () => ({ CatalogReviewItem: () => createElement('article') }));
import { CatalogProductReviews } from '../src/components/catalog-product-reviews';
import { isResolvedFlavor } from '@canrush/shared';
import { flavorName } from '../src/lib/catalog-query';
it('never offers a review form or pooled rating for unidentified products', () => {
  for (const flavor of ['unknown', 'unresolved:abc']) {
    expect(isResolvedFlavor(flavor)).toBe(false);
    const html = renderToStaticMarkup(createElement(CatalogProductReviews, { brand: 'Red Bull', flavor, authenticated: true, reviews: [], userReview: null, summary: { count: 1, overall: 5, design: 5, taste: 5 } }));
    expect(html).toContain('Вкус этого предложения не подтверждён');
    expect(html).not.toContain('<form'); expect(html).not.toContain('review-summary-score');
  }
});
it('labels mixtures, sugarfree and unidentified offers without exposing internal keys', () => {
  expect(flavorName('blend:lemon+pineapple:sugarfree')).toBe('Лимон + Ананас · без сахара');
  expect(flavorName('unresolved:abc')).toBe('Вкус не уточнён');
  expect(isResolvedFlavor('tropical')).toBe(true);
});
