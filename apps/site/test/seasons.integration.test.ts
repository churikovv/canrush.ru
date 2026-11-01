import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 4 });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const { getWeekRace } = await import('../src/lib/week-race');
const { XP_SOURCES } = await import('../src/lib/xp-sources');
const { getProfileCommunity } = await import('../src/lib/profile-community');
const { getNotifications } = await import('../src/lib/notifications');
const { claimSeasonPass, getSeasonPass } = await import('../src/lib/season-pass');

const members = Array.from({ length: 12 }, () => randomUUID());
const [first, second, sixth, , , , , , , , eleventh, banned] = [members[0]!, members[1]!, members[5]!, 0, 0, 0, 0, 0, 0, 0, members[10]!, members[11]!];
const passMember = randomUUID(), passBlocked = randomUUID();
const everyone = [...members, passMember, passBlocked];
// A far-future Monday keeps the race away from real rows. Two weeks: results of the first, then of the second.
const year = 2900 + Math.floor(Math.random() * 90);
const monday = new Date(Date.UTC(year, 0, 1));
monday.setUTCDate(monday.getUTCDate() + ((8 - monday.getUTCDay()) % 7));
const day = (offset: number) => new Date(monday.getTime() + offset * 86_400_000).toISOString().slice(0, 10);
const weekOne = day(0);
const settle = (date: string) => pool.query('select settle_weekly_top($1::timestamptz)', [`${date} 10:00:00+03`]);
const tags = async (id: string) => (await pool.query<{ profileTags: string[] }>('select "profileTags" from "user" where id = $1', [id])).rows[0]!.profileTags;
const gain = (id: string, key: string, points: number, at: string, reason = 'review') =>
  pool.query(`insert into "profileExperience" ("userId",reason,"sourceKey",points,"createdAt") values ($1,$2,$3,$4,$5)`, [id, reason, key, points, `${at} 12:00:00+03`]);

beforeAll(async () => {
  for (const id of everyone) await pool.query(`insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt",username) values($1,'Season test',$2,true,now(),now(),$3)`,
    [id, `${id}@example.com`, `se_${id.replaceAll('-', '').slice(0, 12)}`]);
  await pool.query('insert into "userBlock"("userId") values ($1), ($2)', [banned, passBlocked]);
  for (const [index, id] of members.entries()) await gain(id, `week-${index}`, 2000 - index * 100, day(1));
  await gain(first, 'prize', 9000, day(2), 'monthly-top');
  await pool.query(`insert into "profileAchievement"("userId", key) values ($1, 'telegram') on conflict do nothing`, [second]);
  await pool.query(`update "user" set "profileTags" = '{telegram}' where id = $1`, [second]);
});
afterAll(async () => {
  await pool.query(`delete from "weeklyTopSettlement" where week >= $1::date`, [weekOne]);
  await pool.query('delete from "user" where id = any($1::text[])', [everyone]);
  await pool.end();
});

it('pays the top ten of the week once, without prize XP in the race and without the banned', async () => {
  await Promise.all([settle(day(7)), settle(day(7)), settle(day(8))]);
  const awards = (await pool.query<{ place: number; userId: string; reward: number; tag: string }>(`select place, "userId", reward, tag from "weeklyTopAward" where week = $1::date order by place`, [weekOne])).rows;
  expect(awards).toHaveLength(10);
  expect(awards[0]).toMatchObject({ userId: first, reward: 2000, tag: 'week-hero' });
  expect(awards[1]).toMatchObject({ userId: second, reward: 1000, tag: 'week-best' });
  expect(awards[5]).toMatchObject({ userId: sixth, reward: 350, tag: 'week-charge' });
  expect(awards.some(award => award.userId === eleventh || award.userId === banned)).toBe(false);
  const paid = (await pool.query<{ points: number }>(`select points from "profileExperience" where "userId" = $1 and reason = 'weekly-top'`, [first])).rows;
  expect(paid).toEqual([{ points: 2000 }]);
});

it('puts the tag on the winner and tells them', async () => {
  expect(await tags(first)).toEqual(['week-hero']);
  expect(await tags(second)).toEqual(['week-best']);
  expect((await getProfileCommunity(first)).earned).toContain('week-hero');
  expect((await getNotifications(first)).items.find(item => item.kind === 'weekly-top')).toMatchObject({ title: 'Вы заняли 1 место за неделю', detail: '+2000 XP и тег «Герой недели» на всю неделю', href: '/leaderboard' });
});

it('takes the tag back at the next results and returns the chosen one', async () => {
  await settle(day(14));
  expect(await tags(first)).toEqual([]);
  expect(await tags(second)).toEqual(['telegram']);
  expect((await getProfileCommunity(first)).earned).not.toContain('week-hero');
  expect((await pool.query(`select 1 from "profileAchievement" where "userId" = $1 and key like 'week-%'`, [second])).rowCount).toBe(0);
});

