import { createHash, randomBytes } from 'node:crypto';
import type { AuthContext, BetterAuthPlugin } from 'better-auth';
import { APIError, createAuthEndpoint } from 'better-auth/api';
import { expireCookie, setSessionCookie } from 'better-auth/cookies';
import {
  telegramDisplayName,
  telegramLinkCode,
  telegramPlaceholderEmail,
  verifyTelegramInitData,
  type TelegramUser,
} from '@/lib/telegram-init-data';

export const TELEGRAM_PROVIDER_ID = 'telegram';
/** Same value Better Auth's `createLocalAccountIssuer('telegram')` produces. */
export const TELEGRAM_ACCOUNT_ISSUER = 'local:telegram';
export const TELEGRAM_LINK_TTL_SECONDS = 10 * 60;
export const TELEGRAM_LOGIN_TTL_SECONDS = 5 * 60;
export const TELEGRAM_LOGIN_PREFIX = 'login_';
const LOGIN_COOKIE = 'telegram_login';

export type TelegramSignInResult =
  | { status: 'signed-in'; created: boolean; linked: boolean }
  | { status: 'unlinked' };

export type TelegramLoginStartResult = { url: string; token: string };
export type TelegramLoginPollResult = { status: 'pending' | 'rejected' | 'expired' } | { status: 'signed-in'; created: boolean };

/**
 * Website sign-in through the bot. The browser keeps the token and a signed nonce cookie;
 * the bot flips the state only after the member presses «Подтвердить» in Telegram.
 */
export type TelegramLoginState =
  | { state: 'pending'; nonce: string }
  | { state: 'confirmed'; nonce: string; user: TelegramUser }
  | { state: 'rejected'; nonce: string };

export function telegramLinkIdentifier(code: string): string {
  return `telegram-link:${createHash('sha256').update(code).digest('hex')}`;
}

