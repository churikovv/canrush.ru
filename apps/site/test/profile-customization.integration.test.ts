import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const databaseUrl = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(databaseUrl).pathname !== '/canrush_site_test') throw new Error('Only canrush_site_test is allowed');
const pool = new Pool({ connectionString: databaseUrl, max: 2, allowExitOnIdle: true });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const { saveProfileCustomization } = await import('../src/lib/profile-images');
const { getProfileByUserId } = await import('../src/lib/profile');
const { getProfileCommunity, setProfileTags } = await import('../src/lib/profile-community');
const { getReviewsForUser } = await import('../src/lib/reviews');
const { GET } = await import('../src/app/api/profile-images/[id]/route');
const ids = [randomUUID(), randomUUID()];
const [a, b] = ids as [string, string];
const username = (id: string) => `custom_${id.replaceAll('-', '').slice(0, 12)}`;
const input = { username: username(a), name: 'Updated', telegramChannel: null };
beforeAll(async () => {
  for (const id of ids) await pool.query(`insert into "user" (id, name, username, email, "emailVerified", "createdAt", "updatedAt") values ($1, 'Test', $2, $3, true, now(), now())`, [id, username(id), `${id}@example.com`]);
  await pool.query(`insert into review ("userId", brand, flavor, design, taste, composition, text) values ($1, 'Burn', 'one', 4, 5, 3, 'Test')`, [a]);
});
afterAll(async () => { await pool.query('delete from "siteAdmin" where email = $1', [`${a}@example.com`]); await pool.query('delete from "user" where id = any($1::text[])', [ids]); await pool.end(); });
describe.sequential('profile image storage and displayed tags', () => {
  it('stores text and images together and serves only current images', async () => {
    await saveProfileCustomization(a, input, { avatar: Buffer.from('avatar fixture'), banner: Buffer.from('banner fixture') });
    const profile = (await getProfileByUserId(a))!;
    expect(profile.name).toBe('Updated'); expect(profile.avatarId).toBeTruthy(); expect(profile.bannerId).toBeTruthy();
    const response = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: profile.avatarId! }) });
    expect(response.headers.get('content-type')).toBe('image/webp'); expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).toBe('avatar fixture');
    await saveProfileCustomization(a, input, { avatar: Buffer.from('new avatar') });
    expect((await GET(new Request('http://localhost'), { params: Promise.resolve({ id: profile.avatarId! }) })).status).toBe(404);
    const updated = (await getProfileByUserId(a))!;
    expect(updated.bannerId).toBe(profile.bannerId); expect(updated.avatarId).not.toBe(profile.avatarId);
    expect((await getReviewsForUser(a))[0]?.author.avatarId).toBe(updated.avatarId);
  });
  it('rolls back all changes when a username is taken or image write fails', async () => {
    const before = await getProfileByUserId(a);
    await expect(saveProfileCustomization(a, { ...input, username: username(b) }, { avatar: null })).rejects.toMatchObject({ code: '23505' });
    expect((await getProfileByUserId(a))?.avatarId).toBe(before?.avatarId);
    await expect(saveProfileCustomization(a, { ...input, name: 'Must roll back' }, { banner: Buffer.alloc(0) })).rejects.toMatchObject({ code: '23514' });
    expect((await getProfileByUserId(a))?.name).toBe('Updated');
  });
  it('allows exactly one earned tag and displays it on preexisting reviews', async () => {
    await setProfileTags(a, ['first-review']);
    expect((await getReviewsForUser(a))[0]?.author.tag).toBe('Первое открытие');
    await expect(setProfileTags(a, ['first-review', 'collector'])).rejects.toThrow();
    await expect(pool.query('update "user" set "profileTags"=$2 where id=$1', [a, ['first-review', 'collector']])).rejects.toMatchObject({ code: '23514' });
    await setProfileTags(a, []); expect((await getReviewsForUser(a))[0]?.author.tag).toBeNull();
  });
  it('restricts the Admin tag to current administrators, including after revocation', async () => {
    await expect(setProfileTags(a, ['admin'])).rejects.toThrow();
    await pool.query('insert into "siteAdmin" (email) values ($1)', [`${a}@example.com`]);
    await setProfileTags(a, ['admin']);
    expect((await getReviewsForUser(a))[0]?.author.tag).toBe('Админ');
    await pool.query('delete from "siteAdmin" where email = $1', [`${a}@example.com`]);
    expect((await getProfileCommunity(a)).tags).toEqual([]);
    expect((await getReviewsForUser(a))[0]?.author.tag).toBeNull();
    await expect(setProfileTags(a, ['admin'])).rejects.toThrow();
  });
  it('awards product tags only for the matching reviews and allows selecting them', async () => {
    await pool.query(`insert into review ("userId", brand, flavor, design, taste, composition, text) values ($1, 'Monster', 'monster_ultra_rosa', 5, 5, 5, 'Review')`, [b]);
    expect((await getProfileCommunity(b)).earned).not.toContain('altushka');
    expect((await getProfileCommunity(b)).earned).not.toContain('flash');
    await pool.query(`insert into review ("userId", brand, flavor, design, taste, composition, text) values ($1, 'Monster', 'monster_ultra_white:sugarfree', 5, 5, 5, 'Review'), ($1, 'Flash Up', 'original', 5, 5, 5, 'Review')`, [b]);
    const community = await getProfileCommunity(b);
    expect(community.earned).toEqual(expect.arrayContaining(['altushka', 'flash']));
    await setProfileTags(b, ['altushka']);
    expect((await getReviewsForUser(b))[0]?.author.tag).toBe('Альтушка');
    await setProfileTags(b, ['flash']);
    expect((await getReviewsForUser(b))[0]?.author.tag).toBe('Флэш');
  });
  it('saves layout with profile changes and isolates it from other users', async () => {
    const layout = { order: ['listings', 'experience', 'ratings', 'wall', 'social', 'about', 'favorites'] as const, hidden: ['wall', 'ratings'] as const };
    await saveProfileCustomization(a, input, {}, { order: [...layout.order], hidden: [...layout.hidden] });
    expect((await getProfileByUserId(a))?.profileLayout).toEqual(layout);
    expect((await getProfileByUserId(b))?.profileLayout?.hidden).toEqual(['favorites', 'listings']);
  });
  it('removes images explicitly and cascades them on account deletion', async () => {
    await saveProfileCustomization(a, input, { avatar: null });
    expect((await getProfileByUserId(a))?.avatarId).toBeNull();
    const bannerId = (await getProfileByUserId(a))!.bannerId!;
    await pool.query('delete from "user" where id=$1', [a]);
    expect((await GET(new Request('http://localhost'), { params: Promise.resolve({ id: bannerId }) })).status).toBe(404);
    expect((await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'bad-id' }) })).status).toBe(404);
  });
});
