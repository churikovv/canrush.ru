import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 3 });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const { getFirstSteps, hideFirstSteps, NEWCOMER_DAYS } = await import('../src/lib/first-steps');
const { getFirstDayMetrics } = await import('../src/lib/admin-dashboard-data');
const { getGachaState } = await import('../src/lib/gacha');

const ids: string[] = [];
async function member(createdAt = 'now()') {
  const id = randomUUID();
  ids.push(id);
  await pool.query(`insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt",username) values($1,'First steps',$2,true,${createdAt},now(),$3)`, [id, `${id}@example.com`, `fs_${id.slice(0, 12)}`]);
  return id;
}
const done = async (id: string) => (await getFirstSteps(id))?.filter(step => step.done).map(step => step.key);
const pull = (id: string, at = 'now()') => pool.query(`insert into "gachaPull"("userId",batch,brand,flavor,rarity,"createdAt") values($1,gen_random_uuid(),'Бренд','вкус','common',${at})`, [id]);

beforeAll(async () => { await member(); });
afterAll(async () => {
  await pool.query('delete from "user" where id = any($1::text[])', [ids]);
  await pool.end();
});

it('ticks each step from real data and leaves when all are done', async () => {
  const id = await member();
  expect(await getFirstSteps(id)).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'gacha', done: false, reward: '+30 крышек', href: '/gacha' })]));
  expect(await done(id)).toEqual([]);

  await pull(id);
  expect(await done(id)).toEqual(['gacha']);
  await pool.query(`insert into "drinkSwipe"("userId",brand,flavor,liked) values($1,'Бренд','вкус',true)`, [id]);
  expect(await done(id)).toEqual(['gacha', 'dating']);
  await pool.query(`insert into "drinkLog"("userId",name,brand,flavor,day) values($1,'Бренд вкус','Бренд','вкус',(now() at time zone 'Europe/Moscow')::date)`, [id]);
  expect(await done(id)).toEqual(['gacha', 'dating', 'drink']);
  await pool.query(`insert into "profileImage"("userId",kind,data) values($1,'avatar','\\x00')`, [id]);
  expect(await getFirstSteps(id)).toBeNull();
});

it('counts a review as the drink step and needs a nickname for the profile step', async () => {
  const id = await member();
  await pool.query(`insert into review("userId",brand,flavor,design,taste,composition,text) values($1,'Бренд','вкус',5,5,5,'Хороший напиток')`, [id]);
  expect(await done(id)).toEqual(['drink']);
  await pool.query(`update "user" set username = null where id = $1`, [id]);
  await pool.query(`insert into "profileImage"("userId",kind,data) values($1,'avatar','\\x00')`, [id]);
  expect(await done(id)).toEqual(['drink']);
});

it('names the welcome caps only until they are paid', async () => {
  const id = await member();
  await getGachaState(id);
  expect((await getFirstSteps(id))?.find(step => step.key === 'gacha')?.reward).toBeNull();
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
