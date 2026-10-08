import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 2 });
const owner = randomUUID(), other = randomUUID();
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: () => { throw new Error('redirect'); } }));
vi.mock('../src/lib/auth', () => ({ auth: { api: { getSession: async () => ({ user: { id: owner } }) } } }));
vi.mock('../src/lib/profile-community', () => ({ getProfileCommunity: vi.fn() }));
vi.mock('../src/lib/catalog', () => ({ getCatalogGroup: vi.fn() }));
vi.mock('../src/lib/notifications', () => ({ syncFavoritePrices: vi.fn() }));
const { removeFavoriteAction } = await import('../src/app/catalog/actions');
beforeAll(async () => {
  for (const id of [owner, other]) {
    await pool.query('insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt") values($1,$1,$2,true,now(),now())', [id, `${id}@example.test`]);
    await pool.query('insert into "favorite"("userId",brand,flavor) values($1,$2,$3)', [id, 'Burn', 'original']);
  }
});
afterAll(async () => { await pool.query('delete from "user" where id = any($1)', [[owner, other]]); await pool.end(); });
it('removes only the signed-in owner’s favorite and repeated removal does not restore it', async () => {
  const form = new FormData(); form.set('brand', 'Burn'); form.set('flavor', 'original'); form.set('userId', other);
  expect(await removeFavoriteAction('', form)).toBe('');
  expect(await removeFavoriteAction('', form)).toBe('');
  const result = await pool.query('select "userId" from "favorite" where "userId" = any($1)', [[owner, other]]);
  expect(result.rows).toEqual([{ userId: other }]);
});
