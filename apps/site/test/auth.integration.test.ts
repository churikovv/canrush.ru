import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { emailRateLimitKey } from '../src/lib/email-rate-limit.js';
import { buildMagicLinkVerificationPath } from '../src/lib/magic-link-url.js';

const BASE_URL = 'http://localhost:3000';
const TEST_SECRET = 'canrush-integration-test-secret-32-bytes-minimum';
const DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';

process.env.DATABASE_URL = DATABASE_URL;
process.env.BETTER_AUTH_URL = BASE_URL;
process.env.BETTER_AUTH_SECRET = TEST_SECRET;

const { createAuth } = await import('../src/lib/auth.js');
const pool = new Pool({ connectionString: DATABASE_URL, max: 2, allowExitOnIdle: true });
const sentLinks: Array<{ email: string; token: string }> = [];
const auth = createAuth({
  database: pool,
  sendMagicLink: async (email, token) => {
    sentLinks.push({ email, token });
  },
});
const runId = randomUUID().replaceAll('-', '');
const ipParts = [runId.slice(0, 4), runId.slice(4, 8), runId.slice(8, 12), runId.slice(12, 16)];

function testIp(index: number): string {
  return `2001:db8:${ipParts[index % ipParts.length]}:${index.toString(16)}::1`;
}

function magicLinkRequest(email: string, ip: string, origin = BASE_URL): Request {
  return new Request(`${BASE_URL}/api/auth/sign-in/magic-link`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin,
      'sec-fetch-site': origin === BASE_URL ? 'same-origin' : 'cross-site',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify({
      email,
      callbackURL: '/profile',
      newUserCallbackURL: '/profile',
      errorCallbackURL: '/auth/error',
    }),
  });
}

function verificationRequest(token: string, ip: string): Request {
  return new Request(`${BASE_URL}${buildMagicLinkVerificationPath(token)}`, {
    headers: {
      accept: 'text/html',
      'x-forwarded-for': ip,
    },
  });
}

beforeAll(async () => {
  const result = await pool.query(`select to_regclass('"verification"')::text as table_name`);
  if (!result.rows[0]?.table_name) throw new Error('Run the test database migration first');
});

afterAll(async () => {
  await pool.end();
});

describe.sequential('Magic Link authentication', () => {
  it('rejects a cross-origin first-login request', async () => {
    const email = `cross-${runId}@example.com`;
    const response = await auth.handler(magicLinkRequest(email, testIp(0), 'https://attacker.example'));

    expect(response.status).toBe(403);
    expect(sentLinks.some((entry) => entry.email === email)).toBe(false);
  });

  it('stores a hashed short-lived token, creates one session and revokes it on logout', async () => {
    const email = `flow-${runId}@example.com`;
    const requestResponse = await auth.handler(magicLinkRequest(email, testIp(1)));
    expect(requestResponse.status).toBe(200);

    const sent = sentLinks.slice().reverse().find((entry) => entry.email === email);
    expect(sent).toBeDefined();
    if (!sent) throw new Error('Magic link was not captured');

    const verification = await pool.query<{
      expiresAt: Date;
      identifier: string;
    }>(
      `select "identifier", "expiresAt" from "verification"
       where ("value"::jsonb ->> 'email') = $1
       order by "createdAt" desc limit 1`,
      [email],
    );
    const stored = verification.rows[0];
    expect(stored).toBeDefined();
    if (!stored) throw new Error('Verification token was not stored');
    expect(stored.identifier).not.toBe(sent.token);
    expect(stored.identifier).not.toContain(sent.token);
    const expiresIn = new Date(stored.expiresAt).getTime() - Date.now();
    expect(expiresIn).toBeGreaterThan(4 * 60 * 1_000);
    expect(expiresIn).toBeLessThanOrEqual(5 * 60 * 1_000);

    const verificationResponse = await auth.api.magicLinkVerify({
      query: {
        token: sent.token,
        callbackURL: '/profile',
        newUserCallbackURL: '/profile',
        errorCallbackURL: '/auth/error',
      },
      headers: new Headers({ 'x-forwarded-for': testIp(1) }),
      asResponse: true,
    });
    expect(verificationResponse.status).toBe(302);
    expect(verificationResponse.headers.get('location')).toBe(`${BASE_URL}/profile`);
    const setCookie = verificationResponse.headers.get('set-cookie');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    if (!setCookie) throw new Error('Session cookie was not set');
    const cookie = setCookie.split(';', 1)[0] ?? '';

    const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
    expect(session?.user.email).toBe(email);

    const replayResponse = await auth.handler(verificationRequest(sent.token, testIp(1)));
    expect(replayResponse.status).toBe(302);
    expect(replayResponse.headers.get('location')).toContain('/auth/error?error=INVALID_TOKEN');

    const signOutResponse = await auth.handler(
      new Request(`${BASE_URL}/api/auth/sign-out`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie,
          origin: BASE_URL,
          'sec-fetch-site': 'same-origin',
          'x-forwarded-for': testIp(1),
        },
        body: '{}',
      }),
    );
    expect(signOutResponse.status).toBe(200);
    expect(await auth.api.getSession({ headers: new Headers({ cookie }) })).toBeNull();
  });

  it('rejects an expired token', async () => {
    const email = `expired-${runId}@example.com`;
    expect((await auth.handler(magicLinkRequest(email, testIp(2)))).status).toBe(200);
    const sent = sentLinks.slice().reverse().find((entry) => entry.email === email);
    if (!sent) throw new Error('Magic link was not captured');

    await pool.query(
      `update "verification" set "expiresAt" = now() - interval '1 minute'
       where ("value"::jsonb ->> 'email') = $1`,
      [email],
    );
    const response = await auth.handler(verificationRequest(sent.token, testIp(2)));
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toContain('/auth/error?error=INVALID_TOKEN');
  });

  it('limits repeated requests for one normalized email without storing it in the limiter key', async () => {
    const email = `limit-${runId}@example.com`;
    const ip = testIp(3);

    for (let index = 0; index < 3; index += 1) {
      expect((await auth.handler(magicLinkRequest(email.toUpperCase(), ip))).status).toBe(200);
    }
    expect((await auth.handler(magicLinkRequest(` ${email} `, ip))).status).toBe(429);

    const key = emailRateLimitKey(email, TEST_SECRET);
    const result = await pool.query<{ count: number }>(
      'select "count" from "rateLimit" where "key" = $1',
      [key],
    );
    expect(result.rows[0]?.count).toBe(3);
    expect(key).not.toContain(email);
  });

  it('applies the built-in per-IP endpoint limit', async () => {
    const ip = testIp(4);
    for (let index = 0; index < 5; index += 1) {
      const email = `ip-${index}-${runId}@example.com`;
      expect((await auth.handler(magicLinkRequest(email, ip))).status).toBe(200);
    }
    const blocked = await auth.handler(magicLinkRequest(`ip-blocked-${runId}@example.com`, ip));
    expect(blocked.status).toBe(429);
  });
});
