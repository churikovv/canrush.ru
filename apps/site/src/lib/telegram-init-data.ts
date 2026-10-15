import { createHmac, timingSafeEqual } from 'node:crypto';

export const TELEGRAM_INIT_DATA_MAX_AGE_SECONDS = 24 * 60 * 60;
export const TELEGRAM_LINK_PREFIX = 'link_';
const TELEGRAM_EMAIL_DOMAIN = 'telegram.invalid';

export interface TelegramUser {
  id: string;
  firstName: string;
  lastName?: string;
  username?: string;
}

export interface TelegramInitData {
  user: TelegramUser;
  authDate: number;
  startParam?: string;
}

/**
 * Validates Mini App launch data as described in the Telegram docs:
 * HMAC-SHA256 of the sorted `key=value` lines, keyed by HMAC("WebAppData", botToken).
 * Returns null for any tampered, expired or malformed payload.
 */
export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  now = Date.now(),
  maxAgeSeconds = TELEGRAM_INIT_DATA_MAX_AGE_SECONDS,
): TelegramInitData | null {
  if (!initData || initData.length > 4096) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash || !/^[a-f0-9]{64}$/u.test(hash)) return null;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(dataCheckString).digest();
  if (!timingSafeEqual(expected, Buffer.from(hash, 'hex'))) return null;

  const authDate = Number(params.get('auth_date'));
  const ageSeconds = now / 1_000 - authDate;
  if (!Number.isInteger(authDate) || ageSeconds > maxAgeSeconds || ageSeconds < -60) return null;

  const user = parseUser(params.get('user'));
  if (!user) return null;
  const startParam = params.get('start_param') ?? undefined;
  return { user, authDate, ...(startParam ? { startParam } : {}) };
}

function parseUser(value: string | null): TelegramUser | null {
  if (!value) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(value);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const { id, first_name: firstName, last_name: lastName, username } = raw as Record<string, unknown>;
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) return null;
  if (typeof firstName !== 'string') return null;
  return {
    id: String(id),
    firstName,
    ...(typeof lastName === 'string' && lastName ? { lastName } : {}),
    ...(typeof username === 'string' && /^[A-Za-z0-9_]{3,32}$/u.test(username) ? { username } : {}),
  };
}

export function telegramDisplayName(user: TelegramUser): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return (name || (user.username ? `@${user.username}` : 'Пользователь Telegram')).slice(0, 60);
}

/**
 * Telegram accounts have no email, but `user.email` is required and unique.
 * The reserved `.invalid` TLD never delivers mail; the Telegram id in the domain keeps it unique,
 * and the local part seeds the default profile username.
 */
export function telegramPlaceholderEmail(user: TelegramUser): string {
  const local = user.username?.toLocaleLowerCase('en-US') ?? 'user';
  return `${local}@${user.id}.${TELEGRAM_EMAIL_DOMAIN}`;
}

export function isTelegramPlaceholderEmail(email: string): boolean {
  return email.toLocaleLowerCase('en-US').endsWith(`.${TELEGRAM_EMAIL_DOMAIN}`);
}

export function telegramLinkCode(startParam: string | undefined): string | null {
  if (!startParam?.startsWith(TELEGRAM_LINK_PREFIX)) return null;
  const code = startParam.slice(TELEGRAM_LINK_PREFIX.length);
  return /^[A-Za-z0-9_-]{32}$/u.test(code) ? code : null;
}
