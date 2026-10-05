import { canonicalProductFlavor } from '@canrush/shared';
import { expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '../src/proxy';
import registry from '../src/lib/catalog/product-slugs.json';
import { catalogGroupSlug, decodeCatalogGroupSlug } from '../src/lib/catalog-query';

it('permanently redirects legacy URLs directly to canonical URLs preserving query parameters', () => {
  const slug = Buffer.from(JSON.stringify(['Burn', 'peach:sugarfree'])).toString('base64url');
  const response = proxy(new NextRequest('https://canrush.ru/catalog/' + slug + '?tab=reviews&utm_source=test'));
  expect(response.status).toBe(301);
  expect(response.headers.get('location')).toBe('https://canrush.ru/catalog/burn-mango-peach-zero?tab=reviews&utm_source=test');
  expect(proxy(new NextRequest('https://canrush.ru/catalog/burn-mango-peach-zero')).headers.get('location')).toBeNull();
});

it('all reserved slugs are unique and resolve to their original identities', () => {
  const entries = Object.entries(registry);
  expect(new Set(entries.map(([, slug]) => slug)).size).toBe(entries.length);
  for (const [key, slug] of entries) {
    const [brand, flavor] = JSON.parse(key) as [string, string];
    expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    const canonicalKey = JSON.stringify([brand, canonicalProductFlavor(brand, flavor)]);
    expect(catalogGroupSlug(brand, flavor)).toBe((registry as Record<string, string>)[canonicalKey]);
    expect(decodeCatalogGroupSlug(slug)).toEqual({ brand, flavor });
  }
});

it('redirects already published readable Vulkan aliases to the edition URL', () => {
  const response = proxy(new NextRequest('https://canrush.ru/catalog/vulkan-citrus-pineapple?tab=reviews'));
  expect(response.status).toBe(301);
  expect(response.headers.get('location')).toBe('https://canrush.ru/catalog/vulkan-citrus?tab=reviews');
});
