import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const databaseUrl = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(databaseUrl).pathname !== '/canrush_site_test') throw new Error('Only canrush_site_test is allowed');
const pool = new Pool({ connectionString: databaseUrl, max: 4, allowExitOnIdle: true });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const { getProfileCommunity, setProfileTags } = await import('../src/lib/profile-community');
const { DETAILED_REVIEW_CHARS } = await import('../src/lib/profile-achievements');

const ids: string[] = [randomUUID(), randomUUID()];
const [a, b] = ids as [string, string];
const username = (id: string) => `ach_${id.replaceAll('-', '').slice(0, 12)}`;
const longText = 'М'.repeat(DETAILED_REVIEW_CHARS);
const review = (id: string, brand: string, flavor: string, text = longText) =>
  pool.query('insert into review ("userId",brand,flavor,design,taste,composition,text) values ($1,$2,$3,4,5,4,$4)', [id, brand, flavor, text]);
const gain = (id: string, key: string, points: number, at = 'now()') =>
  pool.query(`insert into "profileExperience" ("userId",reason,"sourceKey",points,"createdAt") values ($1,'review',$2,$3,${at === 'now()' ? 'now()' : '$4::timestamptz'})`, at === 'now()' ? [id, key, points] : [id, key, points, at]);
const achievementXp = async (id: string, key: string) => (await pool.query<{ points: number }>(`select points from "profileExperience" where "userId"=$1 and reason='achievement' and "sourceKey"=$2`, [id, key])).rows[0]?.points;

beforeAll(async () => { for (const id of ids) await pool.query(`insert into "user" (id,name,username,email,"emailVerified","createdAt","updatedAt") values ($1,'Ach test',$2,$3,true,now(),now())`, [id, username(id), `${id}@example.com`]); });
afterAll(async () => { await pool.query('delete from "user" where id=any($1::text[])', [ids]); await pool.end(); });

describe.sequential('Монстр, Фан и Шоппер', () => {
  it('needs three Monster reviews, three of them detailed', async () => {
    await review(a, 'Monster', 'ultra', 'Коротко');
    await review(a, 'Monster', 'mango');
    await review(a, 'Burn', 'apple');
    await review(a, 'Monster', 'pipeline');
    let community = await getProfileCommunity(a);
    expect(community.progress).toMatchObject({ monster: 3, monsterDetailed: 2 });
    expect(community.earned).not.toContain('monster');
    await review(a, 'Monster', 'zero');
    community = await getProfileCommunity(a);
    expect(community.earned).toContain('monster');
    expect(await achievementXp(a, 'monster')).toBe(20);
    await setProfileTags(a, ['monster']);
    expect((await pool.query('select "profileTags" from "user" where id=$1', [a])).rows[0].profileTags).toEqual(['monster']);
  });
  it('counts the best 7 days of XP, without old backfills, tag rewards or the monthly top', async () => {
    await gain(b, 'old', 5000, '2026-10-01T12:00:00+03:00');
    await pool.query(`insert into "profileExperience" ("userId",reason,"sourceKey",points) values ($1,'monthly-top','2100-01',500)`, [b]);
    await gain(b, 'w1', 150, `${new Date(Date.now() - 10 * 86400000).toISOString()}`);
    await gain(b, 'w2', 150);
    expect((await getProfileCommunity(b)).progress.weeklyXp).toBe(150);
    await gain(b, 'w3', 150);
    const community = await getProfileCommunity(b);
    expect(community.progress.weeklyXp).toBe(300);
    expect(community.earned).toContain('fan');
  });
  it('gives Шоппер only for a store that passed moderation', async () => {
    const store = await pool.query(`insert into "marketStore" ("ownerId",name,city,address) values ($1,$2,'moscow','Тестовая улица, 1') returning id`, [b, `Ach ${b}`]);
    expect((await getProfileCommunity(b)).earned).not.toContain('shopper');
    await pool.query(`update "marketStore" set status='published' where id=$1`, [store.rows[0].id]);
    expect((await getProfileCommunity(b)).earned).toContain('shopper');
  });
});
