import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Only test database allowed');
const pool = new Pool({ connectionString: url, max: 2 });
const run = randomUUID().replaceAll('-', '').slice(0, 10);
const ids = { author: randomUUID(), wall: randomUUID(), friend: randomUUID(), late: randomUUID() };
const name = (key: string) => `m${key.slice(0, 4)}_${run}`;
const mentions = async (userId: string) => (await pool.query<{ actorId: string; payload: { target: string } }>(
  `select "actorId", payload from notification where "userId" = $1 and kind = 'mention'`, [userId])).rows;
beforeAll(async () => {
  for (const [key, id] of Object.entries(ids)) await pool.query(`insert into "user" (id,name,email,"emailVerified",username,"createdAt","updatedAt") values ($1,$2,$3,true,$2,now(),now())`, [id, name(key), `${name(key)}@example.com`]);
});
afterAll(async () => { await pool.query('delete from "user" where id = any($1::text[])', [Object.values(ids)]); await pool.end(); });

it('notifies mentioned members once, skipping the author and the wall owner who is notified anyway', async () => {
  const text = `@${name('author')} @${name('wall')} @${name('friend').toUpperCase()} mail ${name('late')}@example.com`;
  const post = await pool.query<{ id: string }>(`insert into "profileComment" ("profileId","userId",text) values ($1,$2,$3) returning id`, [ids.wall, ids.author, text]);
  expect(await mentions(ids.friend)).toMatchObject([{ actorId: ids.author, payload: { target: 'wall' } }]);
  expect(await mentions(ids.author)).toEqual([]);
  expect(await mentions(ids.wall)).toEqual([]);
  expect(await mentions(ids.late)).toEqual([]);
  // An edit notifies only the newly mentioned member.
  await pool.query('update "profileComment" set text = $2 where id = $1', [post.rows[0]!.id, `${text} и @${name('late')}`]);
  expect(await mentions(ids.late)).toHaveLength(1);
  expect(await mentions(ids.friend)).toHaveLength(1);
});
