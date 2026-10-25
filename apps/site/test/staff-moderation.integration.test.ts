import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 4 });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const { staffDeleteContent, staffDeleteKind } = await import('../src/lib/staff-moderation');
const { getWallInteractions } = await import('../src/lib/wall-discussions');

const [author, moderator, member] = [randomUUID(), randomUUID(), randomUUID()];
const moderatorEmail = `${moderator}@example.com`;
let post = '';
let reply = '';

beforeAll(async () => {
  for (const id of [author, moderator, member]) await pool.query(
    `insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt",username) values($1,'Staff test',$2,true,now(),now(),$3)`, [id, `${id}@example.com`, `sm_${id.slice(0, 12)}`]);
  await pool.query('insert into "siteAdmin"(email, role) values($1, \'moderator\')', [moderatorEmail]);
  post = (await pool.query<{ id: string }>('insert into "profileComment"("profileId","userId",text) values ($1,$1,\'Запись\') returning id', [author])).rows[0]!.id;
  reply = (await pool.query<{ id: string }>('insert into "wallReply"("wallPostId","userId",text) values ($1,$2,\'Ответ\') returning id', [post, author])).rows[0]!.id;
});
afterAll(async () => {
  await pool.query('delete from "adminAuditLog" where "adminEmail" = $1', [moderatorEmail]);
  await pool.query('delete from "siteAdmin" where email = $1', [moderatorEmail]);
  await pool.query('delete from "user" where id = any($1::text[])', [[author, moderator, member]]);
  await pool.end();
});

it('knows only the kinds staff may delete in place', () => {
  expect(staffDeleteKind('wall-post')).toBe('wall-post');
  expect(staffDeleteKind('market-message')).toBeNull();
  expect(staffDeleteKind('store')).toBeNull();
});

it('tells the interaction data whether the viewer is staff', async () => {
  expect((await getWallInteractions([post], moderator)).get(post)?.staff).toBe(true);
  expect((await getWallInteractions([post], member)).get(post)?.staff).toBe(false);
  expect((await getWallInteractions([post], null)).get(post)?.staff).toBe(false);
});

it('lets a moderator, not a member, delete someone else’s content, and logs it', async () => {
  expect(await staffDeleteContent(member, 'wall-reply', reply)).toBe(false);
  expect((await pool.query('select 1 from "wallReply" where id = $1', [reply])).rowCount).toBe(1);
  expect(await staffDeleteContent(moderator, 'wall-reply', reply)).toBe(true);
  expect(await staffDeleteContent(moderator, 'wall-reply', reply)).toBe(false);
  expect(await staffDeleteContent(moderator, 'wall-post', post)).toBe(true);
  expect((await pool.query('select 1 from "profileComment" where id = $1', [post])).rowCount).toBe(0);
  expect((await pool.query(`select action, "targetType" from "adminAuditLog" where "adminEmail" = $1 order by "createdAt"`, [moderatorEmail])).rows)
    .toEqual([{ action: 'delete', targetType: 'wall-reply' }, { action: 'delete', targetType: 'wall-comment' }]);
});
