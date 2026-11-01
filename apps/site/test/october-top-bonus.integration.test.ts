import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool, type PoolClient } from 'pg';
import { afterAll, expect, it, vi } from 'vitest';

const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 1 });
let client: PoolClient;
vi.mock('../src/db/pool', () => ({ getPool: () => ({ query: (...args: Parameters<PoolClient['query']>) => client.query(...args) }) }));
const { getNotifications } = await import('../src/lib/notifications');

afterAll(() => pool.end());

it('tops the October ten up to the new prizes once and tells them', async () => {
  client = await pool.connect();
  try {
    // Everything happens in a transaction that rolls back: the migration has already run on this database.
    await client.query('begin');
    await client.query(`delete from "monthlyTopAward" where month = '2026-10-01'`);
    await client.query(`insert into "monthlyTopSettlement" (month) values ('2026-10-01') on conflict do nothing`);
    const members = Array.from({ length: 12 }, () => randomUUID());
    const blocked = randomUUID();
    for (const [index, id] of [...members, blocked].entries()) {
      await client.query(`insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt",username) values($1,'Top',$2,true,now(),now(),$3)`,
        [id, `${id}@example.com`, `ob_${id.replaceAll('-', '').slice(0, 12)}`]);
      await client.query(`insert into "profileExperience"("userId",reason,"sourceKey",points,"createdAt") values($1,'review','october-top',$2,'2026-10-15 12:00:00+03')`,
        [id, id === blocked ? 90_000_000 : 50_000_000 - index * 1000]);
    }
    await client.query(`insert into "userBlock"("userId") values($1)`, [blocked]);
    for (const [place, reward] of [[1, 1000], [2, 600], [3, 300]] as const) {
      await client.query(`insert into "monthlyTopAward"(month,place,"userId",xp,reward) values('2026-10-01',$1,$2,50000000,$3)`, [place, members[place - 1], reward]);
    }
    const sql = await readFile(new URL('../migrations/0170_october_top_bonus.sql', import.meta.url), 'utf8');
    await client.query(sql);
    await client.query(sql); // A second run pays nothing: the key is unique.

    const bonus = async (id: string) => (await client.query<{ points: number }>(
      `select points from "profileExperience" where "userId" = $1 and reason = 'weekly-top' and "sourceKey" = 'top-bonus:2026-10'`, [id])).rows.map(row => row.points);
    expect(await Promise.all(members.map(bonus))).toEqual([[6000], [2900], [3200], [3500], [3500], [1200], [1200], [1200], [1200], [1200], [], []]);
    expect(await bonus(blocked)).toEqual([]);

    const items = async (id: string) => (await getNotifications(id)).items.filter(item => item.kind === 'top-bonus');
    expect(await items(members[0]!)).toMatchObject([{ title: 'Топ октября пересчитан по новым наградам', href: '/leaderboard', detail: expect.stringMatching(/^1 место: было \+1.000 XP, стало \+7.000\. Начислили ещё \+6.000 XP$/) }]);
    expect(await items(members[5]!)).toMatchObject([{ detail: expect.stringMatching(/^6 место: начислили \+1.200 XP$/) }]);
    expect(await items(members[10]!)).toEqual([]);
  } finally {
    await client.query('rollback');
    client.release();
  }
});
