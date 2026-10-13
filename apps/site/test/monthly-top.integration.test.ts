import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const databaseUrl = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(databaseUrl).pathname !== '/canrush_site_test') throw new Error('Only canrush_site_test is allowed');
const pool = new Pool({ connectionString: databaseUrl, max: 4, allowExitOnIdle: true });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const { getProfileCommunity, setProfileTags } = await import('../src/lib/profile-community');
const { getNotifications } = await import('../src/lib/notifications');

// A far-future month keeps the race isolated from real test data and from other runs.
const year = 2100 + Math.floor(Math.random() * 800);
const month = `${year}-05`;
const inMonth = (day: number, hour = 12) => `${month}-${String(day).padStart(2, '0')} ${hour}:00:00+03`;
const settleAt = `${year}-06-02 10:00:00+03`;
const ids = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const [a, b, c, d] = ids as [string, string, string, string];
const username = (id: string) => `top_${id.replaceAll('-', '').slice(0, 12)}`;
const gain = (id: string, key: string, points: number, at: string, reason = 'review') =>
  pool.query(`insert into "profileExperience" ("userId",reason,"sourceKey",points,"createdAt") values ($1,$2,$3,$4,$5)`, [id, reason, key, points, at]);
const settle = () => pool.query('select settle_monthly_top($1::timestamptz)', [settleAt]);

beforeAll(async () => {
  for (const id of ids) await pool.query(`insert into "user" (id,name,username,email,"emailVerified","createdAt","updatedAt") values ($1,'Top test',$2,$3,true,now(),now())`, [id, username(id), `${id}@example.com`]);
  await gain(a, 'a1', 250, inMonth(3)); await gain(a, 'a2', 150, inMonth(20));
  await gain(b, 'b1', 300, inMonth(5));
  await gain(c, 'c1', 300, inMonth(9));
  await gain(d, 'd1', 50, inMonth(10));
  await gain(d, `${year}-04`, 1000, inMonth(1), 'monthly-top');
  await gain(d, 'd-next', 900, `${year}-06-01 00:30:00+03`);
});
afterAll(async () => {
  await pool.query('delete from "user" where id=any($1::text[])', [ids]);
  await pool.query('delete from "monthlyTopSettlement" where month=$1::date', [`${month}-01`]);
  await pool.end();
});

describe.sequential('monthly top-3 award', () => {
  it('ranks Moscow-month XP without award XP, breaks ties by who got there first and pays once under concurrency', async () => {
    await Promise.all([settle(), settle(), settle()]);
    await settle();
    const awards = await pool.query(`select place, "userId", xp, reward from "monthlyTopAward" where month=$1::date order by place`, [`${month}-01`]);
    expect(awards.rows).toEqual([{ place: 1, userId: a, xp: 400, reward: 500 }, { place: 2, userId: b, xp: 300, reward: 300 }, { place: 3, userId: c, xp: 300, reward: 150 }]);
    const paid = await pool.query(`select "userId", points from "profileExperience" where reason='monthly-top' and "sourceKey"=$1 order by points desc`, [month]);
    expect(paid.rows).toEqual([{ userId: a, points: 500 }, { userId: b, points: 300 }, { userId: c, points: 150 }]);
  });

  it('grants the selectable TOP tag and notifies winners', async () => {
    expect((await getProfileCommunity(c)).earned).toContain('top');
    await setProfileTags(c, ['top']);
    expect((await pool.query('select "profileTags" from "user" where id=$1', [c])).rows[0].profileTags).toEqual(['top']);
    await expect(setProfileTags(d, ['top'])).rejects.toThrow();
    expect((await getNotifications(a)).items.find(item => item.kind === 'monthly-top')).toMatchObject({ title: 'Вы заняли 1 место в топе месяца', detail: '+500 XP и тег «ТОП» для профиля' });
  });
});
