import { expect, it } from 'vitest';
import { canonicalProductFlavor, type CatalogGroup } from '@canrush/shared';
import { mergeCatalogAliases, restoreCatalogCovers } from '../src/lib/catalog-files';

it('merges Burn aliases while retaining offers and an archived cover', () => {
  const groups: CatalogGroup[] = ['blend:mango+peach', 'peach:sugarfree', 'blend:mango+peach:sugarfree'].map((flavor, i) => ({
    brand: 'Burn', flavor, minPrice: 100 + i,
    coverImageUrl: i === 0 ? '/images/burn.jpg' : undefined,
    variants: [{ source: 'edadeal', price: 100 + i, url: 'https://example.com/' + i, fetchedAt: '2026-10-05' }],
  }));
  const merged = mergeCatalogAliases(groups);
  expect(merged).toHaveLength(1);
  expect(merged[0]).toMatchObject({ flavor: 'blend:mango+peach:sugarfree', minPrice: 100, coverImageUrl: '/images/burn.jpg' });
  expect(merged[0]?.variants).toHaveLength(3);
  expect(mergeCatalogAliases([...groups, ...groups])[0]?.variants).toHaveLength(3);
});

it('does not conflate other brands or ordinary peach with sugarfree', () => {
  expect(canonicalProductFlavor('Monster', 'blend:mango+peach')).toBe('blend:mango+peach');
  expect(canonicalProductFlavor('Burn', 'peach')).toBe('peach');
});

it('consolidates Vulkan edition descriptions while keeping original and zero separate', () => {
  const flavors = ['tropical', 'blend:mango+passion_fruit', 'blend:mango+passion_fruit+tropical', 'citrus', 'blend:citrus+pineapple', 'berry', 'blend:berry+pomegranate+raspberry', 'original', 'sugarfree'];
  const groups = flavors.map(flavor => ({ brand: 'Vulkan', flavor, variants: [], minPrice: 0 }));
  expect(mergeCatalogAliases(groups).map(group => group.flavor)).toEqual(['tropical', 'citrus', 'berry', 'original', 'sugarfree']);
  expect(canonicalProductFlavor('Other', 'blend:citrus+pineapple')).toBe('blend:citrus+pineapple');
});

it('merges the shortened Volt blueberry identity and preserves both stores', () => {
  const groups = ['blueberry', 'blend:blueberry+pomegranate'].map((flavor, i) => ({ brand: 'Volt Energy', flavor, minPrice: 90 + i, variants: [{ source: 'edadeal' as const, retailer: `Store ${i}`, price: 90 + i, url: `https://example.com/${i}`, fetchedAt: '2026-10-08' }] }));
  expect(mergeCatalogAliases(groups)).toMatchObject([{ flavor: 'blend:blueberry+pomegranate', variants: [{ retailer: 'Store 0' }, { retailer: 'Store 1' }] }]);
  expect(canonicalProductFlavor('Other', 'blueberry')).toBe('blueberry');
  expect(canonicalProductFlavor('Volt Energy', 'blueberry:sugarfree')).toBe('blueberry:sugarfree');
});
it('excludes historical Burn flyer identity including archive entries without affecting real zero flavors', () => {
  const groups = ['burn_juicy', 'burn_juicy:sugarfree', 'blend:mango+peach:sugarfree'].map(flavor => ({ brand: 'Burn', flavor, minPrice: 0, variants: [] }));
  expect(mergeCatalogAliases(groups).map(g => g.flavor)).toEqual(['burn_juicy', 'blend:mango+peach:sugarfree']);
});
it('filters mixed Burn offers from existing snapshots instead of attaching their price to a real flavor', () => {
  const mixed = 'Напиток Бёрн Оригинальный; Сочная Энергия; Без сахара Персик/Манго';
  const variants = [mixed, 'Burn Сочная энергия 449мл'].map((text, i) => ({ source: 'edadeal' as const, price: 100 + i, url: 'https://edadeal.ru/moskva/search?text=' + encodeURIComponent(text), fetchedAt: '2026-10-08' }));
  const [group] = mergeCatalogAliases([{ brand: 'Burn', flavor: 'burn_juicy', variants, minPrice: 100 }]);
  expect(group?.variants).toHaveLength(1);
  expect(group?.minPrice).toBe(101);
});

it('deduplicates inherently sugar-free Monster editions, preserving distinct regular and zero products', () => {
  for (const edition of ['monster_full_throttle', 'monster_ultra_white', 'monster_ultra_paradise', 'monster_absolute_zero']) {
    const groups = [edition, `${edition}:sugarfree`].map(flavor => ({ brand: 'Monster', flavor, variants: [], minPrice: 0 }));
    expect(mergeCatalogAliases(groups).map(group => group.flavor)).toEqual([edition]);
  }
  for (const edition of ['monster_vr46', 'monster_the_doctor', 'monster_mango_loco', 'original']) {
    expect(canonicalProductFlavor('Monster', `${edition}:sugarfree`)).toBe(`${edition}:sugarfree`);
  }
  expect(canonicalProductFlavor('Other', 'monster_full_throttle:sugarfree')).toBe('monster_full_throttle:sugarfree');
  // VR46 without "zero" in the title is the blue Zero Sugar can; The Doctor (also VR46-branded) stays apart.
  expect(canonicalProductFlavor('Monster', 'monster_vr46')).toBe('monster_vr46:sugarfree');
  expect(canonicalProductFlavor('Monster', 'monster_the_doctor')).toBe('monster_the_doctor');
});

