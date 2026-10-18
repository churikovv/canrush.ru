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
it('downloads archived CDN covers once and keeps local covers and failed links', async () => {
 const { localizeRegistryCovers } = await import('../src/product-registry.js');
 const directory = await mkdtemp(path.join(tmpdir(), 'registry-test-'));
 try {
  const file = path.join(directory, 'registry.json');
  await archiveProducts([
   { brand: 'Neft', flavor: 'orange', coverImageUrl: 'https://leonardo.edadeal.io/a', variants: [], minPrice: 0 },
   { brand: 'Neft', flavor: 'original', coverImageUrl: 'https://leonardo.edadeal.io/broken', variants: [], minPrice: 0 },
   { brand: 'Burn', flavor: 'original', coverImageUrl: '/images/products/burn.jpg', variants: [], minPrice: 0 },
  ], file);
  const calls: string[] = [];
  const download = async (url: string) => { calls.push(url); return url.endsWith('/a') ? '/images/products/neft.jpg' : undefined; };
  expect(await localizeRegistryCovers(download, { file })).toEqual({ repaired: 1, failed: 1 });
  expect(calls).toEqual(['https://leonardo.edadeal.io/a', 'https://leonardo.edadeal.io/broken']);
  const covers = Object.fromEntries((JSON.parse(await readFile(file, 'utf8')).groups as { flavor: string; brand: string; coverImageUrl?: string }[]).map(group => [`${group.brand}:${group.flavor}`, group.coverImageUrl]));
  expect(covers).toEqual({ 'Neft:orange': '/images/products/neft.jpg', 'Neft:original': 'https://leonardo.edadeal.io/broken', 'Burn:original': '/images/products/burn.jpg' });
  calls.length = 0;
  expect(await localizeRegistryCovers(download, { file })).toEqual({ repaired: 0, failed: 1 });
  expect(calls).toEqual(['https://leonardo.edadeal.io/broken']);
 } finally { await rm(directory, { recursive: true, force: true }); }
});
