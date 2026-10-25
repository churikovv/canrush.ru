import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';

export interface AuthEnv {
  authSecret: string;
  authUrl: string;
  databaseUrl: string;
}

export interface SmtpEnv {
  fromName: string;
  host: string;
  password: string;
  port: number;
  user: string;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function parseUrl(name: string, protocols: string[]): URL {
  const value = required(name);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
  if (!protocols.includes(url.protocol)) throw new Error(`${name} uses an unsupported protocol`);
  return url;
}

export function getAuthEnv(): AuthEnv {
  const authUrl = parseUrl('BETTER_AUTH_URL', ['http:', 'https:']);
  if (authUrl.pathname !== '/' || authUrl.search || authUrl.hash) {
    throw new Error('BETTER_AUTH_URL must contain only the application origin');
  }
  if (
    process.env.NODE_ENV === 'production' &&
    authUrl.protocol !== 'https:' &&
    !['localhost', '127.0.0.1'].includes(authUrl.hostname)
  ) {
    throw new Error('BETTER_AUTH_URL must use HTTPS in production');
  }

  const databaseUrl = parseUrl('DATABASE_URL', ['postgres:', 'postgresql:']).toString();
  const authSecret = required('BETTER_AUTH_SECRET');
  if (Buffer.byteLength(authSecret, 'utf8') < 32) {
    throw new Error('BETTER_AUTH_SECRET must contain at least 32 bytes');
  }

  return {
    authSecret,
    authUrl: authUrl.origin,
    databaseUrl,
  };
}

export interface TelegramEnv {
  botToken: string;
  /** Direct Mini App link, e.g. https://t.me/canrush_bot/app. */
  miniAppUrl: string;
  /** Bot username taken from the Mini App link. */
  botUsername: string;
  /** Secret Telegram echoes in X-Telegram-Bot-Api-Secret-Token; without it the bot webhook is off. */
  webhookSecret: string | null;
}

/** Telegram Mini App sign-in is optional: without both variables the feature stays off. */
export function getTelegramEnv(): TelegramEnv | null {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  // Accept the link as BotFather prints it, with or without the scheme.
  const rawMiniAppUrl = process.env.TELEGRAM_MINI_APP_URL?.trim();
  const miniAppUrl = rawMiniAppUrl && !/^[a-z]+:\/\//iu.test(rawMiniAppUrl) ? `https://${rawMiniAppUrl}` : rawMiniAppUrl;
  if (!botToken || !miniAppUrl) return null;
  if (!/^\d+:[A-Za-z0-9_-]{30,}$/u.test(botToken)) throw new Error('TELEGRAM_BOT_TOKEN has an unexpected format');
  let url: URL;
  try {
    url = new URL(miniAppUrl);
  } catch {
    throw new Error('TELEGRAM_MINI_APP_URL must be a valid URL');
  }
  const botUsername = /^\/([A-Za-z0-9_]{5,32})(?:\/[A-Za-z0-9_]{3,30})?$/u.exec(url.pathname)?.[1];
  if (url.protocol !== 'https:' || url.hostname !== 't.me' || url.search || url.hash || !botUsername) {
    throw new Error('TELEGRAM_MINI_APP_URL must be a https://t.me/<bot>/<app> link');
  }
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || null;
  if (webhookSecret && !/^[A-Za-z0-9_-]{32,256}$/u.test(webhookSecret)) {
    throw new Error('TELEGRAM_WEBHOOK_SECRET must be 32-256 characters of A-Z, a-z, 0-9, _ or -');
  }
  return { botToken, miniAppUrl: url.toString(), botUsername, webhookSecret };
}

export interface ReviewLoginEnv {
  email: string;
  /** `scrypt:<salt>:<key>` from `npm -w apps/site run review:password`; the password itself is never stored. */
  passwordHash: string;
}

/**
 * Password sign-in for one store-review account (Google Play / RuStore reviewers cannot use magic links
 * or Telegram). Optional: without both variables the endpoint answers 404 and the form is hidden.
 */
export function getReviewLoginEnv(): ReviewLoginEnv | null {
  const email = process.env.REVIEW_LOGIN_EMAIL?.trim().toLowerCase();
  const passwordHash = process.env.REVIEW_LOGIN_PASSWORD_HASH?.trim();
  if (!email || !passwordHash) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) throw new Error('REVIEW_LOGIN_EMAIL must be an email address');
  if (!/^scrypt:[A-Za-z0-9_-]{22,}:[A-Za-z0-9_-]{43}$/u.test(passwordHash)) {
    throw new Error('REVIEW_LOGIN_PASSWORD_HASH must come from npm -w apps/site run review:password');
  }
  return { email, passwordHash };
}

