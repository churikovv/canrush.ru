import { randomUUID } from 'node:crypto';
import { afterAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 3 });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const { claimDaily, getDailyRewards, wearDailyItem } = await import('../src/lib/daily-rewards');
const { getShop } = await import('../src/lib/shop');
const { OWNED_ITEM_SPARKS } = await import('../src/lib/daily-reward-fields');

const ids: string[] = [];
async function member() {
  const id = randomUUID();
  ids.push(id);
  await pool.query(`insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt",username) values($1,'Daily',$2,true,now(),now(),$3)`, [id, `${id}@example.com`, `dl_${id.slice(0, 12)}`]);
  return id;
}
/** Moscow days from 1 November 2026. */
const day = (n: number) => { const date = new Date(Date.UTC(2026, 10, 1 + n)); return date.toISOString().slice(0, 10); };
const look = async (id: string) => (await pool.query<{ tags: string[]; theme: string; frame: string }>(`select "profileTags" as tags, "profileAppearance"->>'theme' as theme, "profileAppearance"->>'frame' as frame from "user" where id = $1`, [id])).rows[0]!;

afterAll(async () => {
  await pool.query('delete from "user" where id = any($1::text[])', [ids]);
  await pool.end();
});

it('takes one reward a day, writes its XP once and refuses a second one the same day', async () => {
  const id = await member();
  expect((await getDailyRewards(id, day(0)))?.track).toEqual({ step: 1, claimed: false, behind: 0, restarted: false });
  expect(await claimDaily(id, day(0))).toMatchObject({ ok: true, reward: { step: 1, xp: 25, sparks: 2 }, track: { claimed: true } });
  expect(await claimDaily(id, day(0))).toMatchObject({ ok: false });
  const xp = await pool.query(`select points from "profileExperience" where "userId" = $1 and reason = 'daily'`, [id]);
  expect(xp.rows).toEqual([{ points: 25 }]);
  expect((await getShop(id)).sources.daily).toBe(2);
  expect(await claimDaily(id, day(1))).toMatchObject({ ok: true, reward: { step: 2 } });
});

it('starts the path over after a missed day', async () => {
  const id = await member();
  await claimDaily(id, day(0));
  await claimDaily(id, day(1));
  expect((await getDailyRewards(id, day(3)))?.track).toMatchObject({ step: 1, restarted: true });
  expect(await claimDaily(id, day(3))).toMatchObject({ ok: true, reward: { step: 1 } });
});

it('gives the tag, the background and the frame on their days, puts them on into empty places and lets them be worn', async () => {
  const id = await member();
  for (let n = 0; n < 4; n++) await claimDaily(id, day(n));
  expect(await claimDaily(id, day(4))).toMatchObject({ ok: true, reward: { step: 5, item: { key: 'moon-young' } }, equipped: true });
  expect((await look(id)).tags).toEqual(['moon-young']);
  // The taken day keeps showing the tag it gave, not the sparks a later cycle would give.
  expect((await getDailyRewards(id, day(4)))?.rewards[4]).toMatchObject({ item: { key: 'moon-young' }, sparks: 0 });
  expect((await pool.query(`select 1 from "profileExperience" where "userId" = $1 and reason = 'achievement' and "sourceKey" = 'moon-young'`, [id])).rowCount).toBe(1);
  for (let n = 5; n < 9; n++) await claimDaily(id, day(n));
  expect(await claimDaily(id, day(9))).toMatchObject({ ok: true, reward: { step: 10, item: { key: 'moonlight' } }, equipped: true });
  expect((await look(id)).theme).toBe('moonlight');
  // A frame goes on only into an empty place; «Надеть» swaps it in.
  await pool.query(`update "user" set "profileAppearance" = jsonb_set("profileAppearance", '{frame}', '"pulse"') where id = $1`, [id]);
  for (let n = 10; n < 14; n++) await claimDaily(id, day(n));
  expect(await claimDaily(id, day(14))).toMatchObject({ ok: true, reward: { step: 15, item: { key: 'crescent' } }, equipped: false });
  expect((await look(id)).frame).toBe('pulse');
  expect(await wearDailyItem(id, 'crescent')).toBe(true);
  expect(await wearDailyItem(id, 'moon-cycle')).toBe(false);
  expect((await look(id)).frame).toBe('crescent');
});

it('pays sparks instead of a thing already owned in a later cycle', async () => {
  const id = await member();
  await pool.query(`insert into "profileAchievement"("userId",key) values($1,'moon-young')`, [id]);
  for (let n = 0; n < 4; n++) await claimDaily(id, day(n));
  expect(await claimDaily(id, day(4))).toMatchObject({ ok: true, reward: { step: 5, item: null, sparks: OWNED_ITEM_SPARKS } });
  expect((await getDailyRewards(id, day(4)))?.rewards[4]).toMatchObject({ item: null, sparks: OWNED_ITEM_SPARKS });
});

it('gives nothing to a member blocked by the site', async () => {
  const id = await member();
  await pool.query('insert into "userBlock"("userId") values($1)', [id]);
  expect(await getDailyRewards(id, day(0))).toBeNull();
  expect(await claimDaily(id, day(0))).toMatchObject({ ok: false });
});
