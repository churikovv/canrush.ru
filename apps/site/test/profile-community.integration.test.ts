import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';

const databaseUrl = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(databaseUrl).pathname !== '/canrush_site_test') throw new Error('Only canrush_site_test is allowed');
const pool = new Pool({ connectionString: databaseUrl, max: 3, allowExitOnIdle: true });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const community = await import('../src/lib/profile-community');
const ids = [randomUUID(), randomUUID(), randomUUID()];
const [a, b, c] = ids as [string, string, string];
beforeAll(async () => {
  for (const id of ids) await pool.query(`insert into "user" (id, name, email, "emailVerified", username, "createdAt", "updatedAt") values ($1, 'Community test', $2, true, $3, now(), now())`, [id, `${id}@example.com`, `test_${id.replaceAll('-', '').slice(0, 16)}`]);
});
afterAll(async () => { await pool.query('delete from "user" where id = any($1::text[])', [ids]); await pool.end(); });

describe.sequential('community profile storage', () => {
  it('makes friends only for reciprocal subscriptions and remains idempotent', async () => {
    await community.setFollowing(a, b, true);
    await community.setFollowing(a, b, true);
    expect(await community.getProfileCommunity(b, a)).toMatchObject({ followers: 1, friends: 0, isFollowing: true, followsYou: false });
    expect((await community.getConnections(a, 'friends')).count).toBe(0);
    await community.setFollowing(b, a, true);
    expect(await community.getProfileCommunity(a, b)).toMatchObject({ followers: 1, following: 1, friends: 1, isFollowing: true, followsYou: true });
    expect((await community.getConnections(a, 'friends')).users).toHaveLength(1);
    await community.setFollowing(b, a, false);
    expect((await community.getProfileCommunity(a)).friends).toBe(0);
    expect((await community.getProfileCommunity(a)).earned).toContain('friend');
    await expect(community.setFollowing(a, a, true)).rejects.toThrow('себя');
    expect((await community.getConnections(a, 'following', 2)).users).toEqual([]);
  });
  it('computes rating averages and histogram and grants only earned tags', async () => {
    await expect(community.setProfileTags(a, ['critic'])).rejects.toThrow('полученный');
    for (const [design, taste, composition, flavor] of [[5, 5, 4, 'one'], [1, 2, 1, 'two']] as const) {
      await pool.query(`insert into review ("userId", brand, flavor, design, taste, composition, text) values ($1, 'Test', $2, $3, $4, $5, 'Test')`, [a, flavor, design, taste, composition]);
    }
    const ratings = await community.getProfileRatings(a);
    expect(ratings.count).toBe(2);
    expect(ratings.overall).toBe(3.25);
    expect(ratings.histogram).toEqual(Array.from({ length: 10 }, (_, i) => ({ score: 10 - i, count: [5, 2].includes(10 - i) ? 1 : 0 })));
    await expect(community.setProfileTags(a, ['first-review', 'friend'])).rejects.toThrow();
    await community.setProfileTags(a, ['first-review']);
    expect((await community.getProfileCommunity(a)).tags).toEqual(['first-review']);
    await expect(community.setProfileTags(a, ['first-review', 'first-review'])).rejects.toThrow();
    expect((await community.getProfileRatings(c)).count).toBe(0);
  });
  it('limits concurrent wall posts and permits removal only by owner or author', async () => {
    const attempts = await Promise.allSettled([community.addProfileComment(a, b, ' hello '), community.addProfileComment(a, b, 'duplicate')]);
    expect(attempts.filter(item => item.status === 'fulfilled')).toHaveLength(1);
    const wall = await community.getProfileWall(b);
    expect(wall.count).toBe(1);
    const id = wall.comments[0]!.id;
    await expect(community.deleteProfileComment(c, id)).rejects.toThrow('доступа');
    await community.deleteProfileComment(b, id);
    expect((await community.getProfileWall(b)).count).toBe(0);
    // Deleting a comment must not bypass the publishing cooldown.
    await expect(community.addProfileComment(a, b, 'too soon')).rejects.toThrow('30 секунд');
    const own = await community.addProfileComment(c, b, 'author removes this');
    await community.deleteProfileComment(c, own);
    await expect(community.addProfileComment(b, a, '   ')).rejects.toThrow('1000');
  });
  it('blocks public contributions by moderated users at the database boundary', async () => {
    await pool.query('insert into "userBlock" ("userId") values ($1)', [c]);
    await expect(community.setFollowing(c, a, true)).rejects.toMatchObject({ code: '42501' });
    await pool.query('update "user" set "lastWallPostAt" = null where id = $1', [c]);
    await expect(community.addProfileComment(c, b, 'blocked')).rejects.toMatchObject({ code: '42501' });
  });
  it('requires a live session and recent activity for online status and respects privacy', async () => {
    await community.touchPresence(a);
    expect(await community.getPresence(a)).toBe('offline');
    await pool.query(`insert into session (id, "userId", token, "expiresAt", "createdAt", "updatedAt") values ($1, $2, $3, now() + interval '1 hour', now(), now())`, [randomUUID(), a, randomUUID()]);
    expect(await community.getPresence(a)).toBe('online');
    await pool.query(`update "user" set "lastSeenAt" = now() - interval '3 minutes' where id = $1`, [a]);
    expect(await community.getPresence(a)).toBe('offline');
    await community.setPresenceVisibility(a, false);
    await community.touchPresence(a);
    expect(await community.getPresence(a)).toBe('hidden');
    expect((await pool.query('select "lastSeenAt" from "user" where id = $1', [a])).rows[0]?.lastSeenAt).toBeNull();
    await community.setPresenceVisibility(a, true);
    await community.touchPresence(a);
    expect(await community.getPresence(a)).toBe('online');
    await pool.query('delete from session where "userId" = $1', [a]);
    expect(await community.getPresence(a)).toBe('offline');
  });
  it('awards the Telegram tag and XP once, permits selection, and preserves earned achievements', async () => {
    await expect(community.setProfileTags(b, ['telegram'])).rejects.toThrow('полученный');
    await pool.query('update "user" set "telegramChannel" = $2 where id = $1', [b, 'canrushoff']);
    expect((await community.getProfileCommunity(b)).earned).toContain('telegram');
    await community.setProfileTags(b, ['telegram']);
    expect((await community.getProfileCommunity(b)).tags).toEqual(['telegram']);
    const xp = await pool.query('select points from "profileExperience" where "userId" = $1 and reason = \'achievement\' and "sourceKey" = \'telegram\'', [b]);
    expect(xp.rows).toEqual([{ points: 20 }]);
    await pool.query('update "user" set "telegramChannel" = null where id = $1', [b]);
    expect((await community.getProfileCommunity(b)).earned).toContain('telegram');
    await pool.query('update "user" set "telegramChannel" = $2 where id = $1', [b, 'another_channel']);
    await community.getProfileCommunity(b);
    expect((await pool.query('select points from "profileExperience" where "userId" = $1 and "sourceKey" = \'telegram\'', [b])).rows).toEqual([{ points: 20 }]);
  });
  it('cascades community data when an account is deleted', async () => {
    await pool.query('delete from "user" where id = $1', [a]);
    expect((await pool.query('select 1 from "userFollow" where "userId" = $1 or "targetId" = $1', [a])).rowCount).toBe(0);
    expect((await pool.query('select 1 from "profileAchievement" where "userId" = $1', [a])).rowCount).toBe(0);
  });
});