export interface FcmAccount { projectId: string; clientEmail: string; privateKey: string }
export interface RuStorePushEnv { projectId: string; token: string }
/** APNs token auth: the .p8 key from developer.apple.com (Keys → Apple Push Notifications service). */
export interface ApnsEnv { keyId: string; teamId: string; privateKey: string; topic: string; sandbox: boolean }
export interface PushEnv { fcm: FcmAccount | null; rustore: RuStorePushEnv | null; apns: ApnsEnv | null }

/**
 * Push senders, each optional: FCM_SERVICE_ACCOUNT_FILE — path to the Firebase service account JSON
 * (kept as a file, not in the environment); RUSTORE_PUSH_PROJECT_ID + RUSTORE_PUSH_TOKEN from the RuStore console;
 * for the iOS app APNS_KEY_FILE (the .p8 key, a file too) with APNS_KEY_ID and APNS_TEAM_ID — APNS_TOPIC is the bundle
 * id (ru.canrush.app), APNS_SANDBOX=1 sends to development builds from Xcode instead of App Store/TestFlight ones.
 */
export function getPushEnv(): PushEnv {
  let fcm: FcmAccount | null = null;
  const file = process.env.FCM_SERVICE_ACCOUNT_FILE?.trim();
  if (file) {
    const raw = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    if (typeof raw.project_id !== 'string' || typeof raw.client_email !== 'string' || typeof raw.private_key !== 'string') {
      throw new Error('FCM_SERVICE_ACCOUNT_FILE must be a Firebase service account JSON');
    }
    fcm = { projectId: raw.project_id, clientEmail: raw.client_email, privateKey: raw.private_key };
  }
  const projectId = process.env.RUSTORE_PUSH_PROJECT_ID?.trim();
  const token = process.env.RUSTORE_PUSH_TOKEN?.trim();
  const keyFile = process.env.APNS_KEY_FILE?.trim(), keyId = process.env.APNS_KEY_ID?.trim(), teamId = process.env.APNS_TEAM_ID?.trim();
  let apns: ApnsEnv | null = null;
  if (keyFile && keyId && teamId) {
    const privateKey = readFileSync(keyFile, 'utf8');
    if (!privateKey.includes('BEGIN PRIVATE KEY')) throw new Error('APNS_KEY_FILE must be the .p8 key from Apple');
    apns = { keyId, teamId, privateKey, topic: process.env.APNS_TOPIC?.trim() || 'ru.canrush.app', sandbox: process.env.APNS_SANDBOX === '1' };
  }
  return { fcm, rustore: projectId && token ? { projectId, token } : null, apns };
}

export const DEFAULT_TELEGRAM_API_URL = 'https://api.telegram.org';

/**
 * Bot API base URL. TELEGRAM_API_URL points to a reverse proxy abroad when the server cannot reach
 * api.telegram.org directly. HTTPS is required: the bot token travels in the request path.
 */
export function getTelegramApiUrl(): string {
  const value = process.env.TELEGRAM_API_URL?.trim();
  if (!value) return DEFAULT_TELEGRAM_API_URL;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('TELEGRAM_API_URL must be a valid URL');
  }
  if (url.protocol !== 'https:' || url.search || url.hash || url.username || url.password) {
    throw new Error('TELEGRAM_API_URL must be an https:// URL without query or credentials');
  }
  return `${url.origin}${url.pathname.replace(/\/+$/u, '')}`;
}

export function getSmtpEnv(): SmtpEnv {
  const port = Number(required('SMTP_PORT'));
  if (!Number.isInteger(port) || port !== 465) throw new Error('SMTP_PORT must be 465 for implicit TLS');

  const user = required('SMTP_USER');
  if (!user.includes('@')) throw new Error('SMTP_USER must be an email address');

  return {
    fromName: required('MAIL_FROM_NAME'),
    host: required('SMTP_HOST'),
    password: required('SMTP_PASSWORD'),
    port,
    user,
  };
}
