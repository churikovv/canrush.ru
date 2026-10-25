import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 4 });
const staff = vi.hoisted(() => ({ role: 'moderator' as 'admin' | 'moderator' }));
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: (to: string) => { throw new Error(`redirect:${to}`); } }));
vi.mock('../src/lib/admin', () => ({
  requireSiteAdmin: async () => ({ userId: moderator, email: moderatorEmail, isOwner: false, role: staff.role }),
  requireFullAdmin: async () => { if (staff.role !== 'admin') throw new Error('redirect:/admin?error=forbidden'); return { userId: moderator, email: moderatorEmail, isOwner: false, role: 'admin' }; },
}));
const [member, moderator, colleague] = [randomUUID(), randomUUID(), randomUUID()];
const moderatorEmail = `${moderator}@example.com`;
const actions = await import('../src/app/admin/actions');
const { frozenMessage, isFrozenError } = await import('../src/lib/moderation');

const form = (extra: Record<string, string> = {}) => { const data = new FormData(); data.set('userId', member); data.set('tab', 'users'); for (const [key, value] of Object.entries(extra)) data.set(key, value); return data; };
const run = (action: (data: FormData) => Promise<void>, data = form()) => action(data).then(() => 'done', (error: Error) => error.message);
const audit = async () => (await pool.query<{ action: string }>('select action from "adminAuditLog" where "adminEmail" = $1 order by "createdAt", action', [moderatorEmail])).rows.map(row => row.action);

beforeAll(async () => {
  for (const id of [member, moderator, colleague]) await pool.query(
    `insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt",username) values($1,'Members test',$2,true,now(),now(),$3)`, [id, `${id}@example.com`, `am_${id.slice(0, 12)}`]);
  await pool.query('insert into "siteAdmin"(email, role) values ($1, \'moderator\'), ($2, \'moderator\')', [moderatorEmail, `${colleague}@example.com`]);
});
afterAll(async () => {
  await pool.query('delete from "adminAuditLog" where "adminEmail" = $1', [moderatorEmail]);
  await pool.query('delete from "siteAdmin" where email = any($1::text[])', [[moderatorEmail, `${colleague}@example.com`]]);
  await pool.query('delete from "user" where id = any($1::text[])', [[member, moderator, colleague]]);
  await pool.end();
});

it('freezes posting for a while: the site and the database both refuse, the profile stays', async () => {
  expect(await run(actions.freezeUserAction, form({ days: '7' }))).toBe('redirect:/admin?notice=user-frozen&tab=users');
  expect(await frozenMessage(member)).toMatch(/^Аккаунт заморожен модератором до /u);
  const post = pool.query(`insert into "profileComment"("profileId","userId",text) values ($1,$1,'Пишу')`, [member]);
  await expect(post).rejects.toMatchObject({ code: 'CR002' });
  expect(isFrozenError(await post.catch(error => error))).toBe(true);
  // A lapsed freeze lets the member post again without anyone lifting it.
  await pool.query(`update "userFreeze" set until = now() - interval '1 minute' where "userId" = $1`, [member]);
  expect(await frozenMessage(member)).toBeNull();
  await pool.query(`insert into "profileComment"("profileId","userId",text) values ($1,$1,'Снова пишу')`, [member]);
  expect(await run(actions.freezeUserAction, form({ days: '1' }))).toMatch(/user-frozen/u);
  expect(await run(actions.unfreezeUserAction)).toMatch(/user-unfrozen/u);
  expect(await frozenMessage(member)).toBeNull();
});

it('deletes all of a member’s tier lists and comments, never a teammate’s', async () => {
  await pool.query(`insert into "tierList"(id,"userId",slug,title,status) values (gen_random_uuid(),$1,$2,'Список','draft')`, [member, `t-${member.slice(0, 12)}`]);
  expect(await run(actions.purgeUserTierListsAction)).toMatch(/tierlists-purged/u);
  expect((await pool.query('select 1 from "tierList" where "userId" = $1', [member])).rowCount).toBe(0);
  expect(await run(actions.purgeUserCommentsAction)).toMatch(/comments-purged/u);
  expect((await pool.query('select 1 from "profileComment" where "userId" = $1', [member])).rowCount).toBe(0);
  const teammate = new FormData(); teammate.set('userId', colleague);
  expect(await run(actions.freezeUserAction, teammate)).toBe('redirect:/admin?error=invalid-target&tab=analytics');
});

it('lets only an administrator delete the account', async () => {
  expect(await run(actions.deleteUserAction)).toBe('redirect:/admin?error=forbidden');
  staff.role = 'admin';
  expect(await run(actions.deleteUserAction)).toMatch(/user-deleted/u);
  expect((await pool.query('select 1 from "user" where id = $1', [member])).rowCount).toBe(0);
  expect(await audit()).toEqual(expect.arrayContaining(['freeze-7d', 'freeze-1d', 'unfreeze', 'purge-tierlists', 'purge-comments', 'delete-account']));
});
