import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Only test database allowed');
const pool = new Pool({ connectionString: url, max: 2 });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const { getRetentionMetrics, getFeatureUsage } = await import('../src/lib/admin-growth');
const { cohortShare } = await import('../src/lib/admin-growth-fields');

// The numbers are site-wide, so every check compares before and after this file's own members.
const run = randomUUID().replaceAll('-', '').slice(0, 10);
const [stayer, oneDay, late, blocked, young] = Array.from({ length: 5 }, () => randomUUID());
const all = [stayer!, oneDay!, late!, blocked!, young!];
const TODAY = `(now() at time zone 'Europe/Moscow')::date`;
const OLD = 40;
const YOUNG = 3;
const weekOf = async (ago: number) => (await pool.query<{ week: string }>(`select to_char(date_trunc('week', ${TODAY} - $1::int)::date, 'YYYY-MM-DD') as week`, [ago])).rows[0]!.week;
const cohort = async (week: string) => (await getRetentionMetrics()).cohorts.find(item => item.week === week)
  ?? { members: 0, cells: { d1: { returned: 0, eligible: 0 }, d7: { returned: 0, eligible: 0 }, d30: { returned: 0, eligible: 0 } } };
const visit = (id: string, joinedAgo: number, after: number) => pool.query(`insert into "activityDay" (day, "userId") values (${TODAY} - $2::int + $3::int, $1) on conflict do nothing`, [id, joinedAgo, after]);

let before: { old: Awaited<ReturnType<typeof cohort>>; young: Awaited<ReturnType<typeof cohort>>; usage: Awaited<ReturnType<typeof getFeatureUsage>> };

beforeAll(async () => {
  const join = (id: string, ago: number, i: number) => pool.query(`insert into "user" (id, name, email, "emailVerified", username, "createdAt", "updatedAt")
    values ($1, $2, $3, true, $4, ((${TODAY} - $5::int) + time '12:00') at time zone 'Europe/Moscow', now())`, [id, `Growth ${run}`, `${id}@example.com`, `growth_${run}_${i}`, ago]);
  // A visit on the old sign-up day first: it keeps the start of activity records before the cohort, as on the site.
  await join(stayer!, OLD, 0); await visit(stayer!, OLD, 0);
  before = { old: await cohort(await weekOf(OLD)), young: await cohort(await weekOf(YOUNG)), usage: await getFeatureUsage() };
  await join(oneDay!, OLD, 1); await join(late!, OLD, 2); await join(blocked!, OLD, 3); await join(young!, YOUNG, 4);
  await pool.query(`insert into "userBlock" ("userId") values ($1)`, [blocked]);
  for (const after of [1, 8, 30]) await visit(stayer!, OLD, after);
  await visit(oneDay!, OLD, 1);
  // Outside both brackets: day 14 is past «7 дней», day 35 past «30 дней».
  for (const after of [14, 35]) await visit(late!, OLD, after);
  for (const after of [1, 8, 30]) await visit(blocked!, OLD, after);
  await visit(young!, YOUNG, 1);
});
afterAll(async () => { await pool.query('delete from "user" where id = any($1::text[])', [all]); await pool.end(); });

it('counts a weekly cohort coming back in bracketed windows, blocked members left out', async () => {
  const after = await cohort(await weekOf(OLD));
  // The stayer was in the cohort before too; the new members are three, the blocked one is not counted.
  expect(after.members - before.old.members).toBe(2);
  expect(after.cells.d1.eligible - before.old.cells.d1.eligible).toBe(2);
  expect(after.cells.d1.returned - before.old.cells.d1.returned).toBe(2);
  expect(after.cells.d7.returned - before.old.cells.d7.returned).toBe(1);
  expect(after.cells.d30.returned - before.old.cells.d30.returned).toBe(1);
  expect(after.cells.d30.eligible - before.old.cells.d30.eligible).toBe(2);
});

it('counts a young member only in windows already over', async () => {
  const after = await cohort(await weekOf(YOUNG));
  expect(after.members - before.young.members).toBe(1);
  expect(after.cells.d1.returned - before.young.cells.d1.returned).toBe(1);
  expect(after.cells.d7.eligible - before.young.cells.d7.eligible).toBe(0);
  expect(cohortShare({ returned: 0, eligible: 0 })).toBeNull();
  expect(cohortShare({ returned: 1, eligible: 3 })).toBe(33);
});

it('counts feature usage by day, «Лунный цикл» runs and newcomers\' first steps', async () => {
  await pool.query(`insert into "dailyReward" ("userId", day, step, xp, sparks) values ($1, ${TODAY}, 6, 75, 4), ($2, ${TODAY}, 6, 75, 4)`, [young, blocked]);
  await pool.query(`insert into "profileComment" ("profileId", "userId", text) values ($1, $1, $2)`, [stayer, `Growth ${run}`]);
  await pool.query(`insert into "userFollow" ("userId", "targetId") values ($1, $2)`, [young, stayer]);
  const after = await getFeatureUsage();
  const feature = (usage: typeof after, key: string) => usage.features.find(item => item.key === key)!;
  expect(feature(after, 'daily').week - feature(before.usage, 'daily').week).toBe(1);
  expect(feature(after, 'daily').byDay.at(-1)!.members - feature(before.usage, 'daily').byDay.at(-1)!.members).toBe(1);
  expect(feature(after, 'feed').week - feature(before.usage, 'feed').week).toBe(1);
  expect(feature(after, 'daily').byDay).toHaveLength(14);
  expect(after.daily.today - before.usage.daily.today).toBe(1);
  expect(after.daily.reached[5]! - before.usage.daily.reached[5]!).toBe(1);
  expect(after.daily.reached[10]! - before.usage.daily.reached[10]!).toBe(0);
  // Only the young member signed up within 30 days; the blocked one is never counted.
  expect(after.firstSteps.members - before.usage.firstSteps.members).toBe(1);
  expect(after.firstSteps.followed - before.usage.firstSteps.followed).toBe(1);
});
