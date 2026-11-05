import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 3 });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const { claimFirstStep, getFirstSteps, hideFirstSteps, wearFirstStepReward, FIRST_SWIPES, NEWCOMER_DAYS } = await import('../src/lib/first-steps');
const { getFirstDayMetrics } = await import('../src/lib/admin-dashboard-data');
const { getGachaState } = await import('../src/lib/gacha');

const ids: string[] = [];
async function member(createdAt = 'now()') {
  const id = randomUUID();
  ids.push(id);
  await pool.query(`insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt",username) values($1,'First steps',$2,true,${createdAt},now(),$3)`, [id, `${id}@example.com`, `fs_${id.slice(0, 12)}`]);
  return id;
}
const steps = async (id: string) => (await getFirstSteps(id))?.steps;
const done = async (id: string) => (await steps(id))?.filter(step => step.done).map(step => step.key);
const pull = (id: string, at = 'now()') => pool.query(`insert into "gachaPull"("userId",batch,brand,flavor,rarity,"createdAt") values($1,gen_random_uuid(),'Бренд','вкус','common',${at})`, [id]);
const swipe = (id: string, count: number) => pool.query(`insert into "drinkSwipe"("userId",brand,flavor,liked) select $1,'Бренд','вкус ' || gen_random_uuid(),true from generate_series(1, $2::int)`, [id, count]);
const follow = (id: string, target: string) => pool.query(`insert into "userFollow"("userId","targetId") values($1,$2)`, [id, target]);
const look = async (id: string) => (await pool.query<{ tags: string[]; frame: string }>(`select "profileTags" as tags, "profileAppearance"->>'frame' as frame from "user" where id = $1`, [id])).rows[0];

let other = '';
beforeAll(async () => { other = await member(); });
afterAll(async () => {
  await pool.query('delete from "user" where id = any($1::text[])', [ids]);
  await pool.end();
});

it('ticks the three steps from real data, gives the tag and the frame by button and leaves when all is taken', async () => {
  const id = await member();
  expect((await steps(id))?.[0]).toMatchObject({ key: 'gacha', done: false, reward: { kind: 'caps' }, href: '/gacha' });
  expect(await done(id)).toEqual([]);

  await pull(id);
  expect(await done(id)).toEqual(['gacha']);
  await swipe(id, FIRST_SWIPES - 1);
  expect((await steps(id))?.find(step => step.key === 'swipes')).toMatchObject({ done: false, progress: { value: FIRST_SWIPES - 1, goal: FIRST_SWIPES } });
  expect(await claimFirstStep(id, 'swipes')).toMatchObject({ ok: false });
  await swipe(id, 1);
  expect((await steps(id))?.find(step => step.key === 'swipes')).toMatchObject({ done: true, claimable: true });

  expect(await claimFirstStep(id, 'swipes')).toEqual({ ok: true, equipped: true });
  expect((await look(id))?.tags).toEqual(['first-charge']);
  const xp = await pool.query(`select points from "profileExperience" where "userId" = $1 and reason = 'achievement' and "sourceKey" = 'first-charge'`, [id]);
  expect(xp.rowCount).toBe(1);
  expect(await claimFirstStep(id, 'swipes')).toEqual({ ok: true, equipped: true });
  expect((await pool.query(`select 1 from "profileExperience" where "userId" = $1 and "sourceKey" = 'first-charge'`, [id])).rowCount).toBe(1);

  expect(await claimFirstStep(id, 'follow')).toMatchObject({ ok: false });
  await follow(id, other);
  expect((await steps(id))?.find(step => step.key === 'follow')).toMatchObject({ done: true, claimable: true });
  expect(await claimFirstStep(id, 'follow')).toEqual({ ok: true, equipped: true });
  expect((await look(id))?.frame).toBe('charge');
  expect(await getFirstSteps(id)).toBeNull();
});

