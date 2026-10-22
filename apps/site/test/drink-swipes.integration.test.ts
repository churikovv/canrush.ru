import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 4 });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const swipes = await import('../src/lib/drink-swipes');

const member = randomUUID(), other = randomUUID(), banned = randomUUID(), dater = randomUUID();
const brand = `Свайп ${randomUUID().slice(0, 8)}`;
const groups = ['apple', 'mango', 'cherry', 'lime'].map(flavor => ({ brand, flavor, variants: [], minPrice: 99, coverImageUrl: `/images/${flavor}.jpg` }));

beforeAll(async () => {
  for (const id of [member, other, banned, dater]) await pool.query(
    `insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt",username) values($1,'Swipe test',$2,true,now(),now(),$3)`, [id, `${id}@example.com`, `sw_${id.slice(0, 12)}`]);
  await pool.query('insert into "userBlock"("userId") values($1)', [banned]);
});
afterAll(async () => {
  await pool.query('delete from "user" where id = any($1::text[])', [[member, other, banned, dater]]);
  await pool.end();
});

it('records, changes and undoes a swipe, only for catalog drinks and unblocked members', async () => {
  await swipes.recordSwipe(member, groups, brand, 'apple', true);
  await swipes.recordSwipe(other, groups, brand, 'apple', false);
  expect(await swipes.getSwipeCounts(brand, 'apple')).toEqual({ liked: 1, skipped: 1 });
  await swipes.recordSwipe(other, groups, brand, 'apple', true);
  expect(await swipes.getSwipeCounts(brand, 'apple')).toEqual({ liked: 2, skipped: 0 });
  await swipes.undoSwipe(other, brand, 'apple');
  expect(await swipes.getSwipeCounts(brand, 'apple')).toEqual({ liked: 1, skipped: 0 });
  await expect(swipes.recordSwipe(member, groups, brand, 'peach', true)).rejects.toThrow('нет в каталоге');
  await expect(swipes.recordSwipe(banned, groups, brand, 'apple', true)).rejects.toThrow('заблокирован');
});

it('deals cards the member has not swiped yet and lists their matches', async () => {
  const deck = await swipes.getSwipeDeck(member, groups);
  expect(deck.map(card => card.flavor).sort()).toEqual(['cherry', 'lime', 'mango']);
  expect((await swipes.getSwipeDeck(null, groups)).find(card => card.flavor === 'apple')).toMatchObject({ likes: 1, minPrice: 99 });
  expect((await swipes.getLikedSwipes(member, groups)).map(card => card.flavor)).toEqual(['apple']);
});

it('pays 2 XP for each of the first 30 drinks once and gives «Люблю <3» for 20 swipes with 5 matches', async () => {
  const many = Array.from({ length: 34 }, (_, i) => ({ ...groups[0]!, flavor: `f${i}` })) as typeof groups;
  const xp = async () => (await pool.query<{ reason: string; points: number }>(`select reason, sum(points)::int as points from "profileExperience" where "userId" = $1 group by reason`, [dater])).rows;
  const first = await swipes.recordSwipe(dater, many, brand, 'f0', true);
  expect(first).toEqual({ xp: 2, tag: null });
  // Changing the decision, or undoing and swiping again, does not pay twice.
  expect((await swipes.recordSwipe(dater, many, brand, 'f0', false)).xp).toBe(0);
  await swipes.undoSwipe(dater, brand, 'f0');
  expect((await swipes.recordSwipe(dater, many, brand, 'f0', true)).xp).toBe(0);
  const tags: string[] = [];
  for (let i = 1; i < 34; i++) {
    const reward = await swipes.recordSwipe(dater, many, brand, `f${i}`, i < 5);
    if (reward.tag) tags.push(`${i}:${reward.tag.label}`);
  }
  expect(tags).toEqual(['19:Люблю <3']);
  expect(await xp()).toEqual(expect.arrayContaining([{ reason: 'swipe', points: 60 }, { reason: 'achievement', points: 20 }]));
  expect(await swipes.swipeXpLeft(dater)).toBe(0);
});
