import { describe, expect, it } from 'vitest';
import type { Product } from '@canrush/shared';
import {
  collectRetailers,
  isTrustedTileUrl,
  needsRetailerIcon,
  normalizeRetailerIconManifest,
  resolveRetailerDomain,
  retailerSlug,
} from '../src/retailer-icons.js';

const TILE = 'https://leonardo.edadeal.io/dyn/re/retailers/images/icons/sq/winelab.png';

function product(retailer: string | undefined, retailerIconUrl?: string): Product {
  return {
    source: 'edadeal',
    sourceId: `${retailer}-${retailerIconUrl ?? 'none'}`,
    name: 'Burn 449 мл',
    price: 99,
    currency: 'RUB',
    url: 'https://edadeal.ru/moskva/search?text=burn',
    fetchedAt: '2026-10-02T06:00:00Z',
    retailer,
    retailerIconUrl,
  };
}

describe('collectRetailers', () => {
  it('берёт логотип Едадила для каждой сети, даже если он есть не у всех офферов', () => {
    const retailers = collectRetailers([product('Винлаб'), product('Винлаб', TILE), product('Потапыч'), product(undefined, TILE)]);
    expect([...retailers]).toEqual([
      ['Винлаб', TILE],
      ['Потапыч', undefined],
    ]);
  });

  it('не доверяет логотипам с чужих хостов и не по https', () => {
    expect(isTrustedTileUrl(TILE)).toBe(true);
    expect(isTrustedTileUrl('http://leonardo.edadeal.io/a.png')).toBe(false);
    expect(isTrustedTileUrl('https://evil.example/leonardo.edadeal.io.png')).toBe(false);
    expect(isTrustedTileUrl('not a url')).toBe(false);
    expect(collectRetailers([product('Винлаб', 'https://evil.example/a.png')]).get('Винлаб')).toBeUndefined();
  });
});

describe('retailer icon manifest', () => {
  it('читает старый формат как favicon и отбрасывает мусор', () => {
    expect(
      normalizeRetailerIconManifest({
        Metro: '/brand/retailers/metro.png',
        Винлаб: { src: '/images/retailers/винлаб-1a2b3c4d.jpg', tile: true },
        Broken: 42,
      }),
    ).toEqual({
      Metro: { src: '/brand/retailers/metro.png', tile: false },
      Винлаб: { src: '/images/retailers/винлаб-1a2b3c4d.jpg', tile: true },
    });
    expect(normalizeRetailerIconManifest(null)).toEqual({});
    expect(normalizeRetailerIconManifest(['a'])).toEqual({});
  });

  it('скачивает новые и пропавшие иконки и заменяет favicon логотипом', () => {
    const favicon = { src: '/brand/retailers/metro.png', tile: false };
    const tile = { src: '/images/retailers/metro-1a2b3c4d.jpg', tile: true };
    expect(needsRetailerIcon(undefined, undefined, false)).toBe(true);
    expect(needsRetailerIcon(tile, TILE, false)).toBe(true);
    expect(needsRetailerIcon(favicon, TILE, true)).toBe(true);
    expect(needsRetailerIcon(favicon, undefined, true)).toBe(false);
    expect(needsRetailerIcon(tile, TILE, true)).toBe(false);
  });
});

describe('resolveRetailerDomain', () => {
  it('знает домены известных сетей', () => {
    expect(resolveRetailerDomain('Пятёрочка')).toBe('pyaterochka.ru');
    expect(resolveRetailerDomain('Магнит')).toBe('magnit.ru');
    expect(resolveRetailerDomain('Лента')).toBe('lenta.com');
    expect(resolveRetailerDomain('Перекрёсток')).toBe('perekrestok.ru');
    expect(resolveRetailerDomain('Дикси')).toBe('dixy.ru');
    expect(resolveRetailerDomain('Бристоль')).toBe('bristol.ru');
    expect(resolveRetailerDomain('Metro')).toBe('metro-cc.ru');
    expect(resolveRetailerDomain('Ашан')).toBe('auchan.ru');
  });

  it('игнорирует регистр и заменяет ё→е', () => {
    expect(resolveRetailerDomain('ПЯТЁРОЧКА')).toBe('pyaterochka.ru');
    expect(resolveRetailerDomain('МАГНИТ')).toBe('magnit.ru');
  });

  it('находит домен по частичному совпадению', () => {
    expect(resolveRetailerDomain('Магнит у дома')).toBe('magnit.ru');
    expect(resolveRetailerDomain('Магнит Косметик')).toBe('magnit.ru');
    expect(resolveRetailerDomain("O'KEY")).toBe('okey.ru');
    expect(resolveRetailerDomain('Окей')).toBe('okey.ru');
  });

  it('возвращает undefined для неизвестных сетей', () => {
    expect(resolveRetailerDomain('Неизвестный магазин')).toBeUndefined();
    expect(resolveRetailerDomain('')).toBeUndefined();
  });
});

describe('retailerSlug', () => {
  it('превращает имя сети в slug', () => {
    expect(retailerSlug('Бристоль')).toBe('бристоль');
    expect(retailerSlug('Metro')).toBe('metro');
    expect(retailerSlug('Ашан')).toBe('ашан');
  });

  it('заменяет пробелы и спецсимволы на дефис', () => {
    expect(retailerSlug("O'KEY")).toBe('o-key');
    expect(retailerSlug('Магнит у дома')).toBe('магнит-у-дома');
  });

  it('заменяет ё на е', () => {
    expect(retailerSlug('Пятёрочка')).toBe('пятерочка');
    expect(retailerSlug('Перекрёсток')).toBe('перекресток');
  });

  it('возвращает unknown для пустой строки', () => {
    expect(retailerSlug('')).toBe('unknown');
    expect(retailerSlug('!!!')).toBe('unknown');
  });
});
