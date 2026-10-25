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

it('points reported duplicate URLs at the live products', () => {
  for (const [slug, canonical] of [
    ['drive-me-unresolved-694eb7e1e8c49093e30aa420-d5h2j9n098jg', catalogGroupSlug('Drive Me', 'original')],
    ['drive-me-zero-2q56gjzcm38u7', catalogGroupSlug('Drive Me', 'blend:guava+mango:sugarfree')],
    ['volt-energy-mango', catalogGroupSlug('Volt Energy', 'blend:coconut+mango')],
    ['adrenaline-rush-lime-melon-mint-zero-ivqlpyxs5rir', catalogGroupSlug('Adrenaline Rush', 'blend:lime+melon+mint')],
    ['red-bull-citrus', catalogGroupSlug('Red Bull', 'lime')],
    ['burn-unresolved-8c920057d6960a32c56e29af-g158f6tuhk6l', catalogGroupSlug('Burn', 'mango')],
    ['rocket-unresolved-e5fcf35a0a30ae2756bac51d', catalogGroupSlug('Rocket', 'original')],
    ['tornado-unresolved-a8dfc8f215a4a82ed09c9312-226f8qwpzk3s7', catalogGroupSlug('Tornado', 'tornado_lemoncake')],
    ['monster-monster-vr46', 'monster-monster-vr46-zero'],
    ['mix-orange-3n7d5swpvat7d', catalogGroupSlug('Burn', 'orange')],
    ['mix-citrus-grapefruit-lemon-orange', catalogGroupSlug('By Баста', 'blend:grapefruit+lemon+orange')],
    ['mix-grapefruit', catalogGroupSlug('By Баста', 'blend:grapefruit+lemon+orange')],
    ['burn-peach', 'burn-mango-peach-zero'],
    ['adrenaline-rush-unresolved-788ec3c0fa3f02185b46d9d2-tp8t4m3a23d3', catalogGroupSlug('Adrenaline Rush', 'mystery')],
    ['adrenaline-rush-unresolved-51389a77e8bb7f6f1fd3e3d7-2697hiccjx9tz', catalogGroupSlug('Adrenaline Rush', 'mystery')],
    ['bombbar-unresolved-cfa54864d41bcfc651f9417b', 'bombbar-gin-tonic-zero'],
    ['tornado-unresolved-4d34814885aeed76ebbe4c33-3cg77xik7mcrb', catalogGroupSlug('Tornado', 'tornado_boost')],
    ['x-turbo-unresolved-210223d3b2fa9c0cc7b69564', catalogGroupSlug('X-Turbo', 'blend:berry+raspberry')],
    ['krasnaya-ptitsa-ashan-unresolved-9a6ed4c919a0e7a38a8b714d', catalogGroupSlug('Красная птица АШАН', 'original')],
    ['red-bull-unresolved-8688970ebadb429a9212a309-11xdj09dxwto7', catalogGroupSlug('Red Bull', 'original')],
    ['my-element-unresolved-e45481e1e9fd04a090e3575a', 'my-element-cotton-candy'],
    ['lit-energy-berry', 'lit-energy-original'],
    ['flash-up-barberry', 'flash-up-ultra'],
    ['pulseup-unresolved-9427ce79d3fe662f3f4cd6a6-105kk4pcwk301', 'pulseup-pulse-your'],
    ['pulse-up-berry', 'pulseup-berry'],
    ['flash-up-mango', 'flash-up-mango-pineapple'],
    ['adrenaline-game-fuel-mango', 'adrenaline-rush-mango'],
    ['ninja-peach', 'ninja-star-peach'],
    ['ninja-cherry', 'ninja-star-cherry'],
  ]) {
    const identity = decodeCatalogGroupSlug(slug!);
    expect(identity).not.toBeNull();
    expect(catalogGroupSlug(identity!.brand, identity!.flavor)).toBe(canonical);
    expect(canonical).not.toBe(slug);
  }
});

it('points HQD Energy cards at Ashkudi and the puer at By Баста', () => {
  for (const [slug, canonical] of [
    ['hqd-energy-cherry', 'ashkudi-cherry'],
    ['hqd-energy-lemon-raspberry', 'ashkudi-lemon-raspberry'],
    ['hqd-energy-blackcurrant', 'ashkudi-blackcurrant'],
    ['hqd-energy-grape-ckokem45ltqp', 'ashkudi-grape'],
    ['hqd-energy-unresolved-9d9d0b3f7a4bc6b815a9cf2f', 'ashkudi-sour'],
    ['ashkudi-unresolved-8ee5cd706b59f0c6ac18da05', 'ashkudi-sour'],
    ['ashkudi-unresolved-7652380e773a72f6d8361b9d', 'ashkudi-dynamo-zero'],
    ['doma-by-guf-tangerine-puer', 'by-basta-tangerine-puer'],
    ['doma-by-guf-unresolved-da30249c14de0adb913924fc', 'by-basta-tangerine-puer'],
    ['by-basta-unresolved-f7bd5f2b797a66d9e250bbb4', 'by-basta-original'],
  ] as const) {
    const response = proxy(new NextRequest(`https://canrush.ru/catalog/${slug}`));
    expect([slug, response.status, response.headers.get('location')]).toEqual([slug, 301, `https://canrush.ru/catalog/${canonical}`]);
  }
});

it('points the member-added Piranha\'s «berry» card at the original Slam Classic Energy card', () => {
  expect(decodeCatalogGroupSlug('piranha-s-berry-30ynlx2rwrkhs')).toEqual({ brand: "Piranha's", flavor: 'berry' });
  const response = proxy(new NextRequest('https://canrush.ru/catalog/piranha-s-berry-30ynlx2rwrkhs?tab=reviews'));
  expect([response.status, response.headers.get('location')]).toEqual([301, 'https://canrush.ru/catalog/piranha-s-original?tab=reviews']);
});

it('points the member-added 100 Kwt citrus and X-Turbo peach-sakura cards at the parser cards', () => {
  for (const [slug, canonical] of [
    ['100-kwt-citrus-4h7y3w3fk3ic', '100-kwt-grapefruit-orange'],
    ['x-turbo-peach-sakura-1uyuwzskrpch7', 'x-turbo-peach-3czfw0esqzvi5'],
  ] as const) {
    const response = proxy(new NextRequest(`https://canrush.ru/catalog/${slug}`));
    expect([slug, response.status, response.headers.get('location')]).toEqual([slug, 301, `https://canrush.ru/catalog/${canonical}`]);
  }
});
