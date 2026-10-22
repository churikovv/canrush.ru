import { createSign } from 'node:crypto';
import type { FcmAccount, RuStorePushEnv } from '@/lib/env';

/** `url` — a path of this site; `link` — the same page as an absolute https URL (RuStore opens it as a deep link). */
export interface PushMessage { title: string; body: string; url: string; link: string }

/** `permanent`: the token is dead (app removed, token rotated) — the device row should go. */
export class PushError extends Error {
  constructor(message: string, readonly permanent: boolean) {
    super(message);
  }
}

/**
 * FCM HTTP v1 / RuStore message body; RuStore Push accepts the same format. FCM taps reach the site through
 * the Capacitor plugin (`data.url`); RuStore opens `link` as a deep link (click_action_type 1), which the app's
 * App Links filter for canrush.ru hands to MainActivity.openSiteLink.
 */
export function messageBody(token: string, message: PushMessage, provider: 'fcm' | 'rustore' = 'fcm') {
  const notification = { channel_id: 'canrush', color: '#006EFF', icon: 'ic_stat_notification' };
  return {
    message: {
      token,
      notification: { title: message.title, body: message.body },
      data: { url: message.url },
      android: provider === 'fcm'
        ? { priority: 'high', notification }
        : { notification: { ...notification, title: message.title, body: message.body, click_action: message.link, click_action_type: 1 } },
    },
  };
}

async function send(url: string, authorization: string, body: unknown): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { authorization, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (response.ok) return;
  const text = (await response.text()).slice(0, 300);
  // 404 / UNREGISTERED: the app was removed or the token rotated; 400 INVALID_ARGUMENT: not a token.
  const permanent = response.status === 404 || (response.status === 400 && /INVALID_ARGUMENT|UNREGISTERED|invalid.*token/iu.test(text));
  throw new PushError(`${response.status} ${text}`, permanent);
}

const tokenCache = new Map<string, { value: string; expiresAt: number }>();

/** OAuth access token for the service account (JWT bearer grant), cached until a minute before expiry. */
async function fcmAccessToken(account: FcmAccount): Promise<string> {
  const cached = tokenCache.get(account.clientEmail);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.value;
  const now = Math.floor(Date.now() / 1_000);
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
    iss: account.clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3_600,
  })}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(account.privateKey).toString('base64url');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
    signal: AbortSignal.timeout(10_000),
  });
  const data = await response.json() as { access_token?: string; expires_in?: number };
  if (!response.ok || !data.access_token) throw new PushError(`FCM auth ${response.status}`, false);
  tokenCache.set(account.clientEmail, { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3_600) * 1_000 });
  return data.access_token;
}

export async function sendFcm(account: FcmAccount, token: string, message: PushMessage): Promise<void> {
  const accessToken = await fcmAccessToken(account);
  await send(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(account.projectId)}/messages:send`, `Bearer ${accessToken}`, messageBody(token, message));
}

export async function sendRuStore(config: RuStorePushEnv, token: string, message: PushMessage): Promise<void> {
  await send(`https://vkpns.rustore.ru/v1/projects/${encodeURIComponent(config.projectId)}/messages:send`, `Bearer ${config.token}`, messageBody(token, message, 'rustore'));
}
