import { expect, it } from 'vitest';
import { canonicalProductFlavor, type CatalogGroup } from '@canrush/shared';
import { mergeCatalogAliases } from '../src/lib/catalog-files';

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
  for (const edition of ['monster_vr46', 'monster_the_doctor', 'monster_mango_loco', 'strawberry', 'original']) {
    expect(canonicalProductFlavor('Monster', `${edition}:sugarfree`)).toBe(`${edition}:sugarfree`);
  }
  expect(canonicalProductFlavor('Other', 'monster_full_throttle:sugarfree')).toBe('monster_full_throttle:sugarfree');
});