it('merges reviewed Monster retailer identities without merging other editions', () => {
  expect(canonicalProductFlavor('Monster', 'mango')).toBe('monster_mango_loco');
  expect(canonicalProductFlavor('Monster', 'unresolved:263797c983e786005750a4f6')).toBe('monster_bad_apple');
  expect(canonicalProductFlavor('Monster', 'unresolved:5728c1f5c98f51d6e2c5ccd2')).toBe('monster_ultra_rosa');
  expect(canonicalProductFlavor('Monster', 'unresolved:a5c012183b7ff4462e51f4fc')).toBe('monster_ultra_watermelon');
  expect(canonicalProductFlavor('Monster', 'monster_ultra_fiesta')).toBe('monster_ultra_fiesta');
  expect(canonicalProductFlavor('Other', 'mango')).toBe('mango');
});

it('uses archived local photos without restoring stale offers or replacing existing local covers', () => {
  const live: CatalogGroup = { brand: 'Volt Energy', flavor: 'blend:grapefruit+strawberry', coverImageUrl: 'https://example.com/expired', variants: [], minPrice: 120 };
  const archive = { ...live, coverImageUrl: '/images/products/saved.jpg', minPrice: 0 };
  expect(restoreCatalogCovers([live], [archive])[0]).toEqual({ ...live, coverImageUrl: archive.coverImageUrl });
  expect(restoreCatalogCovers([{ ...live, coverImageUrl: '/images/products/current.jpg' }], [archive])[0]?.coverImageUrl).toBe('/images/products/current.jpg');
});

it('merges verified strawberry Ultra aliases', () => { expect(canonicalProductFlavor('Monster', 'strawberry:sugarfree')).toBe('monster_ultra_strawberry'); });

it('merges historical Volt brand and mixture aliases, keeping the lime + mango edition apart', () => {
  const make = (brand: string, flavor: string): CatalogGroup => ({ brand, flavor, variants: [], minPrice: 0 });
  const result = mergeCatalogAliases([make('Volt', 'mint'), make('Volt Energy', 'pomelo'), make('Volt Energy', 'blend:mint+pomelo')]);
  expect(result.map(g => [g.brand, g.flavor])).toEqual([['Volt Energy', 'blend:mint+pomelo']]);
  // The archived plain mango card carries the coconut + mango cover (reported as a duplicate).
  expect(canonicalProductFlavor('Volt Energy', 'mango')).toBe('blend:coconut+mango');
  expect(canonicalProductFlavor('Volt Energy', 'blend:lime+mango')).toBe('blend:lime+mango');
  expect(canonicalProductFlavor('Volt Energy', 'original')).toBe('original');
  expect(canonicalProductFlavor('Volt', 'original')).toBe('berry_dragee');
});

it('merges legacy Vulkan single-fruit identities into the matching mixtures', () => {
  expect(canonicalProductFlavor('Vulkan', 'mango')).toBe('tropical');
  expect(canonicalProductFlavor('Vulkan', 'passion_fruit')).toBe('tropical');
  expect(canonicalProductFlavor('Vulkan', 'raspberry')).toBe('berry');
  expect(canonicalProductFlavor('Vulkan', 'citrus')).toBe('citrus');
});

it('keeps Raw Energy separate and resolves reviewed Jaguar mixtures', () => {
  expect(canonicalProductFlavor('100 Kwt', 'unresolved:cd3221b1786a268cf5c1223d')).toBe('kwt_raw');
  expect(canonicalProductFlavor('100 Kwt', 'orange')).toBe('blend:grapefruit+orange');
  expect(canonicalProductFlavor('Jaguar', 'kiwi')).toBe('blend:cactus+kiwi');
  expect(canonicalProductFlavor('Jaguar', 'jaguar_live')).toBe('jaguar_live');
  expect(canonicalProductFlavor('Jaguar', 'jaguar_cult')).toBe('jaguar_cult');
});

it('merges Gorilla fruit aliases without merging distinct berry editions', () => {
  expect(canonicalProductFlavor('Gorilla', 'berry')).toBe('gorilla_berry_blast');
  expect(canonicalProductFlavor('Gorilla', 'blueberry')).toBe('gorilla_berry_bloom');
  expect(canonicalProductFlavor('Gorilla', 'coconut')).toBe('blend:coconut+mango');
});

it('merges Volt orange into orange-passion fruit without losing store offers', () => {
  const groups = ['orange', 'blend:orange+passion_fruit'].map((flavor, i) => ({
    brand: 'Volt Energy', flavor, minPrice: 90 + i,
    variants: [{ source: 'edadeal' as const, retailer: `Store ${i}`, price: 90 + i, url: `https://example.com/${i}`, fetchedAt: '2026-10-13' }],
  }));
  expect(mergeCatalogAliases(groups)).toMatchObject([{ flavor: 'blend:orange+passion_fruit', variants: [{ retailer: 'Store 0' }, { retailer: 'Store 1' }] }]);
  expect(canonicalProductFlavor('Other', 'orange')).toBe('orange');
});

it('merges the archived Go Champ grapefruit card into the watermelon + grapefruit can', () => {
  const offer = { source: 'edadeal' as const, price: 89, url: 'https://example.com/go', fetchedAt: '2026-10-05' };
  const merged = mergeCatalogAliases([
    { brand: 'Go Champ', flavor: 'grapefruit', minPrice: 0, variants: [] },
    { brand: 'Go Champ', flavor: 'blend:grapefruit+watermelon', minPrice: 89, variants: [offer] },
  ]);
  expect(merged.map(group => [group.flavor, group.variants.length])).toEqual([['blend:grapefruit+watermelon', 1]]);
});
