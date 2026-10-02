import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product, SourceQueryConfig } from '@canrush/shared';
const fixture = vi.hoisted(() => ({ files: new Map<string, string>(), directories: new Set<string>(), fetch: vi.fn() }));
vi.mock('node:fs/promises', () => ({
  readFile: async (file: string) => { const value = fixture.files.get(file); if (value === undefined) throw Object.assign(new Error('Missing'), { code: 'ENOENT' }); return value; },
  mkdir: async (file: string, options?: { recursive?: boolean }) => { if (!options?.recursive && fixture.directories.has(file)) throw Object.assign(new Error('Locked'), { code: 'EEXIST' }); fixture.directories.add(file); },
  writeFile: async (file: string, data: string) => { fixture.files.set(file, data); },
  rm: async (file: string) => { fixture.directories.delete(file); for (const key of fixture.files.keys()) if (key.startsWith(file)) fixture.files.delete(key); },
}));
vi.mock('../src/atomic-file.js', () => ({ writeAtomic: async (file: string, data: string) => { fixture.files.set(file, data); } }));
vi.mock('../src/config.js', () => ({ loadProductsConfig: () => ({ keywords: ['энергетик'], brands: ['Burn'], flavors: ['original'], sources: { edadeal: { query: 'энергетик' } } }) }));
vi.mock('../src/adapters/edadeal.js', () => ({ edadealAdapter: { fetchPrices: fixture.fetch } }));
vi.mock('../src/images.js', () => ({ downloadProductImages: async () => new Map(), applyLocalImages: (data: unknown) => data }));
vi.mock('../src/retailer-icons.js', () => ({ downloadRetailerIcons: async () => ({}) }));
vi.mock('../src/http.js', () => ({ delay: async () => {} }));
const { runRegionalParser } = await import('../src/regions.js');
const { DATA_DIR } = await import('../src/storage.js');
function product(region: string): Product { return { source: 'edadeal', sourceId: 'same-id', name: 'Burn', brand: 'Burn', flavor: 'original', price: Number(region), currency: 'RUB', fetchedAt: new Date().toISOString(), url: `https://example.com/${region}` }; }
function snapshot(city: string) { return [...fixture.files].find(([file]) => file.endsWith(`/site/data/regions/${city}.json`))?.[1]; }
beforeEach(() => { fixture.files.clear(); fixture.directories.clear(); fixture.fetch.mockReset(); fixture.fetch.mockImplementation(async (config: SourceQueryConfig) => ({ products: [product(config.regionId!)], strategyUsed: 'http_api' })); });
describe('regional parser persistence', () => {
  it('separates identical source IDs in different cities and skips a fresh repeat', async () => {
    await runRegionalParser({ cities: ['moscow', 'kazan'] });
    expect(JSON.parse(snapshot('moscow')!).groups[0].minPrice).toBe(213);
    expect(JSON.parse(snapshot('kazan')!).groups[0].minPrice).toBe(43);
    await runRegionalParser({ cities: ['moscow', 'kazan'] });
    expect(fixture.fetch).toHaveBeenCalledTimes(2);
  });
  it('falls back only within the failed city and backs off before retrying', async () => {
    await runRegionalParser({ cities: ['moscow', 'kazan'] });
    const other = snapshot('kazan');
    fixture.fetch.mockRejectedValue(new Error('Source unavailable'));
    await runRegionalParser({ cities: ['moscow'], force: true });
    const stale = JSON.parse(snapshot('moscow')!);
    expect(stale.status).toBe('stale'); expect(stale.groups[0].variants[0]).toMatchObject({ price: 213, stale: true });
    expect(snapshot('kazan')).toBe(other);
    await runRegionalParser({ cities: ['moscow'] }); expect(fixture.fetch).toHaveBeenCalledTimes(3);
  });
  it('publishes an honest empty state when a new city has no previous data', async () => {
    fixture.fetch.mockRejectedValue(new Error('Source unavailable'));
    await runRegionalParser({ cities: ['kazan'] });
    expect(JSON.parse(snapshot('kazan')!)).toMatchObject({ cityId: 'kazan', status: 'unavailable', groups: [], generatedAt: null });
  });
  it('rejects overlapping regional runs without touching an active lock', async () => {
    const lock = `${DATA_DIR}/.regions-lock`;
    fixture.directories.add(lock); fixture.files.set(`${lock}/pid`, String(process.pid));
    await expect(runRegionalParser({ cities: ['kazan'] })).rejects.toThrow('уже работает');
    expect(fixture.fetch).not.toHaveBeenCalled(); expect(fixture.directories.has(lock)).toBe(true);
  });
});
