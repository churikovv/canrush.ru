import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Only test database allowed');
const pool = new Pool({ connectionString: url, max: 3 });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const { createProfileReport } = await import('../src/lib/profile-reports');
const { getAdminDashboardData } = await import('../src/lib/admin-dashboard-data');
const run = randomUUID();
const ids = Array.from({ length: 14 }, () => randomUUID());
beforeAll(async () => {
  for (const id of ids) await pool.query('insert into "user" (id,name,email,"emailVerified","createdAt","updatedAt") values ($1,$2,$3,true,now(),now())',[id,run,id+'@example.com']);
});
afterAll(async () => { await pool.query('delete from "user" where id=any($1::text[])',[ids]); await pool.end(); });
it('validates reason, self-report, comment length and missing target', async () => {
  expect(await createProfileReport(ids[0]!,ids[0]!,'spam','')).toBe('invalid');
  expect(await createProfileReport(ids[0]!,ids[1]!,'other','')).toBe('invalid');
  expect(await createProfileReport(ids[0]!,ids[1]!,'spam','a'.repeat(1001))).toBe('invalid');
  expect(await createProfileReport(ids[0]!,'missing','spam','')).toBe('invalid');
});
it('deduplicates concurrent reports, saves details, and exposes them to admin search', async () => {
  const results = await Promise.all([createProfileReport(ids[0]!,ids[1]!,'scam','Details '+run),createProfileReport(ids[0]!,ids[1]!,'spam','')]);
  expect(results.sort()).toEqual(['duplicate','sent']);
  const data = await getAdminDashboardData(run,'reports');
  expect(data.total).toBe(1);
  expect(data.reports[0]).toMatchObject({ status: 'open', targetName: run });
});
it('limits submissions per reporter and blocks forbidden contributors in the database', async () => {
  for (const target of ids.slice(2,11)) expect(await createProfileReport(ids[0]!,target,'insults','')).toBe('sent');
  expect(await createProfileReport(ids[0]!,ids[11]!,'prohibited','')).toBe('limited');
  await pool.query('insert into "userBlock" ("userId") values ($1)',[ids[12]]);
  await expect(createProfileReport(ids[12]!,ids[1]!,'spam','')).rejects.toThrow();
});
