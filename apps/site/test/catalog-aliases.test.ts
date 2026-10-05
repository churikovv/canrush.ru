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
