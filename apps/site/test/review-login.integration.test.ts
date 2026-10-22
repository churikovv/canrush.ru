import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';

const BASE_URL = 'http://localhost:3000';
const DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';

process.env.DATABASE_URL = DATABASE_URL;
process.env.BETTER_AUTH_URL = BASE_URL;
process.env.BETTER_AUTH_SECRET = 'canrush-integration-test-secret-32-bytes-minimum';

const { createAuth } = await import('../src/lib/auth.js');
const { hashReviewPassword, verifyReviewPassword, REVIEW_LOGIN_RATE_LIMIT } = await import('../src/lib/review-login.js');
const pool = new Pool({ connectionString: DATABASE_URL, max: 2, allowExitOnIdle: true });
const runId = randomUUID().replaceAll('-', '').slice(0, 12);
const EMAIL = `review-${runId}@example.test`;
const PASSWORD = `review-password-${runId}`;
const account = { email: EMAIL, passwordHash: await hashReviewPassword(PASSWORD) };
const auth = createAuth({ database: pool, sendMagicLink: async () => {}, telegramBotToken: null, reviewLogin: account });
const disabled = createAuth({ database: pool, sendMagicLink: async () => {}, telegramBotToken: null, reviewLogin: null });
let ipCounter = 0;

function signIn(body: Record<string, unknown>, options: { origin?: string; ip?: string; instance?: typeof auth } = {}): Promise<Response> {
  const origin = options.origin ?? BASE_URL;
  ipCounter += 1;
  return (options.instance ?? auth).handler(new Request(`${BASE_URL}/api/auth/review/sign-in`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin,
      'sec-fetch-site': origin === BASE_URL ? 'same-origin' : 'cross-site',
      // Better Auth limits IPv6 per /64, so every request gets its own /64 unique to this run.
      'x-forwarded-for': options.ip ?? `2001:db8:${runId.slice(0, 4)}:${ipCounter.toString(16)}::1`,
    },
    body: JSON.stringify(body),
  }));
}

async function sessionEmail(response: Response): Promise<string | undefined> {
  const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];
  if (!cookie) return undefined;
  return (await auth.api.getSession({ headers: new Headers({ cookie }) }))?.user.email;
}

afterAll(async () => {
  await pool.query('delete from "user" where "email" = $1', [EMAIL]);
  await pool.end();
});

describe('review password sign-in', () => {
  it('hashes and verifies passwords', async () => {
    expect(account.passwordHash).toMatch(/^scrypt:[A-Za-z0-9_-]{22,}:[A-Za-z0-9_-]{43}$/u);
    expect(await verifyReviewPassword(PASSWORD, account.passwordHash)).toBe(true);
    expect(await verifyReviewPassword(`${PASSWORD}x`, account.passwordHash)).toBe(false);
    expect(await verifyReviewPassword(PASSWORD, 'plain:text')).toBe(false);
  });

  it('signs the review account in and creates it on first use', async () => {
    const response = await signIn({ email: ` ${EMAIL.toUpperCase()} `, password: PASSWORD });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'signed-in' });
    expect(await sessionEmail(response)).toBe(EMAIL);

    const again = await signIn({ email: EMAIL, password: PASSWORD });
    expect(await sessionEmail(again)).toBe(EMAIL);
    const { rows } = await pool.query('select count(*)::int as count from "user" where "email" = $1', [EMAIL]);
    expect(rows[0].count).toBe(1);
  });

  it('rejects a wrong password, another email and a cross-site request', async () => {
    const wrongPassword = await signIn({ email: EMAIL, password: 'wrong-password-123' });
    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.headers.get('set-cookie')).toBeNull();

    const otherEmail = await signIn({ email: `other-${EMAIL}`, password: PASSWORD });
    expect(otherEmail.status).toBe(401);

    const crossSite = await signIn({ email: EMAIL, password: PASSWORD }, { origin: 'https://evil.example' });
    expect(crossSite.status).toBe(403);
  });

  it('is off without REVIEW_LOGIN_* settings', async () => {
    const response = await signIn({ email: EMAIL, password: PASSWORD }, { instance: disabled });
    expect(response.status).toBe(404);
  });

  it('limits attempts per IP', async () => {
    const ip = `2001:db8:${runId.slice(4, 8)}:ffff::1`;
    const statuses: number[] = [];
    for (let attempt = 0; attempt <= REVIEW_LOGIN_RATE_LIMIT.max; attempt += 1) {
      statuses.push((await signIn({ email: EMAIL, password: 'wrong-password-123' }, { ip })).status);
    }
    expect(statuses.slice(0, REVIEW_LOGIN_RATE_LIMIT.max)).toEqual(Array(REVIEW_LOGIN_RATE_LIMIT.max).fill(401));
    expect(statuses.at(-1)).toBe(429);
  });
});
