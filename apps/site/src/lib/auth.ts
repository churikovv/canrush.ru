import { createHmac } from 'node:crypto';
import { attributeRegistration } from '@/lib/campaigns';
import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { emailOTP, magicLink } from 'better-auth/plugins';
import type { Pool } from 'pg';
import { getPool } from '@/db/pool';
import {
  EMAIL_RATE_LIMIT_MAX,
  EMAIL_RATE_LIMIT_WINDOW_SECONDS,
  emailRateLimitKey,
} from '@/lib/email-rate-limit';
import { sendMagicLinkEmail } from '@/lib/email';
import { audienceFromVerifyUrl, type SignInAudience } from '@/lib/magic-link-url';
import { getAuthEnv, getPaymentReviewEnv, getReviewLoginEnv, getTelegramEnv, type ReviewLoginEnv } from '@/lib/env';
import { reviewLogin } from '@/lib/review-login';
import { telegramMiniApp } from '@/lib/telegram-auth';

interface RateLimitRecord {
  count: number;
  key: string;
  lastRequest: bigint | number | string;
}

/** `code` — the six digits for the same sign-in, when they could be made: the letter carries both. */
export type MagicLinkSender = (email: string, token: string, audience?: SignInAudience, code?: string) => Promise<void>;

/** The sign-in code: six digits, the same 15 minutes as the link, three tries, then a new letter. */
export const SIGN_IN_CODE_LENGTH = 6;
export const SIGN_IN_CODE_ATTEMPTS = 3;
/**
 * The code plugin's own routes stay closed: a code is made only inside the magic link letter, so asking for a letter
 * keeps its origin check and its limits per address and per IP. Only signing in with the code is open.
 */
const CLOSED_CODE_PATHS = new Set(['/email-otp/send-verification-otp', '/email-otp/check-verification-otp', '/email-otp/verify-email',
  '/email-otp/request-password-reset', '/forget-password/email-otp', '/email-otp/reset-password', '/email-otp/request-email-change', '/email-otp/change-email']);

export interface CreateAuthOptions {
  database?: Pool;
  sendMagicLink?: MagicLinkSender;
  /** Overrides TELEGRAM_BOT_TOKEN; `null` disables Telegram sign-in. */
  telegramBotToken?: string | null;
  /** Overrides the bot username from TELEGRAM_MINI_APP_URL; `null` disables website sign-in via the bot. */
  telegramBotUsername?: string | null;
  /** Overrides REVIEW_LOGIN_EMAIL/REVIEW_LOGIN_PASSWORD_HASH; `null` disables the store-review password sign-in. */
  reviewLogin?: ReviewLoginEnv | null;
  /** Overrides PAYMENT_REVIEW_EMAIL/PAYMENT_REVIEW_PASSWORD_HASH; `null` disables the payment reviewer's account. */
  paymentReview?: ReviewLoginEnv | null;
}

function requestOrigin(value: string | null): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

function createEmailRateLimitHook(secret: string, trustedOrigin: string) {
  return createAuthMiddleware(async (ctx) => {
    if (CLOSED_CODE_PATHS.has(ctx.path)) throw new APIError('NOT_FOUND');
    if (ctx.path !== '/sign-in/magic-link' && ctx.path !== '/sign-in/email-otp') return;

    const fetchSite = ctx.headers?.get('sec-fetch-site');
    const origin = requestOrigin(ctx.headers?.get('origin') ?? null);
    const referer = requestOrigin(ctx.headers?.get('referer') ?? null);
    const trustedRequest =
      fetchSite !== 'cross-site' &&
      (origin ? origin === trustedOrigin : referer ? referer === trustedOrigin : fetchSite === 'same-origin');
    if (!trustedRequest) {
      throw new APIError('FORBIDDEN', { message: 'Недоверенный источник запроса.' });
    }
    // The code itself is limited by its three tries and the plugin's per-IP limit; the letter limits below are for asking.
    if (ctx.path === '/sign-in/email-otp') return;

    const body = ctx.body as { email?: unknown } | undefined;
    if (typeof body?.email !== 'string') return;

    const adapter = ctx.context.adapter;
    const key = emailRateLimitKey(body.email, secret);
    const now = Date.now();
    const windowMilliseconds = EMAIL_RATE_LIMIT_WINDOW_SECONDS * 1_000;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const records = await adapter.findMany<RateLimitRecord>({
        model: 'rateLimit',
        where: [{ field: 'key', value: key }],
        limit: 1,
      });
      const record = records[0];

      if (!record) {
        try {
          await adapter.create({
            model: 'rateLimit',
            data: { key, count: 1, lastRequest: now },
          });
          return;
        } catch {
          continue;
        }
      }

      const lastRequest = Number(record.lastRequest);
      if (!Number.isFinite(lastRequest)) throw new APIError('INTERNAL_SERVER_ERROR');

      if (now - lastRequest >= windowMilliseconds) {
        const reset = await adapter.incrementOne<RateLimitRecord>({
          model: 'rateLimit',
          where: [
            { field: 'key', value: key },
            { field: 'lastRequest', operator: 'lte', value: lastRequest },
          ],
          increment: {},
          set: { count: 1, lastRequest: now },
        });
        if (reset) return;
        continue;
      }

      if (record.count >= EMAIL_RATE_LIMIT_MAX) {
        throw new APIError('TOO_MANY_REQUESTS', {
          message: 'Слишком много запросов. Попробуйте позже.',
        });
      }

      const incremented = await adapter.incrementOne<RateLimitRecord>({
        model: 'rateLimit',
        where: [
          { field: 'key', value: key },
          { field: 'lastRequest', operator: 'gt', value: now - windowMilliseconds },
          { field: 'count', operator: 'lt', value: EMAIL_RATE_LIMIT_MAX },
        ],
        increment: { count: 1 },
        set: { lastRequest: now },
      });
      if (incremented) return;
    }

    throw new APIError('TOO_MANY_REQUESTS', {
      message: 'Слишком много запросов. Попробуйте позже.',
    });
  });
}

