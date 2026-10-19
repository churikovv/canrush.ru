import { randomUUID } from 'node:crypto';
import { afterAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Only test database allowed');
const pool = new Pool({ connectionString: url, max: 3 });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const { BETA_ENGINE_PLACES, getBetaEngine } = await import('../src/lib/beta-engine');
const id = randomUUID();
let number: number | null = null;
afterAll(async () => {
  await pool.query('delete from "user" where id = $1', [id]);
  // Only this test's own number; the rest of the counter is left as it was.
  if (number) await pool.query('delete from "betaEngine" where number = $1 and "userId" is null', [number]);
  await pool.end();
});
it('numbers a new member on sign-up and keeps the number after the account is gone', async () => {
  const before = await getBetaEngine(null);
  await pool.query(`insert into "user" (id,name,email,"emailVerified","createdAt","updatedAt") values ($1,'engine',$2,true,now(),now())`, [id, `engine-${id}@example.com`]);
  const after = await getBetaEngine(id);
  const tagged = (await pool.query(`select 1 from "profileAchievement" where "userId" = $1 and key = 'engine'`, [id])).rowCount;
  if (before.taken >= BETA_ENGINE_PLACES) {
    expect(after).toMatchObject({ taken: before.taken, number: null });
    expect(tagged).toBe(0);
    return;
  }
  number = after.number;
  expect(after).toMatchObject({ taken: before.taken + 1, number: before.taken + 1 });
  expect(tagged).toBe(1);
  expect((await pool.query<{ n: number | null }>('select assign_beta_engine($1) as n', [id])).rows[0]?.n).toBeNull();
  await pool.query('delete from "user" where id = $1', [id]);
  expect((await getBetaEngine(null)).taken).toBe(before.taken + 1);
});
