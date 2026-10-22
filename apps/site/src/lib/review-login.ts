import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { BetterAuthPlugin } from 'better-auth';
import { APIError, createAuthEndpoint } from 'better-auth/api';
import { setSessionCookie } from 'better-auth/cookies';
import type { ReviewLoginEnv } from '@/lib/env';

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;
const KEY_LENGTH = 32;
/** Store reviewers retry by hand; anything faster is guessing. Counted per IP by Better Auth's limiter. */
export const REVIEW_LOGIN_RATE_LIMIT = { window: 15 * 60, max: 5 };
const REVIEW_ACCOUNT_NAME = 'Проверка приложения';

export type ReviewSignInResult = { status: 'signed-in' };

/** Same format `scripts/review-password.mjs` prints: `scrypt:<salt>:<key>`, base64url. */
export async function hashReviewPassword(password: string, salt = randomBytes(16)): Promise<string> {
  const key = await scryptAsync(password, salt, KEY_LENGTH);
  return `scrypt:${salt.toString('base64url')}:${key.toString('base64url')}`;
}

export async function verifyReviewPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, key] = stored.split(':');
  if (scheme !== 'scrypt' || !salt || !key) return false;
  const expected = Buffer.from(key, 'base64url');
  const actual = await scryptAsync(password, Buffer.from(salt, 'base64url'), expected.length);
  return expected.length === KEY_LENGTH && timingSafeEqual(actual, expected);
}

function sameEmail(a: string, b: string): boolean {
  // Hash both sides so the comparison takes the same time whatever the input length.
  const digest = (value: string) => createHash('sha256').update(value.trim().toLowerCase()).digest();
  return timingSafeEqual(digest(a), digest(b));
}

function originOf(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

export interface ReviewLoginOptions {
  account: ReviewLoginEnv | null;
  trustedOrigin: string;
}

/**
 * `/review/sign-in`: email + password for the one account named in REVIEW_LOGIN_EMAIL.
 * Every other member keeps magic links and Telegram; email/password stays disabled in Better Auth.
 */
export function reviewLogin(options: ReviewLoginOptions) {
  const signInReview = createAuthEndpoint('/review/sign-in', { method: 'POST', requireHeaders: true }, async (ctx) => {
    const account = options.account;
    if (!account) throw new APIError('NOT_FOUND', { message: 'Вход по паролю не настроен.' });

    const origin = originOf(ctx.headers?.get('origin'));
    if (ctx.headers?.get('sec-fetch-site') === 'cross-site' || (origin && origin !== options.trustedOrigin)) {
      throw new APIError('FORBIDDEN', { message: 'Недоверенный источник запроса.' });
    }

    const body = ctx.body as { email?: unknown; password?: unknown } | undefined;
    const email = typeof body?.email === 'string' ? body.email : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!email || !password || password.length > 256) throw new APIError('BAD_REQUEST', { message: 'Введите почту и пароль.' });

    // Always run scrypt so a wrong email and a wrong password take the same time.
    const passwordOk = await verifyReviewPassword(password, account.passwordHash);
    if (!sameEmail(email, account.email) || !passwordOk) {
      throw new APIError('UNAUTHORIZED', { message: 'Неверная почта или пароль.' });
    }

    const adapter = ctx.context.internalAdapter;
    const existing = await adapter.findUserByEmail(account.email);
    const user = existing?.user
      ?? await adapter.createUser({ email: account.email, emailVerified: true, name: REVIEW_ACCOUNT_NAME }, { method: 'review-password' });
    const session = await adapter.createSession(user.id);
    await setSessionCookie(ctx, { session, user });
    return ctx.json<ReviewSignInResult>({ status: 'signed-in' });
  });

  return {
    id: 'review-login',
    endpoints: { signInReview },
    rateLimit: [{ pathMatcher: (path: string) => path === '/review/sign-in', ...REVIEW_LOGIN_RATE_LIMIT }],
  } satisfies BetterAuthPlugin;
}