/** The bot refers to a login by this hash: callback data cannot hold the token itself (64-byte limit). */
export function telegramLoginHash(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

export function telegramLoginIdentifier(hash: string): string {
  return `telegram-login:${hash}`;
}

export function telegramLoginToken(startParam: string | undefined): string | null {
  if (!startParam?.startsWith(TELEGRAM_LOGIN_PREFIX)) return null;
  const token = startParam.slice(TELEGRAM_LOGIN_PREFIX.length);
  return /^[A-Za-z0-9_-]{32}$/u.test(token) ? token : null;
}

export function parseTelegramLoginState(value: string): TelegramLoginState | null {
  try {
    const parsed = JSON.parse(value) as TelegramLoginState;
    return parsed && typeof parsed.nonce === 'string' && ['pending', 'confirmed', 'rejected'].includes(parsed.state) ? parsed : null;
  } catch {
    return null;
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
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

type InternalAdapter = AuthContext['internalAdapter'];

/** Creates a CanRush account for a Telegram user; a parallel first sign-in keeps the account that won. */
async function createAccountFor(adapter: InternalAdapter, telegramUser: TelegramUser): Promise<{ userId: string; created: boolean }> {
  const accountKey = { issuer: TELEGRAM_ACCOUNT_ISSUER, accountId: telegramUser.id };
  const user = await adapter.createUser(
    { email: telegramPlaceholderEmail(telegramUser), emailVerified: false, name: telegramDisplayName(telegramUser) },
    { method: 'telegram' },
  );
  try {
    await adapter.linkAccount({ ...accountKey, providerId: TELEGRAM_PROVIDER_ID, userId: user.id });
    return { userId: user.id, created: true };
  } catch (error) {
    await adapter.deleteUser(user.id);
    if (!isUniqueViolation(error)) throw error;
    const winner = await adapter.findAccountByKey(accountKey);
    if (!winner) throw error;
    return { userId: winner.userId, created: false };
  }
}

export interface TelegramMiniAppOptions {
  botToken: string | null;
  /** Bot username for the website login deep link; without it only the Mini App sign-in works. */
  botUsername: string | null;
  trustedOrigin: string;
}

/**
 * Telegram sign-in.
 * - `/telegram/sign-in`: Mini App `initData`. A `start_param=link_<code>` from the settings page links
 *   Telegram to that account first. An unknown Telegram account is created only on explicit request
 *   (`createAccount`), so a member with an email account can link it instead of getting a duplicate.
 * - `/telegram/login/start` + `/telegram/login/poll`: the website asks the bot to confirm the sign-in.
 */
export function telegramMiniApp(options: TelegramMiniAppOptions) {
  function assertEnabled(): string {
    if (!options.botToken) throw new APIError('NOT_FOUND', { message: 'Вход через Telegram не настроен.' });
    return options.botToken;
  }

  function assertTrustedRequest(headers: Headers | undefined): void {
    const origin = originOf(headers?.get('origin'));
    const fetchSite = headers?.get('sec-fetch-site');
    if (fetchSite === 'cross-site' || (origin && origin !== options.trustedOrigin)) {
      throw new APIError('FORBIDDEN', { message: 'Недоверенный источник запроса.' });
    }
  }

  const signInTelegram = createAuthEndpoint('/telegram/sign-in', { method: 'POST', requireHeaders: true }, async (ctx) => {
    const botToken = assertEnabled();
    assertTrustedRequest(ctx.headers);
    const body = (ctx.body ?? {}) as { initData?: unknown; createAccount?: unknown };
    const data = typeof body.initData === 'string' ? verifyTelegramInitData(body.initData, botToken) : null;
    if (!data) throw new APIError('UNAUTHORIZED', { message: 'Данные Telegram не прошли проверку.' });

    const adapter = ctx.context.internalAdapter;
    const accountKey = { issuer: TELEGRAM_ACCOUNT_ISSUER, accountId: data.user.id };
    let account = await adapter.findAccountByKey(accountKey);
    let linked = false;

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

    if (!account && body.createAccount !== true) return ctx.json<TelegramSignInResult>({ status: 'unlinked' });
    const { userId, created } = account ? { userId: account.userId, created: false } : await createAccountFor(adapter, data.user);
    const user = await adapter.findUserById(userId);
    if (!user) throw new APIError('UNAUTHORIZED', { message: 'Аккаунт не найден.' });
    const session = await adapter.createSession(user.id);
    await setSessionCookie(ctx, { session, user });
    return ctx.json<TelegramSignInResult>({ status: 'signed-in', created, linked });
  });

  const startTelegramLogin = createAuthEndpoint('/telegram/login/start', { method: 'POST', requireHeaders: true }, async (ctx) => {
    assertEnabled();
    if (!options.botUsername) throw new APIError('NOT_FOUND', { message: 'Вход через Telegram не настроен.' });
    assertTrustedRequest(ctx.headers);

    const token = randomBytes(24).toString('base64url');
    const nonce = randomBytes(24).toString('base64url');
    const state: TelegramLoginState = { state: 'pending', nonce: sha256(nonce) };
    await ctx.context.internalAdapter.createVerificationValue({
      identifier: telegramLoginIdentifier(telegramLoginHash(token)),
      value: JSON.stringify(state),
      expiresAt: new Date(Date.now() + TELEGRAM_LOGIN_TTL_SECONDS * 1_000),
    });
    // Binds the login to this browser: a leaked bot link alone cannot finish it elsewhere.
    const cookie = ctx.context.createAuthCookie(LOGIN_COOKIE, { maxAge: TELEGRAM_LOGIN_TTL_SECONDS });
    await ctx.setSignedCookie(cookie.name, nonce, ctx.context.secret, cookie.attributes);
    return ctx.json<TelegramLoginStartResult>({ url: `https://t.me/${options.botUsername}?start=${TELEGRAM_LOGIN_PREFIX}${token}`, token });
  });

  const pollTelegramLogin = createAuthEndpoint('/telegram/login/poll', { method: 'POST', requireHeaders: true }, async (ctx) => {
    assertEnabled();
    assertTrustedRequest(ctx.headers);
    const token = (ctx.body as { token?: unknown } | undefined)?.token;
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{32}$/u.test(token)) throw new APIError('BAD_REQUEST', { message: 'Неверный запрос.' });

    const cookie = ctx.context.createAuthCookie(LOGIN_COOKIE);
    const nonce = await ctx.getSignedCookie(cookie.name, ctx.context.secret);
    const adapter = ctx.context.internalAdapter;
    const identifier = telegramLoginIdentifier(telegramLoginHash(token));
    const row = await adapter.findVerificationValue(identifier);
    const state = row && new Date(row.expiresAt).getTime() > Date.now() ? parseTelegramLoginState(row.value) : null;
    if (!state) return ctx.json<TelegramLoginPollResult>({ status: 'expired' });
    if (!nonce || sha256(nonce) !== state.nonce) throw new APIError('FORBIDDEN', { message: 'Вход начат в другом браузере.' });
    if (state.state === 'pending') return ctx.json<TelegramLoginPollResult>({ status: 'pending' });

    // Single use: only the poll that consumes the decided row continues.
    const consumed = await adapter.consumeVerificationValue(identifier);
    const final = consumed ? parseTelegramLoginState(consumed.value) : null;
    expireCookie(ctx, cookie);
    if (!final || final.state === 'pending') return ctx.json<TelegramLoginPollResult>({ status: 'expired' });
    if (final.state === 'rejected') return ctx.json<TelegramLoginPollResult>({ status: 'rejected' });

    const existing = await adapter.findAccountByKey({ issuer: TELEGRAM_ACCOUNT_ISSUER, accountId: final.user.id });
    const { userId, created } = existing ? { userId: existing.userId, created: false } : await createAccountFor(adapter, final.user);
    const user = await adapter.findUserById(userId);
    if (!user) throw new APIError('UNAUTHORIZED', { message: 'Аккаунт не найден.' });
    const session = await adapter.createSession(user.id);
    await setSessionCookie(ctx, { session, user });
    return ctx.json<TelegramLoginPollResult>({ status: 'signed-in', created });
  });

  return {
    id: 'telegram-mini-app',
    endpoints: { signInTelegram, startTelegramLogin, pollTelegramLogin },
  } satisfies BetterAuthPlugin;
}
