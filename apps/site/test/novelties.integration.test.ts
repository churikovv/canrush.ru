import { afterAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 2 });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const { getNovelties, syncCatalogFirstSeen } = await import('../src/lib/novelties');

const brand = `Novelty ${Date.now()}`;
afterAll(async () => { await pool.query('delete from "catalogFirstSeen" where brand = $1', [brand]); await pool.end(); });

it('records identities once and lists the ones that are new', async () => {
  await syncCatalogFirstSeen([{ brand, flavor: 'mango', variants: [], minPrice: 0 }]);
  // The table now has rows, so a drink seen later is a novelty, not the baseline.
  await syncCatalogFirstSeen([{ brand, flavor: 'mango', variants: [], minPrice: 0 }, { brand, flavor: 'peach', variants: [], minPrice: 0 }]);
  const { rows } = await pool.query<{ flavor: string; baseline: boolean }>('select flavor, baseline from "catalogFirstSeen" where brand = $1 order by flavor', [brand]);
  expect(rows.map(row => row.flavor)).toEqual(['mango', 'peach']);
  expect(rows[1]!.baseline).toBe(false);
  const novelties = (await getNovelties(45, false)).filter(item => item.brand === brand);
  expect(novelties.map(item => item.flavor)).toContain('peach');
  expect(novelties.every(item => !item.added)).toBe(true);
  // Unknown flavours are not catalog drinks and are not recorded.
  await syncCatalogFirstSeen([{ brand, flavor: 'unresolved:abc', variants: [], minPrice: 0 }]);
  expect((await pool.query('select 1 from "catalogFirstSeen" where brand = $1 and flavor like $2', [brand, 'unresolved%'])).rowCount).toBe(0);
});
