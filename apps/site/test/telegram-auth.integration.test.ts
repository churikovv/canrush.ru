import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';

const BASE_URL = 'http://localhost:3000';
const DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
const BOT_TOKEN = '123456:canrush-telegram-integration-test-token';

process.env.DATABASE_URL = DATABASE_URL;
process.env.BETTER_AUTH_URL = BASE_URL;
process.env.BETTER_AUTH_SECRET = 'canrush-integration-test-secret-32-bytes-minimum';

const { createAuth } = await import('../src/lib/auth.js');
const { telegramLinkIdentifier } = await import('../src/lib/telegram-auth.js');
const pool = new Pool({ connectionString: DATABASE_URL, max: 2, allowExitOnIdle: true });
const auth = createAuth({ database: pool, sendMagicLink: async () => {}, telegramBotToken: BOT_TOKEN, telegramBotUsername: 'canrush_test_bot' });
const { decideLogin } = await import('../src/lib/telegram-bot/login.js');
vi.stubGlobal('fetch', async () => Response.json({ ok: true, result: {} }));
const runId = randomUUID().replaceAll('-', '').slice(0, 12);
// Unique Telegram ids per run so parallel or repeated runs never collide.
const baseId = 9_000_000_000 + Number.parseInt(runId.slice(0, 8), 16) % 1_000_000_000;
let ipCounter = 0;

function initData(telegramId: number, startParam?: string): string {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1_000)),
    user: JSON.stringify({ id: telegramId, first_name: 'Тест', username: `t${runId}` }),
    ...(startParam ? { start_param: startParam } : {}),
  });
  const dataCheckString = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  params.set('hash', createHmac('sha256', secret).update(dataCheckString).digest('hex'));
  return params.toString();
}

function signIn(body: Record<string, unknown>, origin = BASE_URL): Promise<Response> {
  ipCounter += 1;
  return auth.handler(new Request(`${BASE_URL}/api/auth/telegram/sign-in`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin,
      'sec-fetch-site': origin === BASE_URL ? 'same-origin' : 'cross-site',
      'x-forwarded-for': `2001:db8:7e1e:${ipCounter.toString(16)}::${runId.slice(0, 4)}`,
    },
    body: JSON.stringify(body),
  }));
}

async function sessionEmail(response: Response): Promise<string | undefined> {
  const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];
  if (!cookie) return undefined;
  return (await auth.api.getSession({ headers: new Headers({ cookie }) }))?.user.email;
}

const createdEmails: string[] = [];

afterAll(async () => {
  await pool.query('delete from "user" where "email" = any($1::text[])', [[...createdEmails, `t${runId}@${baseId}.telegram.invalid`]]);
  await pool.end();
});

