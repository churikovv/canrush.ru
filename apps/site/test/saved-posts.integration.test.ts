import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';

const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Only test database allowed');
const pool = new Pool({ connectionString: url, max: 3 });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const { getWallInteractions, setWallSaved } = await import('../src/lib/wall-discussions');
const { getFeed } = await import('../src/lib/profile-community');

const run = randomUUID().replaceAll('-', '').slice(0, 10);
const [reader, author] = [randomUUID(), randomUUID()];
let post = '';
let other = '';

beforeAll(async () => {
  for (const [index, id] of [reader, author].entries()) {
    await pool.query('insert into "user" (id,name,email,username,"emailVerified","createdAt","updatedAt") values ($1,$2,$3,$4,true,now(),now())', [id, `Читатель ${index}`, `${id}@example.com`, `sv${index}${run}`]);
  }
  const insert = (text: string) => pool.query<{ id: string }>('insert into "profileComment" ("profileId","userId",text) values ($1,$1,$2) returning id', [author, text]).then(result => result.rows[0]!.id);
  post = await insert(`сохранить ${run}`);
  other = await insert(`не сохранять ${run}`);
});
afterAll(async () => {
  await pool.query('delete from "user" where id = any($1::text[])', [[reader, author]]);
  await pool.end();
});

it('bookmarks a record for one member only and lists it under «Сохранённые»', async () => {
  await setWallSaved(reader, post, true);
  await setWallSaved(reader, post, true);
  expect((await getWallInteractions([post, other], reader)).get(post)?.saved).toBe(true);
  expect((await getWallInteractions([post, other], reader)).get(other)?.saved).toBe(false);
  expect((await getWallInteractions([post], author)).get(post)?.saved).toBe(false);
  const saved = await getFeed(reader, 'saved', 1);
  expect(saved.items.every(item => item.kind === 'post')).toBe(true);
  expect(saved.posts.map(item => item.id)).toEqual([post]);
  expect((await getFeed(author, 'saved', 1)).posts).toHaveLength(0);
});

it('removes the bookmark, and deleting the record removes it too', async () => {
  await setWallSaved(reader, post, false);
  expect((await getFeed(reader, 'saved', 1)).posts).toHaveLength(0);
  await setWallSaved(reader, other, true);
  await pool.query('delete from "profileComment" where id = $1', [other]);
  expect((await pool.query('select 1 from "savedPost" where "userId" = $1', [reader])).rowCount).toBe(0);
});
