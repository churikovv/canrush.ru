import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';

const databaseUrl = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(databaseUrl).pathname !== '/canrush_site_test') throw new Error('Only canrush_site_test is allowed');
const pool = new Pool({ connectionString: databaseUrl, max: 3, allowExitOnIdle: true });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
vi.mock('../src/lib/store-catalog', () => ({ storeDrinkOptions: async () => [
  { brand: 'Burn', flavor: 'original', label: 'Burn · Оригинальный' }, { brand: 'Burn', flavor: 'guava', label: 'Burn · Гуава' },
] }));
const { getBrandCollections } = await import('../src/lib/brand-collection');
const calendar = await import('../src/lib/drink-calendar');

const owner = randomUUID();
const day = '2032-04-01';
const xp = async () => (await pool.query<{ key: string; points: number }>(`select "sourceKey" as key, points from "profileExperience"
  where "userId" = $1 and reason = 'collection' order by points`, [owner])).rows;

beforeAll(async () => {
  await pool.query(`insert into "user" (id, name, email, "emailVerified", username, "createdAt", "updatedAt") values ($1, 'Collection test', $2, true, $3, now(), now())`, [owner, `${owner}@example.com`, `test_${owner.replaceAll('-', '').slice(0, 16)}`]);
});
afterAll(async () => { await pool.query('delete from "user" where id = $1', [owner]); await pool.end(); });

it('pays collection milestones once, whether settled by a can or by viewing', async () => {
  expect((await getBrandCollections(owner)).xp).toBe(0);
  const first = await calendar.addDrink(owner, { day, name: 'x', price: null, store: null, brand: 'Burn', flavor: 'original' }, day);
  expect(await xp()).toEqual([{ key: 'Burn:50', points: 25 }]);
  expect(first.xp).toBeGreaterThanOrEqual(25);
  await calendar.addDrink(owner, { day, name: 'x', price: null, store: null, brand: 'Burn', flavor: 'original' }, day);
  expect(await xp()).toHaveLength(1);
  await calendar.addDrink(owner, { day, name: 'x', price: null, store: null, brand: 'Burn', flavor: 'guava' }, day);
  const summary = await getBrandCollections(owner);
  expect(summary).toMatchObject({ tried: 2, completed: 1, xp: 0 });
  expect(await xp()).toEqual([{ key: 'Burn:50', points: 25 }, { key: 'Burn:100', points: 75 }]);
});
