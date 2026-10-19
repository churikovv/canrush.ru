import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Only test database allowed');
const pool = new Pool({ connectionString: url, max: 2 });
const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
vi.mock('../src/lib/admin', () => ({ requireSiteAdmin: mocks.requireAdmin }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(url); } }));
const { transferStoreAction } = await import('../src/app/admin/actions');
const run = randomUUID().replaceAll('-', '').slice(0, 10);
const [owner, target, blocked] = [randomUUID(), randomUUID(), randomUUID()];
const adminEmail = `store-transfer-${run}@example.com`;
let store = '';
const form = (values: Record<string, string>) => { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data; };
beforeAll(async () => {
  for (const [id, name] of [[owner, 'owner'], [target, 'target'], [blocked, 'blocked']] as const)
    await pool.query(`insert into "user" (id,name,email,"emailVerified",username,"createdAt","updatedAt") values ($1,$2,$3,true,$4,now(),now())`, [id, name, `${name}-${run}@example.com`, `${name}_${run}`]);
  await pool.query('insert into "userBlock" ("userId") values ($1)', [blocked]);
  store = (await pool.query<{ id: string }>(`insert into "marketStore" ("ownerId",name,city,address,status) values ($1,$2,'moscow','Тверская, 1','published') returning id`, [owner, `Transfer ${run}`])).rows[0]!.id;
});
beforeEach(() => { mocks.requireAdmin.mockResolvedValue({ userId: owner, email: adminEmail }); });
afterAll(async () => {
  await pool.query('delete from "adminAuditLog" where "adminEmail"=$1', [adminEmail]);
  await pool.query('delete from "user" where id=any($1::text[])', [[owner, target, blocked]]);
  await pool.end();
});
it('requires an administrator before reading the store', async () => {
  mocks.requireAdmin.mockRejectedValue(new Error('not-admin'));
  await expect(transferStoreAction({}, form({ store, owner: `@target_${run}` }))).rejects.toThrow('not-admin');
});
it('moves the store to a member found by email from a pasted link and audits it', async () => {
  const result = await transferStoreAction({}, form({ store: `https://canrush.ru/market/stores/${store}`, owner: `TARGET-${run}@example.com` }));
  expect(result.success).toContain(`@target_${run}`); expect(result.success).toContain(`@owner_${run}`);
  expect((await pool.query('select "ownerId", status from "marketStore" where id=$1', [store])).rows[0]).toEqual({ ownerId: target, status: 'published' });
  expect((await pool.query('select action,"targetType","targetId" from "adminAuditLog" where "adminEmail"=$1', [adminEmail])).rows).toEqual([{ action: 'transfer', targetType: 'store', targetId: `${store}:${target}` }]);
});
it('refuses the current owner, blocked members, unknown members and stores', async () => {
  expect((await transferStoreAction({}, form({ store, owner: `@target_${run}` }))).error).toContain('уже принадлежит');
  expect((await transferStoreAction({}, form({ store, owner: `blocked_${run}` }))).error).toContain('заблокирован');
  expect((await transferStoreAction({}, form({ store, owner: `@missing_${run}` }))).error).toContain('не найден');
  expect((await transferStoreAction({}, form({ store: randomUUID(), owner: `@owner_${run}` }))).error).toBe('Магазин не найден.');
  expect((await transferStoreAction({}, form({ store: 'nothing', owner: `@owner_${run}` }))).error).toContain('ссылку на магазин');
  expect((await pool.query('select "ownerId" from "marketStore" where id=$1', [store])).rows[0].ownerId).toBe(target);
});
