import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 4 });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const { getFeed, setFollowing } = await import('../src/lib/profile-community');

const [author, follower, blocker] = [randomUUID(), randomUUID(), randomUUID()];
const brand = `Лента ${randomUUID().slice(0, 8)}`;
type Items = Awaited<ReturnType<typeof getFeed>>['items'];
// Only this test's events: tier lists and review days by its author.
const events = (items: Items) => items.flatMap(item => item.kind === 'tierlist' && item.tierList.userId === author ? [`tierlist:${item.tierList.title}`]
  : item.kind === 'reviews' && item.group.key.startsWith(`${author}|`) ? [`reviews:${item.group.reviews.map(review => review.flavor).join(',')}`] : []);

beforeAll(async () => {
  for (const id of [author, follower, blocker]) await pool.query(
    `insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt",username) values($1,'Feed events',$2,true,now(),now(),$3)`, [id, `${id}@example.com`, `fe_${id.slice(0, 12)}`]);
  await pool.query(`insert into "tierList"("userId",slug,title,status,"publishedAt") values($1,$2,'Мой топ','published',now() - interval '1 minute'),($1,$3,'Черновик','draft',null)`,
    [author, `feed-${randomUUID()}`, `feed-${randomUUID()}`]);
  await pool.query(`insert into review("userId",brand,flavor,design,taste,text,"createdAt") values($1,$2,'apple',8,9,'Яблоко',now()),($1,$2,'mango',6,7,'Манго',now() - interval '10 seconds')`, [author, brand]);
  await pool.query(`insert into "memberBlock"("blockerId","blockedId") values($1,$2)`, [blocker, author]);
});
afterAll(async () => {
  await pool.query('delete from review where brand = $1', [brand]);
  await pool.query('delete from "user" where id = any($1::text[])', [[author, follower, blocker]]);
  await pool.end();
});

it('shows published tier lists and a day of reviews as one event, newest first', async () => {
  expect(events((await getFeed(null)).items)).toEqual(['reviews:apple,mango', 'tierlist:Мой топ']);
});

it('keeps events out of «Сохранённые», follows «Подписки» and hides blocked authors', async () => {
  expect(events((await getFeed(follower, 'saved')).items)).toEqual([]);
  expect(events((await getFeed(follower, 'following')).items)).toEqual([]);
  await setFollowing(follower, author, true);
  expect(events((await getFeed(follower, 'following')).items)).toEqual(['reviews:apple,mango', 'tierlist:Мой топ']);
  expect(events((await getFeed(blocker)).items)).toEqual([]);
});
