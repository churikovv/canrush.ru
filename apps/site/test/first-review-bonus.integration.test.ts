import { randomUUID } from 'node:crypto';
import { afterAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 3 });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const { getShop } = await import('../src/lib/shop');
const { firstReviewBonusAhead } = await import('../src/lib/reviews');
const { FIRST_REVIEW_SPARKS } = await import('../src/lib/shop-items');

const ids: string[] = [];
const brand = `FirstBonus${randomUUID().slice(0, 8)}`;
async function member() {
  const id = randomUUID();
  ids.push(id);
  await pool.query(`insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt",username) values($1,'First',$2,true,now(),now(),$3)`, [id, `${id}@example.com`, `fr_${id.slice(0, 12)}`]);
  return id;
}
const review = (id: string, flavor: string) => pool.query(`insert into review ("userId", brand, flavor, design, taste, text) values ($1, $2, $3, 8, 8, 'Хороший вкус, беру снова')`, [id, brand, flavor]);
const experience = async (id: string) => (await pool.query<{ reason: string; points: number }>(`select reason, points from "profileExperience" where "userId" = $1 and reason in ('review', 'first-review') order by reason, "createdAt"`, [id])).rows;

afterAll(async () => {
  await pool.query('delete from review where brand = $1', [brand]);
  await pool.query('delete from "user" where id = any($1::text[])', [ids]);
  await pool.end();
});

it('pays the first review +25 XP on top of the usual 25 and 25 sparks, once', async () => {
  const id = await member();
  expect(await firstReviewBonusAhead(id)).toBe(true);
  expect((await getShop(id)).sources.firstReview).toBe(0);
  await review(id, 'mango');
  expect(await experience(id)).toEqual([{ reason: 'first-review', points: 25 }, { reason: 'review', points: 25 }]);
  expect(await firstReviewBonusAhead(id)).toBe(false);
  expect((await getShop(id)).sources.firstReview).toBe(FIRST_REVIEW_SPARKS);
  // The second review pays only its own XP; deleting both and writing again pays no second bonus.
  await review(id, 'cherry');
  await pool.query('delete from review where "userId" = $1', [id]);
  await review(id, 'lemon');
  expect((await experience(id)).filter(row => row.reason === 'first-review')).toEqual([{ reason: 'first-review', points: 25 }]);
});

it('pays nothing to a member blocked by the site', async () => {
  const id = await member();
  await pool.query('insert into "userBlock" ("userId") values ($1)', [id]);
  // A blocked member can't post a review at all, and the award itself refuses them too.
  await expect(review(id, 'mango')).rejects.toThrow();
  await pool.query(`select award_profile_experience($1, 'first-review', 'first')`, [id]);
  expect(await experience(id)).toEqual([]);
});
