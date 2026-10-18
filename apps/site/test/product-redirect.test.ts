import { canonicalProductFlavor, reviewedProductIdentity } from '@canrush/shared';
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
    const canonical = reviewedProductIdentity(brand, flavor);
    const canonicalKey = JSON.stringify([canonical.brand, canonicalProductFlavor(canonical.brand, canonical.flavor)]);
    expect(catalogGroupSlug(brand, flavor)).toBe((registry as Record<string, string>)[canonicalKey] ?? catalogGroupSlug(canonical.brand, canonical.flavor));
    expect(decodeCatalogGroupSlug(slug)).toEqual({ brand, flavor });
  }
});

it('redirects already published readable Vulkan aliases to the edition URL', () => {
  const response = proxy(new NextRequest('https://canrush.ru/catalog/vulkan-citrus-pineapple?tab=reviews'));
  expect(response.status).toBe(301);
  expect(response.headers.get('location')).toBe('https://canrush.ru/catalog/vulkan-citrus?tab=reviews');
});

it('keeps the published hashed URL of the archived Go Champ grapefruit and points it at the watermelon + grapefruit can', () => {
  expect(decodeCatalogGroupSlug('go-champ-grapefruit-33n3hifs6v49t')).toEqual({ brand: 'Go Champ', flavor: 'grapefruit' });
  expect(catalogGroupSlug('Go Champ', 'grapefruit')).toBe('go-champ-grapefruit-watermelon');
});

it('points the published Tassay flyer URL at the original edition', () => {
  expect(decodeCatalogGroupSlug('tassay-unresolved-c5563315b9f9cea139f1f86d-pxdukzagvkbd')).toEqual({ brand: 'Tassay', flavor: 'unresolved:c5563315b9f9cea139f1f86d' });
  expect(catalogGroupSlug('Tassay', 'unresolved:c5563315b9f9cea139f1f86d')).toBe('tassay-original');
});
