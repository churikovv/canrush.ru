import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const databaseUrl = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(databaseUrl).pathname !== '/canrush_site_test') throw new Error('Only canrush_site_test is allowed');
const pool = new Pool({ connectionString: databaseUrl, max: 4, allowExitOnIdle: true });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
// Only the database helpers are under test; the session lookup is not.
vi.mock('../src/lib/auth', () => ({ auth: { api: {} } }));
const { isSiteAdminEmail, isSiteStaffEmail, siteRoleForEmail } = await import('../src/lib/admin');
const { getAdminDashboardData } = await import('../src/lib/admin-dashboard-data');
const { getProfileCommunity } = await import('../src/lib/profile-community');
const { getUserReview } = await import('../src/lib/reviews');
const { visibleProfileAchievements } = await import('../src/lib/profile-achievements');

const run = randomUUID().slice(0, 8);
const moderator = { id: `mod-${run}`, email: `moderator-${run}@example.com`, username: `mod_${run}` };
const member = { id: `member-${run}`, email: `member-${run}@example.com`, username: `member_${run}` };

beforeAll(async () => {
  for (const user of [moderator, member]) await pool.query(
    `insert into "user" (id, name, email, "emailVerified", username, "createdAt", "updatedAt") values ($1, 'Role test', $2, true, $3, now(), now())`,
    [user.id, user.email, user.username]);
  await pool.query(`insert into "siteAdmin" (email, role) values ($1, 'moderator')`, [moderator.email]);
  await pool.query(`insert into review (id, "userId", brand, flavor, design, taste, text, "createdAt", "updatedAt") values ($1, $2, 'Burn', 'original', 8, 8, $3, now(), now())`,
    [randomUUID(), member.id, `Отзыв для проверки ролей ${run}`]);
});
afterAll(async () => {
  await pool.query('delete from "siteAdmin" where email = $1', [moderator.email]);
  await pool.query('delete from "user" where id = any($1::text[])', [[moderator.id, member.id]]);
  await pool.end();
});

it('tells a moderator from an administrator', async () => {
  expect(await siteRoleForEmail(moderator.email)).toBe('moderator');
  expect(await isSiteStaffEmail(moderator.email)).toBe(true);
  // Secret tags, the bot's admin summary and the «admin» tag stay with administrators.
  expect(await isSiteAdminEmail(moderator.email)).toBe(false);
  expect(await siteRoleForEmail('sobik.steam@yandex.ru')).toBe('admin');
  expect(await siteRoleForEmail(member.email)).toBeNull();
  expect((await getProfileCommunity(moderator.id)).earned).not.toContain('admin');
});

it('keeps the owner an administrator', async () => {
  await expect(pool.query(`update "siteAdmin" set role = 'moderator' where "isOwner"`)).rejects.toMatchObject({ code: '23514' });
});

it('shows moderators nicknames instead of emails, and email search finds nothing for them', async () => {
  const forAdmin = await getAdminDashboardData(member.username, 'users', 1, true);
  expect(forAdmin.users.find(user => user.id === member.id)?.email).toBe(member.email);
  const forModerator = await getAdminDashboardData(member.username, 'users', 1, false);
  expect(forModerator.users.find(user => user.id === member.id)?.email).toBe(`@${member.username}`);
  // An email typed into the search reveals nothing to a moderator.
  expect((await getAdminDashboardData(member.email, 'users', 1, false)).users).toEqual([]);
  expect((await getAdminDashboardData(member.email, 'users', 1, true)).users.map(user => user.id)).toEqual([member.id]);
});

it('gives a moderator the «Модератор» tag while the role lasts, without storing it', async () => {
  expect((await getProfileCommunity(moderator.id)).earned).toContain('moderator');
  expect((await pool.query(`select 1 from "profileAchievement" where "userId" = $1 and key = 'moderator'`, [moderator.id])).rowCount).toBe(0);
  // Shown on the moderator's own reviews once picked.
  await pool.query(`update "user" set "profileTags" = '{moderator}' where id = $1`, [moderator.id]);
  await pool.query(`insert into review (id, "userId", brand, flavor, design, taste, text, "createdAt", "updatedAt") values ($1, $2, 'Burn', 'mango', 9, 9, 'Тег модератора', now(), now())`, [randomUUID(), moderator.id]);
  expect((await getUserReview(moderator.id, 'Burn', 'mango'))?.author.tag).toBe('Модератор');
  // Listed for administrators and for the moderator who holds it, hidden from the rest.
  expect(visibleProfileAchievements(false, []).some(item => item.key === 'moderator')).toBe(false);
  expect(visibleProfileAchievements(false, ['moderator']).some(item => item.key === 'moderator')).toBe(true);
  expect(visibleProfileAchievements(true, []).some(item => item.key === 'moderator')).toBe(true);
  // Without the role the tag goes away everywhere, even if it is still selected.
  await pool.query(`delete from "siteAdmin" where email = $1`, [moderator.email]);
  expect((await getProfileCommunity(moderator.id)).earned).not.toContain('moderator');
  expect((await getUserReview(moderator.id, 'Burn', 'mango'))?.author.tag).toBeNull();
});
