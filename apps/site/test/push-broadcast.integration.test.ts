import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { Pool } from 'pg';

const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Only test database allowed');
const pool = new Pool({ connectionString: url, max: 3 });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const { deliverPush, registerPushDevice } = await import('../src/lib/push/outbox');
const { getBroadcastReach, listBroadcasts, sendBroadcast, sendTestBroadcast } = await import('../src/lib/push-broadcast');

const run = randomUUID().replaceAll('-', '');
const [android, iphone, optedOut, banned, admin] = [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const members = [android, iphone, optedOut, banned, admin];
const token = (id: string) => `token-${id}-${run}`;
const input = { title: 'Новый сезон', body: 'Открылся Банкомат', path: '/gacha', audience: 'all' as const };
const adminEmail = `${admin}@example.com`;
const sent: unknown[] = [];
vi.stubGlobal('fetch', async (target: string, init: RequestInit) => {
  if (target === 'https://oauth2.googleapis.com/token') return Response.json({ access_token: 'access', expires_in: 3600 });
  sent.push(JSON.parse(String(init.body)));
  return Response.json({ name: 'ok' });
});
const { generateKeyPairSync } = await import('node:crypto');
const privateKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const env = { fcm: { projectId: 'canrush-test', clientEmail: 'push@canrush-test.iam.gserviceaccount.com', privateKey }, rustore: null, apns: null };

beforeAll(async () => {
  for (const id of members) await pool.query('insert into "user" (id,name,email,username,"emailVerified","createdAt","updatedAt") values ($1,$2,$3,$4,true,now(),now())', [id, 'Участник', `${id}@example.com`, `u${id.slice(0, 8)}`]);
  await registerPushDevice(pool, android, token(android), 'fcm');
  await registerPushDevice(pool, iphone, token(iphone), 'apns');
  await registerPushDevice(pool, optedOut, token(optedOut), 'fcm');
  await registerPushDevice(pool, banned, token(banned), 'fcm');
  await pool.query('update "user" set "pushAnnouncements" = false where id = $1', [optedOut]);
  await pool.query('insert into "userBlock" ("userId") values ($1)', [banned]);
});
beforeEach(async () => {
  // Other runs of the suite must not trip the pause or fill the delivery queue.
  await pool.query(`delete from "pushBroadcast" where "adminEmail" = $1`, [adminEmail]);
  await pool.query(`delete from "adminAuditLog" where "adminEmail" = $1`, [adminEmail]);
  await pool.query(`delete from "pushOutbox" where token = any($1::text[])`, [members.map(token)]);
  sent.length = 0;
});
afterAll(async () => {
  await pool.query(`delete from "pushBroadcast" where "adminEmail" = $1`, [adminEmail]);
  await pool.query(`delete from "adminAuditLog" where "adminEmail" = $1`, [adminEmail]);
  await pool.query('delete from "user" where id = any($1::text[])', [members]);
  await pool.end();
});

const queuedTokens = async () => (await pool.query<{ token: string }>(`select token from "pushOutbox" where kind = 'broadcast' and token = any($1::text[]) order by token`, [members.map(token)])).rows.map(row => row.token);

it('queues every reachable device, skipping opt-outs and banned members, and audits the send', async () => {
  const before = await getBroadcastReach();
  expect(await sendBroadcast({ ...input, audience: 'android' }, adminEmail)).toBeGreaterThanOrEqual(1);
  expect(await queuedTokens()).toEqual([token(android)]);
  expect(before.all).toBeGreaterThanOrEqual(2);
  const audit = await pool.query(`select "targetType" from "adminAuditLog" where "adminEmail" = $1 and action = 'push-broadcast'`, [adminEmail]);
  expect(audit.rows).toEqual([{ targetType: 'push' }]);
});

it('keeps a pause between mass broadcasts, but not for tests', async () => {
  await sendBroadcast({ ...input, audience: 'ios' }, adminEmail);
  await expect(sendBroadcast({ ...input, audience: 'ios' }, adminEmail)).rejects.toThrow('минут');
  await registerPushDevice(pool, admin, token(admin), 'fcm');
  expect(await sendTestBroadcast(input, { userId: admin, email: adminEmail })).toBe(1);
  await pool.query('delete from "pushDevice" where token = $1', [token(admin)]);
});

it('a test needs a device of the admin and rolls back without one', async () => {
  await expect(sendTestBroadcast(input, { userId: admin, email: adminEmail })).rejects.toThrow('нет устройства');
  expect((await listBroadcasts()).filter(row => row.adminEmail === adminEmail)).toEqual([]);
});

it('delivers the text and link and counts the delivery in the history', async () => {
  await registerPushDevice(pool, admin, token(admin), 'fcm');
  await sendTestBroadcast(input, { userId: admin, email: adminEmail });
  await pool.query(`update "pushOutbox" set "sendAfter" = now() + interval '1 hour' where "sentAt" is null and token <> $1`, [token(admin)]);
  await deliverPush(pool, env, 'https://canrush.ru', 10);
  expect(JSON.stringify(sent[0])).toContain('Новый сезон');
  expect(JSON.stringify(sent[0])).toContain('/gacha');
  const [row] = (await listBroadcasts()).filter(item => item.adminEmail === adminEmail);
  expect(row).toMatchObject({ audience: 'self', recipients: 1, delivered: 1, pending: 0 });
  await pool.query('delete from "pushDevice" where token = $1', [token(admin)]);
});