it('shows the running race with the viewer out of the ten', async () => {
  const now = new Date();
  const moscow = new Date(now.getTime() + 3 * 3_600_000).toISOString().slice(0, 10);
  const stamp = `${moscow} ${String(new Date(now.getTime() + 3 * 3_600_000).getUTCHours()).padStart(2, '0')}:00:00+03`;
  const runners = members.slice(0, 11);
  for (const [index, id] of runners.entries()) await pool.query(`insert into "profileExperience" ("userId",reason,"sourceKey",points,"createdAt") values ($1,'review',$2,$3,$4)`, [id, `now-${index}`, 100000 - index * 1000, stamp]);
  await pool.query(`insert into "profileExperience" ("userId",reason,"sourceKey",points,"createdAt") values ($1,'weekly-top','now',500000,$2)`, [eleventh, stamp]);
  const race = await getWeekRace(eleventh, Date.parse('2026-11-04T09:00:00Z'));
  const others = race.leaders.filter(entry => !entry.username.startsWith('se_'));
  expect(others).toHaveLength(0);
  expect(race.leaders).toHaveLength(10);
  expect(race.leaders[0]).toMatchObject({ place: 1, reward: 2000 });
  expect(race.viewer).toMatchObject({ place: 11, gap: 1001 });
  await pool.query(`delete from "profileExperience" where "sourceKey" like 'now%' and "userId" = any($1::text[])`, [members]);
});

it('fills the season pass from the season without the tracker and pays each level once', async () => {
  const today = new Date(Date.now() + 3 * 3_600_000).toISOString().slice(0, 10);
  await gain(passMember, 'pass-review', 130, today);
  await gain(passMember, 'pass-can', 5000, today, 'drink-day');
  await gain(passMember, 'pass-week', 5000, today, 'weekly-top');
  const before = await getSeasonPass(passMember);
  expect(before).toMatchObject({ points: 130, reached: 2, ready: 2 });

  const claimed = await claimSeasonPass(passMember);
  expect(claimed.claimed).toEqual([{ kind: 'caps', amount: 10 }, { kind: 'shards', amount: 5 }]);
  expect(claimed.pass).toMatchObject({ ready: 0 });
  expect((await pool.query(`select amount from "capLedger" where "userId" = $1 and reason = 'pass'`, [passMember])).rows).toEqual([{ amount: 10 }]);
  expect((await pool.query(`select amount from "shardLedger" where "userId" = $1 and reason = 'pass'`, [passMember])).rows).toEqual([{ amount: 5 }]);
  await expect(claimSeasonPass(passMember)).rejects.toThrow('Новых наград');

  await gain(passMember, 'pass-more', 100, today);
  expect((await claimSeasonPass(passMember)).claimed).toEqual([{ kind: 'spins', amount: 1 }]);
  expect((await pool.query(`select coalesce(sum(amount), 0)::int as spins from "spinLedger" where "userId" = $1`, [passMember])).rows[0]).toEqual({ spins: 1 });
});

it('refuses the pass to a blocked member', async () => {
  const today = new Date(Date.now() + 3 * 3_600_000).toISOString().slice(0, 10);
  await gain(passBlocked, 'pass-review', 500, today);
  await expect(claimSeasonPass(passBlocked)).rejects.toThrow('заблокирован');
});

it('pays no XP cap for drinks any more', async () => {
  const id = passMember;
  for (let index = 0; index < 51; index++) await pool.query(`select award_profile_experience($1, 'catalog-drink', $2)`, [id, `drink-${index}`]);
  expect((await pool.query(`select count(*)::int as n from "profileExperience" where "userId" = $1 and reason = 'catalog-drink'`, [id])).rows[0]).toEqual({ n: 51 });
});

it('ends the countdown exactly where the database ends the week', async () => {
  const { rows } = await pool.query<{ end: Date }>(`select upper(weekly_top_bounds(date_trunc('week', now() at time zone 'Europe/Moscow')::date)) as "end"`);
  expect((await getWeekRace()).endsAt).toBe(rows[0]?.end.getTime());
});

it('shows the same amounts the database pays', async () => {
  const payer = members[2]!;
  for (const source of XP_SOURCES.filter(item => item.reason !== 'collection')) {
    await pool.query('select award_profile_experience($1, $2, $3)', [payer, source.reason, `guide-${source.reason}`]);
    const paid = await pool.query<{ points: number }>('select points from "profileExperience" where "userId" = $1 and reason = $2 and "sourceKey" = $3', [payer, source.reason, `guide-${source.reason}`]);
    expect([source.reason, paid.rows[0]?.points]).toEqual([source.reason, source.points]);
  }
});
