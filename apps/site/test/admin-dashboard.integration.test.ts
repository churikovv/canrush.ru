import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Only test database allowed');
const pool = new Pool({ connectionString: url, max: 2 });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const { getAdminDashboardData } = await import('../src/lib/admin-dashboard-data');
const run = randomUUID();
const ids = Array.from({ length: 27 }, () => randomUUID());
const username = `dash_${run.replaceAll('-', '').slice(0, 12)}`;
beforeAll(async () => {
  for (const [i, id] of ids.entries()) await pool.query(`insert into "user" (id,name,email,"emailVerified",username,"createdAt","updatedAt") values ($1,$2,$3,true,$4,now(),now())`, [id, `Dashboard ${run}`, `${id}@example.com`, `${username}_${i}`]);
  await pool.query(`insert into "profileComment" ("profileId","userId",text) values ($1,$2,$3)`, [ids[0],ids[1],`Wall ${run}`]);
});
afterAll(async () => { await pool.query('delete from "user" where id=any($1::text[])',[ids]); await pool.end(); });
it('paginates and searches participants without loading other sections', async () => {
  const first = await getAdminDashboardData(run, 'users');
  const last = await getAdminDashboardData(run, 'users', 999);
  expect(first.total).toBe(27); expect(first.users).toHaveLength(25);
  expect(last.page).toBe(2); expect(last.users).toHaveLength(2);
  expect(new Set([...first.users,...last.users].map(u => u.id)).size).toBe(27);
  expect(first.metrics).toBeNull(); expect(first.wall).toEqual([]);
});
it('finds wall comments by text and wall owner', async () => {
  const text = await getAdminDashboardData(`Wall ${run}`, 'wall');
  expect(text.total).toBe(1); expect(text.wall[0]?.profileUsername).toBe(`${username}_0`);
  expect((await getAdminDashboardData(`${username}_0`, 'wall')).total).toBe(1);
});
it('uses full database metrics rather than the page size or search results', async () => {
  const data = await getAdminDashboardData('does-not-exist', 'analytics');
  expect(data.metrics?.users).toBeGreaterThanOrEqual(27);
  expect(data.metrics?.newUsers).toBeGreaterThanOrEqual(27);
  expect(data.metrics?.wall).toBeGreaterThanOrEqual(1);
  expect(data.registrations).toHaveLength(14);
  expect(data.registrations.reduce((n,day)=>n+day.count,0)).toBeGreaterThanOrEqual(27);
});
