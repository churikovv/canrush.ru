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

it('keeps archived and unresolved cards for saved lists but excludes them from the picker', async () => {
  const { readTierPickerGroups } = await import('../src/lib/catalog-files');
  put('regions/moscow.json', { cityId: 'moscow', groups: [group(99), group(100, 'unknown'), group(101, 'unresolved:old')] });
  put('regions/kazan.json', { cityId: 'kazan', groups: [group(129), group(130, 'kiwi')] });
  put('product-registry.json', { groups: [group(55, 'apple')] });
  const picker = await readTierPickerGroups();
  expect(picker.map(item => item.flavor)).toEqual(['original', 'kiwi']);
  expect((await readAllCatalogGroups()).map(item => item.flavor)).toContain('apple');
  expect((await readAllCatalogGroups()).map(item => item.flavor)).toContain('unresolved:old');
});

it('merges confirmed Burn aliases in the picker and does not guess from identical photos', async () => {
  const { readTierPickerGroups } = await import('../src/lib/catalog-files');
  put('regions/moscow.json', { cityId: 'moscow', groups: [group(99, 'peach:sugarfree'), group(100, 'blend:mango+peach')] });
  put('regions/kazan.json', { cityId: 'kazan', groups: [group(129, 'blend:mango+peach:sugarfree'), group(130, 'peach')] });
  expect((await readTierPickerGroups()).map(item => item.flavor)).toEqual(['blend:mango+peach:sugarfree', 'peach']);
});

it('excludes unrecognized brands even with recognized flavors from the tier picker', async () => {
  const { readTierPickerGroups } = await import('../src/lib/catalog-files');
  const groups = ['Unknown', ' unknown ', '', 'Burn'].map(brand => ({ ...group(100, 'cherry'), brand }));
  put('regions/moscow.json', { cityId: 'moscow', groups });
  expect((await readTierPickerGroups()).map(item => item.brand)).toEqual(['Burn']);
  // Existing placements can still resolve through the full catalog.
  expect((await readAllCatalogGroups()).some(item => item.brand === 'Unknown')).toBe(true);
});

it('excludes previously cached Pepsi from the catalog and picker without deleting history', async () => {
  const { readTierPickerGroups } = await import('../src/lib/catalog-files');
  const soda = { ...group(100, 'mango'), brand: 'Pepsi' };
  put('regions/moscow.json', { cityId: 'moscow', groups: [soda, group(100)] });
  expect(activeOffers([soda, group(100)]).map(item => item.brand)).toEqual(['Burn']);
  expect((await readTierPickerGroups()).map(item => item.brand)).toEqual(['Burn']);
  expect((await readAllCatalogGroups()).some(item => item.brand === 'Pepsi')).toBe(true);
});
