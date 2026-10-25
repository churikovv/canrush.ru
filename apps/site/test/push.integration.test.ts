import { generateKeyPairSync, randomUUID, verify } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';

const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Only test database allowed');
const pool = new Pool({ connectionString: url, max: 3 });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const { deliverPush, enqueuePush, registerPushDevice, unregisterPushDevice } = await import('../src/lib/push/outbox');

const run = randomUUID().replaceAll('-', '');
const [member, actor, other] = [randomUUID(), randomUUID(), randomUUID()];
const token = `fcm-token-${run}`;
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const apnsKey = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const apns = { keyId: 'KEY1234567', teamId: 'TEAM123456', privateKey: apnsKey.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(), topic: 'ru.canrush.app', sandbox: false };
const env = { fcm: { projectId: 'canrush-test', clientEmail: 'push@canrush-test.iam.gserviceaccount.com', privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() }, rustore: null, apns };
const sent: { url: string; body: unknown }[] = [];
let sendStatus = 200;
vi.stubGlobal('fetch', async (input: string, init: RequestInit) => {
  if (input === 'https://oauth2.googleapis.com/token') return Response.json({ access_token: 'access', expires_in: 3600 });
  sent.push({ url: input, body: JSON.parse(String(init.body)) });
  return sendStatus === 200 ? Response.json({ name: 'ok' }) : new Response('{"error":{"status":"NOT_FOUND","details":[{"errorCode":"UNREGISTERED"}]}}', { status: sendStatus });
});

beforeAll(async () => {
  for (const [id, name] of [[member, 'Получатель'], [actor, 'Автор'], [other, 'Другой']] as const) {
    await pool.query('insert into "user" (id,name,email,username,"emailVerified","createdAt","updatedAt") values ($1,$2,$3,$4,true,now(),now())', [id, name, `${id}@example.com`, `u${id.slice(0, 8)}`]);
  }
});
afterAll(async () => {
  await pool.query('delete from "user" where id = any($1::text[])', [[member, actor, other]]);
  await pool.end();
});

it('queues site notifications for the member devices and sends them through FCM', async () => {
  await registerPushDevice(pool, member, token, 'fcm');
  await pool.query(`insert into notification ("userId","actorId",kind,"eventKey") values ($1,$2,'follow',$3)`, [member, actor, `follow:${run}`]);
  const queued = await pool.query('select kind from "pushOutbox" where token=$1 and "sentAt" is null', [token]);
  expect(queued.rows).toEqual([{ kind: 'notification' }]);

  sent.length = 0;
  await deliverPush(pool, env, 'https://canrush.ru');
  const mine = sent.filter(item => JSON.stringify(item.body).includes(token));
  expect(mine).toHaveLength(1);
  expect(mine[0]!.url).toBe('https://fcm.googleapis.com/v1/projects/canrush-test/messages:send');
  expect(mine[0]!.body).toMatchObject({ message: { token, data: { url: expect.stringMatching(/^\//u) }, notification: { title: expect.any(String) } } });
  expect((await pool.query('select "sentAt" is not null as sent from "pushOutbox" where token=$1', [token])).rows).toEqual([{ sent: true }]);
});

it('moves a token to the member who signed in on the device, and unregisters only for its owner', async () => {
  await registerPushDevice(pool, other, token, 'fcm');
  expect((await pool.query('select "userId" from "pushDevice" where token=$1', [token])).rows).toEqual([{ userId: other }]);
  await unregisterPushDevice(pool, member, token);
  expect((await pool.query('select 1 from "pushDevice" where token=$1', [token])).rowCount).toBe(1);
  await registerPushDevice(pool, member, token, 'fcm');
});

it('sends market events and drops a device whose token FCM no longer knows', async () => {
  await enqueuePush(pool, member, 'market', { event: 'message', orderId: randomUUID(), title: 'Банка', counterpart: 'Автор', message: 'Привет' }, `market:test:${run}`);
  sendStatus = 404;
  sent.length = 0;
  await deliverPush(pool, env, 'https://canrush.ru');
  const body = sent.find(item => JSON.stringify(item.body).includes(token))?.body as { message: { notification: { title: string; body: string } } };
  expect(body.message.notification).toEqual({ title: 'Новое сообщение от Автор', body: '«Банка»: Привет' });
  expect((await pool.query('select 1 from "pushDevice" where token=$1', [token])).rowCount).toBe(0);
  expect((await pool.query('select 1 from "pushOutbox" where token=$1', [token])).rowCount).toBe(0);
  sendStatus = 200;
});

it('sends RuStore taps as a deep link to the site page', async () => {
  const { messageBody } = await import('../src/lib/push/providers');
  const body = messageBody('token', { title: 'Заголовок', body: 'Текст', url: '/profile/a', link: 'https://canrush.ru/profile/a' }, 'rustore');
  expect(body.message.android).toEqual({ notification: expect.objectContaining({ title: 'Заголовок', body: 'Текст', click_action: 'https://canrush.ru/profile/a', click_action_type: 1, channel_id: 'canrush' }) });
  expect(messageBody('token', { title: 't', body: 'b', url: '/x', link: 'https://canrush.ru/x' }).message.android).not.toHaveProperty('notification.click_action');
});

it('sends iOS pushes through APNs over HTTP/2 with a signed provider token, and drops an uninstalled app', async () => {
  const iosToken = `apns${run}`;
  await registerPushDevice(pool, member, iosToken, 'apns');
  await pool.query(`insert into notification ("userId","actorId",kind,"eventKey") values ($1,$2,'follow',$3)`, [member, actor, `follow-ios:${run}`]);
  const requests: { origin: string; path: string; headers: Record<string, string>; body: string }[] = [];
  let status = 200;
  const post = async (origin: string, path: string, headers: Record<string, string>, body: string) => {
    requests.push({ origin, path, headers, body });
    return { status, body: status === 200 ? '' : '{"reason":"Unregistered"}' };
  };
  await deliverPush(pool, env, 'https://canrush.ru', 50, post);
  const request = requests.find(item => item.path === `/3/device/${iosToken}`)!;
  expect(request).toMatchObject({ origin: 'https://api.push.apple.com', headers: { 'apns-topic': 'ru.canrush.app', 'apns-push-type': 'alert' } });
  expect(JSON.parse(request.body)).toMatchObject({ aps: { alert: { title: expect.any(String) }, sound: 'default' }, url: expect.stringMatching(/^\//u) });
  // The provider token is an ES256 JWT that Apple can check with the key's public half.
  const [header, claims, signature] = request.headers.authorization!.replace('bearer ', '').split('.') as [string, string, string];
  expect(JSON.parse(Buffer.from(header, 'base64url').toString())).toEqual({ alg: 'ES256', kid: 'KEY1234567' });
  expect(JSON.parse(Buffer.from(claims, 'base64url').toString())).toMatchObject({ iss: 'TEAM123456' });
  expect(verify('sha256', Buffer.from(`${header}.${claims}`), { key: apnsKey.publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url'))).toBe(true);

  await enqueuePush(pool, member, 'market', { event: 'message', orderId: randomUUID(), title: 'Банка', counterpart: 'Автор', message: 'Привет' }, `market:ios:${run}`);
  status = 410;
  await deliverPush(pool, env, 'https://canrush.ru', 50, post);
  expect((await pool.query('select 1 from "pushDevice" where token=$1', [iosToken])).rowCount).toBe(0);
});
