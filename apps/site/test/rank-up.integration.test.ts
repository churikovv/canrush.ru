import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const databaseUrl = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(databaseUrl).pathname !== '/canrush_site_test') throw new Error('Only canrush_site_test is allowed');
const pool = new Pool({ connectionString: databaseUrl, max: 4, allowExitOnIdle: true });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const { getFeed, setFollowing } = await import('../src/lib/profile-community');

const ids: string[] = [randomUUID(), randomUUID(), randomUUID()];
const [a, b, c] = ids as [string, string, string];
const username = (id: string) => `rank_${id.replaceAll('-', '').slice(0, 12)}`;
const gain = (id: string, key: string, points: number) =>
  pool.query(`insert into "profileExperience" ("userId",reason,"sourceKey",points) values ($1,'review',$2,$3)`, [id, key, points]);
const tiers = async (id: string) => (await pool.query<{ tier: string }>('select tier from "rankUp" where "userId"=$1 order by "createdAt", tier', [id])).rows.map(row => row.tier);
const rankUps = (items: Awaited<ReturnType<typeof getFeed>>['items']) => items.flatMap(item => item.kind === 'rank-up' && ids.includes(item.rankUp.userId) ? [`${item.rankUp.username}:${item.rankUp.tier}`] : []);

beforeAll(async () => { for (const id of ids) await pool.query(`insert into "user" (id,name,username,email,"emailVerified","createdAt","updatedAt") values ($1,'Rank test',$2,$3,true,now(),now())`, [id, username(id), `${id}@example.com`]); });
afterAll(async () => { await pool.query('delete from "user" where id=any($1::text[])', [ids]); await pool.end(); });

describe.sequential('rank-up feed events', () => {
  it('records gold once, when the total crosses 2800 XP', async () => {
    await gain(a, 'a1', 2700);
    expect(await tiers(a)).toEqual([]);
    await gain(a, 'a2', 100);
    await gain(a, 'a3', 100);
    expect(await tiers(a)).toEqual(['gold']);
  });
  it('announces only the highest tier of a single jump', async () => {
    await gain(b, 'b1', 7000);
    expect(await tiers(b)).toEqual(['platinum']);
    await gain(b, 'b2', 12000);
    expect(await tiers(b)).toEqual(['platinum', 'legend']);
  });
  it('mixes rank-ups into the feed, newest first, and filters them by follows', async () => {
    const all = await getFeed(null);
    expect(rankUps(all.items)).toEqual([`${username(b)}:legend`, `${username(b)}:platinum`, `${username(a)}:gold`]);
    expect(all.items.find(item => item.kind === 'rank-up' && item.rankUp.userId === a)).toMatchObject({ rankUp: { xp: 2900, name: 'Rank test', avatarId: null } });
    expect(rankUps((await getFeed(c, 'following')).items)).toEqual([]);
    await setFollowing(c, a, true);
    expect(rankUps((await getFeed(c, 'following')).items)).toEqual([`${username(a)}:gold`]);
    expect(rankUps((await getFeed(a, 'following')).items)).toEqual([`${username(a)}:gold`]);
  });
  it('hides blocked members', async () => {
    await pool.query('insert into "userBlock" ("userId") values ($1)', [b]);
    expect(rankUps((await getFeed(null)).items)).toEqual([`${username(a)}:gold`]);
  });
});
