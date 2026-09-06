import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { magicLink } from 'better-auth/plugins';
import type { Pool } from 'pg';
import { getPool } from '@/db/pool';
import {
  EMAIL_RATE_LIMIT_MAX,
  EMAIL_RATE_LIMIT_WINDOW_SECONDS,
  emailRateLimitKey,
} from '@/lib/email-rate-limit';
import { sendMagicLinkEmail } from '@/lib/email';
import { getAuthEnv } from '@/lib/env';

interface RateLimitRecord {
  count: number;
  key: string;
  lastRequest: bigint | number | string;
}

export type MagicLinkSender = (email: string, token: string) => Promise<void>;

export interface CreateAuthOptions {
  database?: Pool;
  sendMagicLink?: MagicLinkSender;
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
    if (ctx.path !== '/sign-in/magic-link') return;

    const fetchSite = ctx.headers?.get('sec-fetch-site');
    const origin = requestOrigin(ctx.headers?.get('origin') ?? null);
    const referer = requestOrigin(ctx.headers?.get('referer') ?? null);
    const trustedRequest =
      fetchSite !== 'cross-site' &&
      (origin ? origin === trustedOrigin : referer ? referer === trustedOrigin : fetchSite === 'same-origin');
    if (!trustedRequest) {
      throw new APIError('FORBIDDEN', { message: 'Недоверенный источник запроса.' });
    }

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

  return betterAuth({
    appName: 'CanRush',
    baseURL: env.authUrl,
    secret: env.authSecret,
    trustedOrigins: [env.authUrl],
    database: options.database ?? getPool(),
    emailAndPassword: {
      enabled: false,
    },
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
        expiresIn: 5 * 60,
        rateLimit: {
          window: 60,
          max: 5,
        },
        storeToken: 'hashed',
        sendMagicLink: async ({ email, token }) => sendMagicLink(email, token),
      }),
    ],
  });
}

export const auth = createAuth();
