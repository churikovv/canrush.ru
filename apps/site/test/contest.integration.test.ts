import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import type { Contest } from '../src/lib/contest';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Only test database allowed');
const pool = new Pool({ connectionString: url, max: 3 });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const { getContestParticipants, drawContestWinner, redrawContestWinner, confirmContestWinner, getContestEntry, getContestDraws } = await import('../src/lib/contest-db');
const { findContest } = await import('../src/lib/contest');
const run = randomUUID().replaceAll('-', '').slice(0, 10);
// A private contest key and a far-away window keep this test's pool to its own members.
const contest: Contest = { ...findContest('box-2026-10')!, key: `test-${run}`, firstDay: '2020-03-01', lastDay: '2020-03-10', resultsDay: '2020-03-11' };
const running: Contest = { ...contest, key: `running-${run}`, firstDay: null, lastDay: '2099-01-01', resultsDay: '2099-01-02' };
const ids = { first: randomUUID(), second: randomUUID(), early: randomUUID(), admin: randomUUID(), blocked: randomUUID() };
const idList: string[] = Object.values(ids);
const adminEmail = `contest-admin-${run}@example.com`;
beforeAll(async () => {
  for (const [name, id] of Object.entries(ids)) await pool.query(`insert into "user" (id,name,email,"emailVerified",username,"createdAt","updatedAt") values ($1,$2,$3,true,$4,now(),now())`, [id, name, name === 'admin' ? adminEmail : `${name}-${run}@example.com`, `${name}_${run}`]);
  await pool.query('update "user" set "telegramUsername" = $2 where id = $1', [ids.first, `tg1_${run}`]);
  await pool.query('update "user" set "telegramUsername" = $2 where id = $1', [ids.second, `tg2_${run}`]);
  await pool.query('insert into "siteAdmin" (email) values ($1)', [adminEmail]);
  for (const id of [ids.first, ids.second, ids.admin, ids.blocked]) await pool.query(`insert into "drinkLog" ("userId", day, name) values ($1, '2020-03-05', 'Банка')`, [id]);
  await pool.query(`insert into "drinkLog" ("userId", day, name) values ($1, '2020-02-20', 'Рано')`, [ids.early]);
  await pool.query('insert into "userBlock" ("userId") values ($1)', [ids.blocked]);
});
afterAll(async () => {
  await pool.query('delete from "contestDraw" where contest = $1', [contest.key]);
  await pool.query('delete from "adminAuditLog" where "adminEmail" = $1', [adminEmail]);
  await pool.query('delete from "siteAdmin" where email = $1', [adminEmail]);
  await pool.query('delete from "user" where id = any($1::text[])', [idList]);
  await pool.end();
});
it('counts cans inside the contest days and leaves out admins and blocked members', async () => {
  expect((await getContestParticipants(contest)).map(entry => entry.id).sort()).toEqual([ids.first, ids.second].sort());
  expect(await getContestEntry(contest, ids.early)).toMatchObject({ cans: 0 });
});
it('redraws without an unreachable winner and gives the tag only on confirmation', async () => {
  await expect(drawContestWinner(running, adminEmail, { telegram: false, avatar: false })).rejects.toThrow('после его окончания');
  const first = await drawContestWinner(contest, adminEmail, { telegram: true, avatar: false });
  expect(first.poolSize).toBe(2);
  await expect(drawContestWinner(contest, adminEmail, { telegram: true, avatar: false })).rejects.toThrow('уже выбран');
  const second = await redrawContestWinner(contest, adminEmail, first.id);
  expect(second.poolSize).toBe(1); expect(second.winnerId).not.toBe(first.winnerId);
  await expect(redrawContestWinner(contest, adminEmail, first.id)).rejects.toThrow('закрыт');
  const tagged = async () => (await pool.query(`select "userId" from "profileAchievement" where key = 'energizer' and "userId" = any($1::text[])`, [idList])).rows.map(row => row.userId);
  expect(await tagged()).toEqual([]);
  await confirmContestWinner(contest, adminEmail, second.id);
  expect(await tagged()).toEqual([second.winnerId]);
  expect((await getContestDraws(contest)).map(draw => draw.status)).toEqual(['confirmed', 'unreachable']);
  // With the only other entrant out, a fresh redraw has nobody left.
  await pool.query(`update "contestDraw" set status = 'unreachable' where id = $1`, [second.id]);
  await expect(drawContestWinner(contest, adminEmail, { telegram: false, avatar: false })).rejects.toThrow('никто не подходит');
  await pool.query(`delete from "profileAchievement" where key = 'energizer' and "userId" = any($1::text[])`, [idList]);
});
