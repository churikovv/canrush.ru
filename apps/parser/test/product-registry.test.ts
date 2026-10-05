import { expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { archiveProducts, mergeProductRegistry } from '../src/product-registry.js';
it('retains removed identities and local images without stale offers or mixing flavors', () => {
 const previous = [{ brand: 'Burn', flavor: 'original', coverImageUrl: '/images/products/old.jpg', minPrice: 99, variants: [] }];
 const incoming = [{ brand: 'Burn', flavor: 'apple', coverImageUrl: '/images/products/apple.jpg', minPrice: 100, variants: [] }, { ...previous[0]!, coverImageUrl: undefined }];
 const result = mergeProductRegistry(previous, incoming);
 expect(result).toHaveLength(2);
 expect(result[0]).toMatchObject({ flavor: 'original', coverImageUrl: '/images/products/old.jpg', minPrice: 0, variants: [] });
 expect(mergeProductRegistry(result, [])).toEqual(result);
});
it('serializes concurrent writers without losing identities', async () => {
 const directory = await mkdtemp(path.join(tmpdir(), 'registry-test-'));
 try {
  const file = path.join(directory, 'registry.json');
  await Promise.all(['apple', 'original'].map(flavor => archiveProducts([{ brand: 'Burn', flavor, variants: [], minPrice: 99 }], file)));
  expect(JSON.parse(await readFile(file, 'utf8')).groups).toHaveLength(2);
 } finally { await rm(directory, { recursive: true, force: true }); }
});
