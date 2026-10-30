import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';

const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 3, allowExitOnIdle: true });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
vi.stubGlobal('fetch', () => { throw new Error('No real messages in tests'); });

const { ALERTS_PER_HOUR, MAX_CLIENT_GROUPS, listErrorGroups, pruneErrorGroups, recordError, recordServerError, setErrorHidden } = await import('../src/lib/error-log');
const { errorGroupHash } = await import('../src/lib/error-log-fields');
const { renderOutboxMessage } = await import('../src/lib/telegram-bot/outbox');

const run = randomUUID().replaceAll('-', '').slice(0, 10);
const admin = `err-admin-${run}`, moderator = `err-mod-${run}`;
const adminEmail = `${admin}@example.com`, moderatorEmail = `${moderator}@example.com`;
const adminChat = 7_000_000_000 + Number.parseInt(run.slice(0, 7), 16);
const moderatorChat = adminChat + 1;
let sequence = 0;

const report = (source: 'server' | 'client' = 'server') => {
  const message = `Boom ${run} ${String.fromCharCode(97 + sequence % 26)}${(sequence++).toString(36).replace(/\d/g, d => 'ghijklmnop'.charAt(Number(d)))}`;
  return { source, path: '/catalog/burn', scope: '/catalog/[slug]', message, stack: 'at f (a.js:1:2)' };
};
const hashOf = errorGroupHash;
const group = async (hash: string) => (await pool.query('select * from "errorGroup" where hash = $1', [hash])).rows[0];
const alerts = async (chat = adminChat) => (await pool.query<{ payload: { message: string; count: number } }>(`select payload from "telegramOutbox" where "chatId" = $1 and kind = 'error-alert' order by id`, [chat])).rows;

beforeAll(async () => {
  await pool.query('delete from "errorGroup"');
  for (const [id, email, chat] of [[admin, adminEmail, adminChat], [moderator, moderatorEmail, moderatorChat]] as const) {
    await pool.query(`insert into "user"(id,name,email,"emailVerified") values($1,'Err',$2,true)`, [id, email]);
    await pool.query(`insert into account (id, issuer, "accountId", "providerId", "userId", "createdAt", "updatedAt") values ($1, 'local:telegram', $2, 'telegram', $3, now(), now())`, [`acc-${id}`, String(chat), id]);
    await pool.query(`insert into "telegramChat" ("telegramId", "chatId") values ($1, $1)`, [chat]);
  }
  await pool.query(`insert into "siteAdmin"(email, role) values ($1, 'admin'), ($2, 'moderator')`, [adminEmail, moderatorEmail]);
});
afterEach(async () => {
  await pool.query('delete from "errorGroup"');
  await pool.query('delete from "telegramOutbox" where "chatId" = any($1::bigint[])', [[adminChat, moderatorChat]]);
});
afterAll(async () => {
  await pool.query('delete from "siteAdmin" where email = any($1::text[])', [[adminEmail, moderatorEmail]]);
  await pool.query('delete from "telegramChat" where "telegramId" = any($1::bigint[])', [[adminChat, moderatorChat]]);
  await pool.query('delete from "user" where id = any($1::text[])', [[admin, moderator]]);
  await pool.end();
});

