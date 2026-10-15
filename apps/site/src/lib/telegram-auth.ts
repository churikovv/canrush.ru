import { createHash } from 'node:crypto';
import type { BetterAuthPlugin } from 'better-auth';
import { APIError, createAuthEndpoint } from 'better-auth/api';
import { setSessionCookie } from 'better-auth/cookies';
import {
  telegramDisplayName,
  telegramLinkCode,
  telegramPlaceholderEmail,
  verifyTelegramInitData,
} from '@/lib/telegram-init-data';

export const TELEGRAM_PROVIDER_ID = 'telegram';
/** Same value Better Auth's `createLocalAccountIssuer('telegram')` produces. */
export const TELEGRAM_ACCOUNT_ISSUER = 'local:telegram';
export const TELEGRAM_LINK_TTL_SECONDS = 10 * 60;

export type TelegramSignInResult =
  | { status: 'signed-in'; created: boolean; linked: boolean }
  | { status: 'unlinked' };

export function telegramLinkIdentifier(code: string): string {
  return `telegram-link:${createHash('sha256').update(code).digest('hex')}`;
}

function originOf(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23505';
}

/**
 * Signs in with Telegram Mini App `initData`.
 * - A known Telegram account signs in as its user.
 * - `start_param=link_<code>` (a one-time code issued on the website) links Telegram to that user first.
 * - An unknown account is created only when the client asks for it explicitly (`createAccount`),
 *   so a member who already has an email account can link it instead of getting a duplicate.
 */
export function telegramMiniApp(options: { botToken: string | null; trustedOrigin: string }) {
  return {
    id: 'telegram-mini-app',
    endpoints: {
      signInTelegram: createAuthEndpoint('/telegram/sign-in', { method: 'POST', requireHeaders: true }, async (ctx) => {
        if (!options.botToken) throw new APIError('NOT_FOUND', { message: 'Вход через Telegram не настроен.' });

        const origin = originOf(ctx.headers?.get('origin'));
        const fetchSite = ctx.headers?.get('sec-fetch-site');
        if (fetchSite === 'cross-site' || (origin && origin !== options.trustedOrigin)) {
          throw new APIError('FORBIDDEN', { message: 'Недоверенный источник запроса.' });
        }

        const body = (ctx.body ?? {}) as { initData?: unknown; createAccount?: unknown };
        const data = typeof body.initData === 'string' ? verifyTelegramInitData(body.initData, options.botToken) : null;
        if (!data) throw new APIError('UNAUTHORIZED', { message: 'Данные Telegram не прошли проверку.' });

        const adapter = ctx.context.internalAdapter;
        const accountKey = { issuer: TELEGRAM_ACCOUNT_ISSUER, accountId: data.user.id };
        let account = await adapter.findAccountByKey(accountKey);
        let linked = false;
        let created = false;

        const code = telegramLinkCode(data.startParam);
        if (code) {
          const verification = await adapter.consumeVerificationValue(telegramLinkIdentifier(code));
          if (!verification) throw new APIError('BAD_REQUEST', { message: 'Ссылка для привязки устарела. Получите новую в настройках.' });
          const userId = verification.value;
          if (account && account.userId !== userId) {
            throw new APIError('CONFLICT', { message: 'Этот Telegram уже привязан к другому аккаунту CanRush.' });
          }
          if (!account) {
            const existing = (await adapter.findAccounts(userId)).find((item) => item.providerId === TELEGRAM_PROVIDER_ID);
            if (existing) throw new APIError('CONFLICT', { message: 'К аккаунту уже привязан другой Telegram.' });
            try {
              account = await adapter.linkAccount({ ...accountKey, providerId: TELEGRAM_PROVIDER_ID, userId });
            } catch (error) {
              if (isUniqueViolation(error)) throw new APIError('CONFLICT', { message: 'Этот Telegram уже привязан к другому аккаунту CanRush.' });
              throw error;
            }
            linked = true;
          }
        }

        if (!account) {
          if (body.createAccount !== true) return ctx.json<TelegramSignInResult>({ status: 'unlinked' });
          const user = await adapter.createUser(
            { email: telegramPlaceholderEmail(data.user), emailVerified: false, name: telegramDisplayName(data.user) },
            { method: 'telegram' },
          );
          try {
            account = await adapter.linkAccount({ ...accountKey, providerId: TELEGRAM_PROVIDER_ID, userId: user.id });
          } catch (error) {
            // Two parallel first launches: keep the account that won and drop the orphan user.
            await adapter.deleteUser(user.id);
            if (!isUniqueViolation(error)) throw error;
            account = await adapter.findAccountByKey(accountKey);
            if (!account) throw error;
          }
          created = account.userId === user.id;
        }

        const user = await adapter.findUserById(account.userId);
        if (!user) throw new APIError('UNAUTHORIZED', { message: 'Аккаунт не найден.' });
        const session = await adapter.createSession(user.id);
        await setSessionCookie(ctx, { session, user });
        return ctx.json<TelegramSignInResult>({ status: 'signed-in', created, linked });
      }),
    },
  } satisfies BetterAuthPlugin;
}
