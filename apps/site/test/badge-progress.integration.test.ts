import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';

const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Only test database allowed');
const pool = new Pool({ connectionString: url, max: 3 });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const { getBadges } = await import('../src/lib/badge-progress');
const { getProfileCommunity } = await import('../src/lib/profile-community');

const user = randomUUID();
beforeAll(async () => {
  await pool.query('insert into "user" (id,name,email,username,"emailVerified","createdAt","updatedAt") values ($1,$2,$3,$4,true,now(),now())', [user, 'Медали', `${user}@example.com`, `bd${user.slice(0, 8)}`]);
});
afterAll(async () => {
  await pool.query('delete from "user" where id = $1', [user]);
  await pool.end();
});

it('counts the real actions, stores what is earned once and keeps its date', async () => {
  const empty = await getBadges(user);
  expect(empty.earned).toEqual([]);
  expect(empty.progress.gachaPulls).toBe(0);

  await pool.query(`insert into "gachaPull" ("userId", batch, brand, flavor, rarity) values ($1, gen_random_uuid(), 'Burn', 'original', 'common')`, [user]);
  await pool.query(`insert into battle (id, "userId", status, state, "finishedAt") values (gen_random_uuid(), $1, 'won', '{}'::jsonb, now()), (gen_random_uuid(), $1, 'lost', '{}'::jsonb, now())`, [user]);
  const first = await getBadges(user);
  expect(first.progress).toMatchObject({ gachaPulls: 1, battleWins: 1, battlesPlayed: 2 });
  expect(first.earned.map(row => row.key).sort()).toEqual(['battle-win', 'first-pull']);

  // A second view finds them stored, with the same dates, and the profile counts them.
  const again = await getBadges(user);
  expect(again.earned.map(row => [row.key, row.earnedAt.toISOString()]).sort()).toEqual(first.earned.map(row => [row.key, row.earnedAt.toISOString()]).sort());
  expect((await getProfileCommunity(user)).badges.sort()).toEqual(['battle-win', 'first-pull']);

  // Earned for good: the progress may fall later, the achievement stays.
  await pool.query('delete from "gachaPull" where "userId" = $1', [user]);
  expect((await getBadges(user)).earned.map(row => row.key)).toContain('first-pull');
});
