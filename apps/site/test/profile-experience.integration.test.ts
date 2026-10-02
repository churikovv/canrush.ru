import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const databaseUrl = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(databaseUrl).pathname !== '/canrush_site_test') throw new Error('Only canrush_site_test is allowed');
const pool = new Pool({ connectionString: databaseUrl, max: 4, allowExitOnIdle: true });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const { getExperience } = await import('../src/lib/profile-experience');
const { getProfileWall, getProfileCommunity, setProfileTags } = await import('../src/lib/profile-community');
const ids = [randomUUID(), randomUUID(), randomUUID()];
const [a, b, c] = ids as [string, string, string];
const username = (id: string) => `xp_${id.replaceAll('-', '').slice(0, 12)}`;
const review = (id: string, flavor: string) => pool.query(`insert into review ("userId",brand,flavor,design,taste,composition,text) values ($1,'Burn',$2,4,5,3,'Test') on conflict ("userId",brand,flavor) do update set text='Edited'`, [id, flavor]);
const xp = async (id: string) => (await getExperience([username(id)]))[username(id)]?.xp;
beforeAll(async () => { for (const id of ids) await pool.query(`insert into "user" (id,name,username,email,"emailVerified","createdAt","updatedAt") values ($1,'XP test',$2,$3,true,now(),now())`, [id, username(id), `${id}@example.com`]); });
afterAll(async () => { await pool.query('delete from "user" where id=any($1::text[])', [ids]); await pool.end(); });
describe.sequential('experience awards and wall identity', () => {
  it('awards a review once even after edits or deletion and recreation', async () => {
    await review(a, 'one'); expect(await xp(a)).toBe(25);
    await review(a, 'one'); expect(await xp(a)).toBe(25);
    await pool.query('delete from review where "userId"=$1', [a]);
    await review(a, 'one'); expect(await xp(a)).toBe(25);
  });
  it('awards achievements once, excludes admin and shows wall avatars and selected tags', async () => {
    await getProfileCommunity(a); expect(await xp(a)).toBe(45);
    await getProfileCommunity(a); expect(await xp(a)).toBe(45);
    await pool.query('insert into "profileAchievement" ("userId",key) values ($1,\'admin\')', [a]);
    expect(await xp(a)).toBe(45);
    await setProfileTags(a, ['first-review']);
    const image = await pool.query('insert into "profileImage" ("userId",kind,data) values ($1,\'avatar\',$2) returning id', [a, Buffer.from('fixture')]);
    await pool.query('insert into "profileComment" ("profileId","userId",text) values ($1,$2,\'Hello\')', [b, a]);
    expect((await getProfileWall(b)).comments[0]).toMatchObject({ tag: 'first-review', xp: 45, avatarId: image.rows[0].id });
  });
  it('enforces lifetime favorite limits under concurrent inserts', async () => {
    const results = await Promise.allSettled(Array.from({ length: 25 }, (_, i) => pool.query('insert into favorite ("userId",brand,flavor) values ($1,\'Burn\',$2)', [b, String(i)])));
    expect(results.every(result => result.status === 'fulfilled')).toBe(true);
    expect(await xp(b)).toBe(40);
    await pool.query('delete from favorite where "userId"=$1', [b]);
    await pool.query('insert into favorite ("userId",brand,flavor) values ($1,\'Burn\',\'new\')', [b]);
    expect(await xp(b)).toBe(40);
  });
  it('gives tied contributors the same ranking and excludes blocked users', async () => {
    await review(c, 'one');
    await pool.query('insert into "profileAchievement" ("userId",key) values ($1,\'first-review\')', [c]);
    const values = await getExperience([username(a), username(c)]);
    expect(values[username(a)]?.rank).toBe(values[username(c)]?.rank);
    await pool.query('insert into "userBlock" ("userId") values ($1)', [c]);
    expect((await getExperience([username(c)]))[username(c)]).toBeUndefined();
  });
  it('only rewards published tierlists and never rewards republication', async () => {
    const result = await pool.query(`insert into "tierList" ("userId",slug,title,status) values ($1,$2,'Test','draft') returning id`, [a, `xp-${randomUUID()}`]);
    const id = result.rows[0].id;
    expect(await xp(a)).toBe(45);
    await pool.query('update "tierList" set status=\'published\' where id=$1', [id]);
    expect(await xp(a)).toBe(95);
    await pool.query('update "tierList" set status=\'draft\' where id=$1', [id]);
    await pool.query('update "tierList" set status=\'published\' where id=$1', [id]);
    expect(await xp(a)).toBe(95);
  });
});