describe.sequential('site errors', () => {
  it('stores a group, counts repeats and queues one message for an administrator', async () => {
    const error = report();
    await recordError(error, pool);
    await recordError({ ...error, path: '/catalog/gorilla' }, pool);
    await recordError(error, pool);
    expect(await group(hashOf(error))).toMatchObject({ source: 'server', message: error.message, path: '/catalog/burn', count: 3 });
    expect(await alerts()).toHaveLength(1);
    // A moderator's linked Telegram stays quiet: alerts go to administrators, like the summary.
    expect(await alerts(moderatorChat)).toHaveLength(0);
  });

  it('survives concurrent first occurrences with one message', async () => {
    const error = report();
    await Promise.all(Array.from({ length: 6 }, () => recordError(error, pool)));
    expect((await group(hashOf(error))).count).toBe(6);
    expect(await alerts()).toHaveLength(1);
  });

  it('alerts again only after an hour', async () => {
    const error = report();
    await recordError(error, pool);
    await pool.query(`update "errorGroup" set "notifiedAt" = now() - interval '59 minutes' where hash = $1`, [hashOf(error)]);
    await recordError(error, pool);
    expect(await alerts()).toHaveLength(1);
    await pool.query(`update "errorGroup" set "notifiedAt" = now() - interval '61 minutes' where hash = $1`, [hashOf(error)]);
    // The first alert of this hour is still in the outbox: move it, the dedupe key is per hour.
    await pool.query(`update "telegramOutbox" set "dedupeKey" = "dedupeKey" || ':old' where "chatId" = $1`, [adminChat]);
    await recordError(error, pool);
    const sent = await alerts();
    expect(sent).toHaveLength(2);
    expect(sent[1]?.payload.count).toBe(3);
  });

  it('renders the alert with escaped text and a link to the section', async () => {
    const error = { ...report(), message: `<script> ${run}` };
    await recordError(error, pool);
    const [row] = await alerts();
    const message = await renderOutboxMessage({ kind: 'error-alert', payload: row!.payload as never }, 'https://canrush.test');
    expect(message?.text).toContain('Новая ошибка');
    expect(message?.text).toContain('&lt;script&gt;');
    expect(JSON.stringify(message?.keyboard)).toContain('https://canrush.test/admin/errors');
  });

  it('keeps counting a hidden group without alerts and brings it back', async () => {
    const error = report();
    await recordError(error, pool);
    const hash = hashOf(error);
    await setErrorHidden(adminEmail, hash, true);
    await pool.query(`update "errorGroup" set "notifiedAt" = now() - interval '2 hours' where hash = $1`, [hash]);
    await pool.query(`delete from "telegramOutbox" where "chatId" = $1`, [adminChat]);
    await recordError(error, pool);
    expect((await group(hash)).count).toBe(2);
    expect(await alerts()).toHaveLength(0);

    expect((await listErrorGroups(false, 1)).items.map(item => item.hash)).not.toContain(hash);
    expect(await listErrorGroups(true, 1)).toMatchObject({ visible: 0, hidden: 1, hasMore: false, items: [{ hash, count: 2 }] });
    const audit = await pool.query(`select action from "adminAuditLog" where "adminEmail" = $1 and "targetId" = $2`, [adminEmail, hash]);
    expect(audit.rows).toEqual([{ action: 'error-hide' }]);

    await setErrorHidden(adminEmail, hash, false);
    expect((await listErrorGroups(false, 1)).items.map(item => item.hash)).toEqual([hash]);
    await pool.query(`delete from "adminAuditLog" where "adminEmail" = $1`, [adminEmail]);
  });

  it('caps alerts per source, so a browser cannot spend the budget of the server', async () => {
    const reports = Array.from({ length: ALERTS_PER_HOUR + 2 }, () => report('client'));
    for (const error of reports) await recordError(error, pool);
    expect(await alerts()).toHaveLength(ALERTS_PER_HOUR);
    await recordError(report('server'), pool);
    expect(await alerts()).toHaveLength(ALERTS_PER_HOUR + 1);
  });

  it('stops taking new browser groups at the cap, not repeats or the server', async () => {
    const known = report('client');
    await recordError(known, pool);
    await pool.query(`insert into "errorGroup" (hash, source, path, message) select md5(i::text), 'client', '/', 'filler' from generate_series(1, $1::int) i`, [MAX_CLIENT_GROUPS]);
    const extra = report('client');
    await recordError(extra, pool);
    expect(await group(hashOf(extra))).toBeUndefined();
    await recordError(known, pool);
    expect((await group(hashOf(known))).count).toBe(2);
    const server = report('server');
    await recordError(server, pool);
    expect(await group(hashOf(server))).toBeDefined();
  });

  it('records server errors without what a request carries and never throws', async () => {
    await recordServerError(new Error('Failed for ivan@example.com'), '/auth/confirm?token=secret', '/auth/confirm');
    const { items } = await listErrorGroups(false, 1);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ source: 'server', path: '/auth/confirm', message: 'Failed for [почта]' });
    expect(JSON.stringify(items[0])).not.toContain('secret');
    await recordServerError(Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;push;/;307;' }), '/x');
    expect((await listErrorGroups(false, 1)).items).toHaveLength(1);

    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const query = vi.spyOn(pool, 'query').mockRejectedValueOnce(new Error('down') as never);
    await expect(recordServerError(new Error('next'), '/x')).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith('Error log failed', 'down');
    query.mockRestore(); log.mockRestore();
  });

  it('deletes groups silent for 30 days', async () => {
    const old = report(), fresh = report();
    await recordError(old, pool);
    await recordError(fresh, pool);
    await pool.query(`update "errorGroup" set "lastSeenAt" = now() - interval '31 days' where hash = $1`, [hashOf(old)]);
    await pruneErrorGroups(pool);
    expect(await group(hashOf(old))).toBeUndefined();
    expect(await group(hashOf(fresh))).toBeDefined();
  });

  it('pages the list', async () => {
    for (let index = 0; index < 3; index++) await recordError(report(), pool);
    const first = await listErrorGroups(false, 1, 2);
    expect(first).toMatchObject({ visible: 3, hidden: 0, hasMore: true });
    expect(first.items).toHaveLength(2);
    expect((await listErrorGroups(false, 2, 2)).items).toHaveLength(1);
  });
});
