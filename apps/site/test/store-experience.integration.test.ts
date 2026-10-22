import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 2 });
const owner = randomUUID(), blocked = randomUUID();

const xp = async (userId: string) => (await pool.query<{ count: number; points: number }>(
  `select count(*)::int as count, coalesce(sum(points),0)::int as points from "profileExperience" where "userId"=$1 and reason='store'`, [userId])).rows[0]!;
const addStore = async (userId: string, status = 'pending') => (await pool.query<{ id: string }>(
  `insert into "marketStore"("ownerId",name,city,address,status) values($1,$2,'moscow',$3,$4) returning id`,
  [userId, `Тест ${randomUUID()}`, `ул. Тестовая, ${randomUUID().slice(0, 8)}`, status])).rows[0]!.id;

beforeAll(async () => {
  for (const id of [owner, blocked]) await pool.query(`insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt") values($1,'Store XP test',$2,true,now(),now())`, [id, `${id}@example.com`]);
  await pool.query(`insert into "userBlock"("userId") values($1)`, [blocked]);
});
afterAll(async () => { await pool.query('delete from "user" where id=any($1::text[])', [[owner, blocked]]); await pool.end(); });

it('pays once when a store passes moderation, not again after an edit and re-moderation', async () => {
  const store = await addStore(owner);
  expect(await xp(owner)).toEqual({ count: 0, points: 0 });
  await pool.query(`update "marketStore" set status='published' where id=$1`, [store]);
  expect(await xp(owner)).toEqual({ count: 1, points: 75 });
  await pool.query(`update "marketStore" set status='pending' where id=$1`, [store]);
  await pool.query(`update "marketStore" set status='published' where id=$1`, [store]);
  expect(await xp(owner)).toEqual({ count: 1, points: 75 });
  await pool.query(`update "marketStore" set status='rejected' where id=$1`, [await addStore(owner)]);
  expect(await xp(owner)).toEqual({ count: 1, points: 75 });
});

it('stops at 20 stores and skips blocked authors', async () => {
  for (let index = 0; index < 21; index++) await addStore(owner, 'published');
  expect(await xp(owner)).toEqual({ count: 20, points: 1500 });
  await addStore(blocked, 'published');
  expect(await xp(blocked)).toEqual({ count: 0, points: 0 });
});
