import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogGroup } from '@canrush/shared';
const fixtures = vi.hoisted(() => ({ files: new Map<string, string>(), generation: 0, read: vi.fn() }));
vi.mock('node:fs/promises', () => ({
  stat: async (filename: string) => { if (!fixtures.files.has(filename)) throw Object.assign(new Error('Missing'), { code: 'ENOENT' }); return { ino: 1, mtimeMs: fixtures.generation, size: fixtures.files.get(filename)!.length }; },
  readFile: async (filename: string) => { fixtures.read(filename); return fixtures.files.get(filename); },
}));
const { readCityCatalog, readAllCatalogGroups, activeOffers } = await import('../src/lib/catalog-files');
const group = (price: number, flavor = 'original'): CatalogGroup => ({ brand: 'Burn', flavor, minPrice: price, variants: [{ source: 'edadeal', url: 'https://edadeal.ru/moskva/search', price, fetchedAt: '2026-10-02T10:00:00Z' }] });
function put(file: string, data: unknown) { fixtures.files.set(`${process.cwd()}/data/${file}`, JSON.stringify(data)); }
beforeEach(() => { fixtures.files.clear(); fixtures.generation++; fixtures.read.mockClear(); });
describe('city-specific assortment', () => {
  it('isolates prices and assortment, reuses parsed files, and notices a parser replacement', async () => {
    put('regions/moscow.json', { cityId: 'moscow', groups: [group(99)] });
    put('regions/kazan.json', { cityId: 'kazan', groups: [group(129, 'kiwi')] });
    const [moscow, kazan] = await Promise.all([readCityCatalog('moscow'), readCityCatalog('kazan')]);
    expect(moscow?.groups?.[0]?.minPrice).toBe(99); expect(kazan?.groups?.[0]?.flavor).toBe('kiwi');
    await readCityCatalog('moscow'); expect(fixtures.read).toHaveBeenCalledTimes(2);
    put('regions/moscow.json', { cityId: 'moscow', groups: [group(115)] }); fixtures.generation++;
    expect((await readCityCatalog('moscow'))?.groups?.[0]?.minPrice).toBe(115);
  });
  it('does not substitute Moscow data for an unavailable city or a mismatched snapshot', async () => {
    put('catalog.json', { groups: [group(99)] });
    put('regions/kazan.json', { cityId: 'moscow', groups: [group(99)] });
    expect(await readCityCatalog('kazan')).toBeNull();
    expect((await readCityCatalog('moscow'))?.groups).toHaveLength(1);
    put('regions/moscow.json', { cityId: 'moscow', groups: [], status: 'unavailable' }); fixtures.generation++;
    expect((await readCityCatalog('moscow'))?.groups).toHaveLength(0);
  });
  it('keeps product identities from all cities for reviews and tierlists', async () => {
    put('regions/moscow.json', { cityId: 'moscow', groups: [group(99)] });
    put('regions/kazan.json', { cityId: 'kazan', groups: [group(129, 'kiwi')] });
    expect((await readAllCatalogGroups()).map(item => item.flavor)).toEqual(['original', 'kiwi']);
  });
  it('removes expired promotions even from a cached or stale snapshot and recomputes minimum', () => {
    const data = group(50); data.variants.push({ ...data.variants[0]!, price: 100 }); data.variants[0]!.promoEndsAt = '2026-10-01T00:00:00Z';
    expect(activeOffers([data], Date.parse('2026-10-02'))[0]?.minPrice).toBe(100);
    data.variants[1]!.promoEndsAt = '2026-10-01T00:00:00Z';
    expect(activeOffers([data], Date.parse('2026-10-02'))).toEqual([]);
  });
});

it('restores archived identities without reviving old prices or replacing current offers', async () => {
  put('product-registry.json', { groups: [{ ...group(55, 'apple'), coverImageUrl: '/images/products/apple.jpg' }, { ...group(50), coverImageUrl: '/images/products/original.jpg' }] });
  put('regions/moscow.json', { cityId: 'moscow', groups: [group(120)] });
  const all = await readAllCatalogGroups();
  expect(all.find(item => item.flavor === 'apple')).toMatchObject({ minPrice: 0, variants: [], coverImageUrl: '/images/products/apple.jpg' });
  expect(all.find(item => item.flavor === 'original')).toMatchObject({ minPrice: 120, coverImageUrl: '/images/products/original.jpg' });
  expect((await readCityCatalog('moscow'))?.groups).toHaveLength(1);
});