export function createAuth(options: CreateAuthOptions = {}) {
  const env = getAuthEnv();
  const sendMagicLink = options.sendMagicLink ?? sendMagicLinkEmail;
  const telegramBotToken = options.telegramBotToken !== undefined ? options.telegramBotToken : (getTelegramEnv()?.botToken ?? null);
  // Set once the instance exists: the magic link letter asks the code plugin for a code to put next to the link.
  let issueSignInCode: ((email: string) => Promise<string>) | null = null;

  const instance = betterAuth({
    appName: 'CanRush',
    baseURL: env.authUrl,
    secret: env.authSecret,
    trustedOrigins: [env.authUrl],
    database: options.database ?? getPool(),
    emailAndPassword: {
      enabled: false,
    },
    databaseHooks: { user: { create: { after: async (user, context) => {
      // Analytics must never prevent account creation. Existing-user sign-ins do not call this hook.
      try { await attributeRegistration(user.id, user.createdAt, context?.headers?.get('cookie') ?? null, options.database ?? getPool()); } catch { console.warn('Campaign registration attribution unavailable'); }
    } } } },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: EMAIL_RATE_LIMIT_WINDOW_SECONDS,
      max: 100,
    },
    advanced: {
      useSecureCookies: new URL(env.authUrl).protocol === 'https:',
    },
    hooks: {
      before: createEmailRateLimitHook(env.authSecret, env.authUrl),
    },
    plugins: [
      magicLink({
        disableSignUp: false,
        expiresIn: 15 * 60,
        rateLimit: {
          window: 60,
          max: 5,
        },
        storeToken: 'hashed',
        sendMagicLink: async ({ email, token, url }) => {
          // A link opened in a mail app's own browser signs in there, not where the member asked; the code works anywhere.
          // No code is no reason to hold the letter back: the link alone still signs in.
          const code = await issueSignInCode?.(email).catch(() => undefined);
          await sendMagicLink(email, token, audienceFromVerifyUrl(url), code);
        },
      }),
      emailOTP({
        otpLength: SIGN_IN_CODE_LENGTH,
        expiresIn: 15 * 60,
        allowedAttempts: SIGN_IN_CODE_ATTEMPTS,
        disableSignUp: false,
        // A keyed hash, not plain SHA-256: six digits are a million guesses, and a copy of the database leaves the server.
        storeOTP: { hash: async (otp) => createHmac('sha256', env.authSecret).update(`sign-in-code:${otp}`).digest('base64url') },
        rateLimit: { window: 60, max: 5 },
        // Never called: the routes that send a code on their own are closed (`CLOSED_CODE_PATHS`).
        sendVerificationOTP: async () => { throw new APIError('NOT_FOUND'); },
      }),
      telegramMiniApp({ botToken: telegramBotToken, botUsername: options.telegramBotUsername !== undefined ? options.telegramBotUsername : (getTelegramEnv()?.botUsername ?? null), trustedOrigin: env.authUrl }),
      reviewLogin({
        account: options.reviewLogin !== undefined ? options.reviewLogin : getReviewLoginEnv(),
        payment: options.paymentReview !== undefined ? options.paymentReview : getPaymentReviewEnv(),
        trustedOrigin: env.authUrl,
      }),
    ],
  });
  issueSignInCode = (email) => instance.api.createVerificationOTP({ body: { email, type: 'sign-in' } });
  return instance;
}

export const auth = createAuth();