it('puts a reward on only into an empty slot, and «Надеть» swaps it in later', async () => {
  const id = await member();
  await pool.query(`insert into "profileAchievement"("userId",key) values($1,'date')`, [id]);
  await pool.query(`update "user" set "profileTags" = array['date'], "profileAppearance" = jsonb_set("profileAppearance", '{frame}', '"pulse"') where id = $1`, [id]);
  await swipe(id, FIRST_SWIPES);
  await follow(id, other);
  expect(await wearFirstStepReward(id, 'swipes')).toBe(false);
  expect(await claimFirstStep(id, 'swipes')).toEqual({ ok: true, equipped: false });
  expect(await claimFirstStep(id, 'follow')).toEqual({ ok: true, equipped: false });
  expect(await look(id)).toEqual({ tags: ['date'], frame: 'pulse' });
  expect(await wearFirstStepReward(id, 'swipes')).toBe(true);
  expect(await wearFirstStepReward(id, 'follow')).toBe(true);
  expect(await look(id)).toEqual({ tags: ['first-charge'], frame: 'charge' });
});

it('offers someone to follow while that step waits, never the member themself', async () => {
  const id = await member();
  await pool.query(`update "user" set "lastSeenAt" = now() where id = $1`, [other]);
  const card = await getFirstSteps(id);
  expect(card?.person?.id).toBeTruthy();
  expect(card?.person?.id).not.toBe(id);
  await follow(id, other);
  expect((await getFirstSteps(id))?.person).toBeNull();
});

it('names the welcome caps only until they are paid', async () => {
  const id = await member();
  await getGachaState(id);
  expect((await steps(id))?.find(step => step.key === 'gacha')?.reward).toEqual({ kind: 'card' });
});

it('keeps «Скрыть» in the database, whichever device asks next', async () => {
  const id = await member();
  await hideFirstSteps(id);
  const first = (await pool.query(`select "firstStepsHiddenAt" from "user" where id = $1`, [id])).rows[0];
  expect(await getFirstSteps(id)).toBeNull();
  await hideFirstSteps(id);
  expect((await pool.query(`select "firstStepsHiddenAt" from "user" where id = $1`, [id])).rows[0]).toEqual(first);
});

it('shows the card to newcomers only: an old member with XP and the blocked do not get it', async () => {
  const old = `now() - interval '${NEWCOMER_DAYS + 5} days'`;
  const idle = await member(old), veteran = await member(old), blocked = await member();
  expect(await getFirstSteps(idle)).not.toBeNull();
  await pool.query(`insert into "profileExperience"("userId",reason,"sourceKey",points) values($1,'favorite','k',2)`, [veteran]);
  expect(await getFirstSteps(veteran)).toBeNull();
  await pool.query('insert into "userBlock"("userId") values($1)', [blocked]);
  expect(await getFirstSteps(blocked)).toBeNull();
  expect(await getFirstSteps(randomUUID())).toBeNull();
  await swipe(veteran, FIRST_SWIPES);
  expect(await claimFirstStep(veteran, 'swipes')).toMatchObject({ ok: false });
});

it('counts first-day actions for newcomers whose first day is over', async () => {
  const before = await getFirstDayMetrics();
  const two = `now() - interval '2 days'`;
  const quick = await member(two), late = await member(two), idle = await member(two), fresh = await member(), blocked = await member(two);
  await pull(quick, `now() - interval '2 days' + interval '1 hour'`);
  await pool.query(`insert into "profileComment"("profileId","userId",text,"createdAt") values($1,$1,'Привет',now() - interval '47 hours')`, [quick]);
  await pull(late);
  await pull(fresh);
  await pull(blocked, `now() - interval '2 days' + interval '1 hour'`);
  await pool.query('insert into "userBlock"("userId") values($1)', [blocked]);
  const after = await getFirstDayMetrics();
  expect(idle).toBeTruthy();
  expect(after.members - before.members).toBe(3);
  expect(after.acted - before.acted).toBe(1);
  expect(after.pulled - before.pulled).toBe(1);
  expect(after.posted - before.posted).toBe(1);
  expect(after.fresh - before.fresh).toBe(1);
});
