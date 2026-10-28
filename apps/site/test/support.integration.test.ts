import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';

const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 3, allowExitOnIdle: true });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const support = await import('../src/lib/support');

const member = randomUUID(), staff = randomUUID(), stranger = randomUUID();
const staffEmail = `${staff}@example.com`;

beforeAll(async () => {
  for (const id of [member, staff, stranger]) await pool.query(
    `insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt",username) values($1,'Support test',$2,true,now(),now(),$3)`, [id, `${id}@example.com`, `sp_${id.slice(0, 12)}`]);
  await pool.query(`insert into "siteAdmin"(email, role) values ($1, 'moderator')`, [staffEmail]);
});
afterAll(async () => {
  await pool.query('delete from "siteAdmin" where email = $1', [staffEmail]);
  await pool.query('delete from "user" where id = any($1::text[])', [[member, staff, stranger]]);
  await pool.end();
});

it('keeps one thread per member, notifies on a team reply and tracks who read what', async () => {
  expect(() => support.parseSupportText('   ')).toThrow('Напишите');
  expect(support.parseSupportText(' Не грузится\r\n\r\n\r\n\r\nкаталог ')).toBe('Не грузится\n\n\nкаталог');

  await support.sendSupportMessage(member, 'Не грузится каталог');
  await expect(support.sendSupportMessage(member, 'Ещё раз')).rejects.toThrow('пару секунд');
  const thread = (await support.getOwnSupportThread(member))!;
  expect(thread).toMatchObject({ status: 'open', lastFromStaff: false });
  expect((await support.listSupportThreads('unread')).map(item => item.id)).toContain(thread.id);
  const waiting = await support.countSupportWaiting();
  expect(waiting).toBeGreaterThanOrEqual(1);

  // Only the site team answers; the reply notifies the member and leaves the thread waiting on them.
  await expect(support.replySupport(stranger, thread.id, 'Я не команда')).rejects.toThrow('Нет доступа');
  await support.replySupport(staff, thread.id, 'Обновите страницу, пожалуйста');
  expect(await support.countSupportWaiting()).toBe(waiting - 1);
  expect(await support.supportUnreadForUser(member)).toBe(true);
  const notes = (await pool.query(`select kind, payload, "readAt" from notification where "userId" = $1`, [member])).rows;
  expect(notes).toEqual([expect.objectContaining({ kind: 'support-reply', payload: { text: 'Обновите страницу, пожалуйста' }, readAt: null })]);

  const page = await support.supportMessages(thread.id);
  expect(page.items.map(item => [item.fromStaff, item.text, item.author])).toEqual([
    [false, 'Не грузится каталог', 'Support test'], [true, 'Обновите страницу, пожалуйста', 'Поддержка CanRush']]);

  // Reading the thread reads the notification too.
  await support.readOwnSupport(member);
  expect(await support.supportUnreadForUser(member)).toBe(false);
  expect((await pool.query(`select 1 from notification where "userId" = $1 and "readAt" is null`, [member])).rowCount).toBe(0);

  // Closed by the team, reopened by the member's next message.
  await support.setSupportStatus(staff, thread.id, 'closed');
  expect((await support.getSupportThread(thread.id))!.status).toBe('closed');
  await pool.query(`update "supportMessage" set "createdAt" = now() - interval '1 minute' where "threadId" = $1`, [thread.id]);
  await support.sendSupportMessage(member, 'Спасибо, заработало');
  expect((await support.getOwnSupportThread(member))).toMatchObject({ id: thread.id, status: 'open', lastFromStaff: false });
  expect((await support.listSupportThreads('all', 'заработало')).map(item => item.id)).toEqual([thread.id]);
});
