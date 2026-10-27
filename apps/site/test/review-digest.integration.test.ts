import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 2 });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const digests = await import('../src/lib/review-digest');

const brand = `Digest ${randomUUID().slice(0, 8)}`;
const users = [randomUUID(), randomUUID(), randomUUID()];
const fake = { model: 'test-model', calls: 0, chat: async () => { fake.calls++; return '{"summary":"Хвалят манго.","sentiment":"positive","praise":["сочный"],"complaints":["сладко"],"suggestions":["без сахара"]}'; } };
const client = fake as unknown as Parameters<typeof digests.runCatalogDigests>[0];

beforeAll(async () => {
  for (const id of users) await pool.query(`insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt",username) values($1,'Digest',$2,true,now(),now(),$3)`, [id, `${id}@example.com`, `dg_${id.slice(0, 12)}`]);
  for (const [index, id] of users.entries()) await pool.query(`insert into review("userId", brand, flavor, taste, design, text) values ($1, $2, 'mango', $3, 7, 'Отзыв')`, [id, brand, 6 + index]);
  await pool.query(`insert into review("userId", brand, flavor, taste, design, text) values ($1, $2, 'peach', 5, 5, 'Мало отзывов')`, [users[0], brand]);
});
afterAll(async () => {
  await pool.query('delete from "businessReviewDigest" where brand = $1', [brand]);
  await pool.query('delete from "user" where id = any($1::text[])', [users]);
  await pool.end();
});

it('writes summaries for drinks with enough reviews, once until new reviews come', async () => {
  const mine = async () => (await digests.digestCandidates(10_000)).filter(drink => drink.brand === brand).map(drink => drink.flavor);
  expect(await mine()).toEqual(['mango']);
  const written = await digests.writeReviewDigest(brand, 'mango', client, null);
  expect(written.summary).toBe('Хвалят манго.');
  expect(await digests.getDrinkSummary(brand, 'mango')).toMatchObject({ reviewCount: 3, body: { sentiment: 'positive' } });
  expect(await mine()).toEqual([]);
  // A new review makes it a candidate again only after the cooldown.
  await pool.query(`update review set "createdAt" = now() + interval '1 second' where "userId" = $1 and brand = $2 and flavor = 'mango'`, [users[2], brand]);
  expect(await mine()).toEqual([]);
  await pool.query(`update "businessReviewDigest" set "createdAt" = now() - interval '7 hours' where brand = $1`, [brand]);
  expect(await mine()).toEqual(['mango']);
  await expect(digests.writeReviewDigest(brand, 'peach', client, null)).rejects.toThrow('хотя бы 3');
});