describe.sequential('Telegram Mini App sign-in', () => {
  it('rejects forged data and cross-site requests', async () => {
    const forged = initData(baseId).replace(/hash=[a-f0-9]+/u, `hash=${'0'.repeat(64)}`);
    expect((await signIn({ initData: forged, createAccount: true })).status).toBe(401);
    expect((await signIn({ initData: initData(baseId), createAccount: true }, 'https://attacker.example')).status).toBe(403);
  });

  it('creates an account only on request and signs it in again later', async () => {
    const unlinked = await signIn({ initData: initData(baseId) });
    expect(await unlinked.json()).toEqual({ status: 'unlinked' });
    expect(unlinked.headers.get('set-cookie')).toBeNull();

    const created = await signIn({ initData: initData(baseId), createAccount: true });
    expect(await created.clone().json()).toEqual({ status: 'signed-in', created: true, linked: false });
    expect(await sessionEmail(created)).toBe(`t${runId}@${baseId}.telegram.invalid`);

    const again = await signIn({ initData: initData(baseId), createAccount: true });
    expect(await again.clone().json()).toEqual({ status: 'signed-in', created: false, linked: false });
    expect(await sessionEmail(again)).toBe(`t${runId}@${baseId}.telegram.invalid`);
  });

  it('links Telegram to an existing account with a one-time code', async () => {
    const email = `telegram-link-${runId}@example.com`;
    createdEmails.push(email);
    const context = await auth.$context;
    const user = await context.internalAdapter.createUser({ email, emailVerified: true, name: 'Link' }, { method: 'magic-link' });
    const code = randomBytes(24).toString('base64url');
    await context.internalAdapter.createVerificationValue({
      identifier: telegramLinkIdentifier(code),
      value: user.id,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const linked = await signIn({ initData: initData(baseId + 1, `link_${code}`) });
    expect(await linked.clone().json()).toEqual({ status: 'signed-in', created: false, linked: true });
    expect(await sessionEmail(linked)).toBe(email);

    expect((await signIn({ initData: initData(baseId + 2, `link_${code}`) })).status).toBe(400);
    expect(await sessionEmail(await signIn({ initData: initData(baseId + 1) }))).toBe(email);

    const secondCode = randomBytes(24).toString('base64url');
    await context.internalAdapter.createVerificationValue({
      identifier: telegramLinkIdentifier(secondCode),
      value: user.id,
      expiresAt: new Date(Date.now() + 60_000),
    });
    // Telegram already used by another CanRush account.
    expect((await signIn({ initData: initData(baseId, `link_${secondCode}`) })).status).toBe(409);
  });
});

describe.sequential('Telegram website sign-in through the bot', () => {
  function authRequest(path: string, body: unknown, cookie?: string): Promise<Response> {
    ipCounter += 1;
    return auth.handler(new Request(`${BASE_URL}/api/auth${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: BASE_URL,
        'sec-fetch-site': 'same-origin',
        'x-forwarded-for': `2001:db8:7e1f:${ipCounter.toString(16)}::${runId.slice(0, 4)}`,
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    }));
  }

  async function start() {
    const response = await authRequest('/telegram/login/start', {});
    expect(response.status).toBe(200);
    const data = (await response.json()) as { url: string; token: string };
    const cookie = response.headers.getSetCookie().map(value => value.split(';', 1)[0]).join('; ');
    const hash = (await import('../src/lib/telegram-auth.js')).telegramLoginHash(data.token);
    return { ...data, cookie, hash };
  }

  it('signs the browser in after the member confirms in Telegram, once', async () => {
    const login = await start();
    expect(login.url).toBe(`https://t.me/canrush_test_bot?start=login_${login.token}`);
    expect(login.cookie).toContain('telegram_login');

    expect(await (await authRequest('/telegram/login/poll', { token: login.token }, login.cookie)).json()).toEqual({ status: 'pending' });
    expect((await authRequest('/telegram/login/poll', { token: login.token })).status).toBe(403);

    const telegramId = baseId + 5;
    await decideLogin(pool, '1:test', { id: telegramId, first_name: 'Бот', username: `w${runId}` }, `lg:y:${login.hash}`, telegramId, 1);
    const signedIn = await authRequest('/telegram/login/poll', { token: login.token }, login.cookie);
    expect(await signedIn.clone().json()).toEqual({ status: 'signed-in', created: true });
    const session = signedIn.headers.getSetCookie().map(value => value.split(';', 1)[0]).find(value => value?.includes('session_token'));
    expect((await auth.api.getSession({ headers: new Headers({ cookie: session ?? '' }) }))?.user.email).toBe(`w${runId}@${telegramId}.telegram.invalid`);
    createdEmails.push(`w${runId}@${telegramId}.telegram.invalid`);

    expect(await (await authRequest('/telegram/login/poll', { token: login.token }, login.cookie)).json()).toEqual({ status: 'expired' });
  });

  it('reports a rejected sign-in without creating a session', async () => {
    const login = await start();
    await decideLogin(pool, '1:test', { id: baseId + 6, first_name: 'Нет' }, `lg:n:${login.hash}`, baseId + 6, 1);
    const response = await authRequest('/telegram/login/poll', { token: login.token }, login.cookie);
    expect(await response.clone().json()).toEqual({ status: 'rejected' });
    expect(response.headers.getSetCookie().some(value => value.includes('session_token='))).toBe(false);
  });
});
