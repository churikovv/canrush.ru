import { createSign, sign } from 'node:crypto';
import { connect, type ClientHttp2Session } from 'node:http2';
import type { ApnsEnv, FcmAccount, RuStorePushEnv } from '@/lib/env';

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

/** The APNs request body: the alert, and `url` beside `aps` — @capacitor/push-notifications hands it to the site as `data.url`. */
export function apnsBody(message: PushMessage) {
  return { aps: { alert: { title: message.title, body: message.body }, sound: 'default' }, url: message.url };
}

const apnsJwtCache = new Map<string, { value: string; issuedAt: number }>();

/**
 * Provider token for APNs (ES256 JWT signed with the .p8 key). Apple refuses tokens older than an hour and throttles
 * ones renewed more often than every 20 minutes, so one is kept for 50 minutes.
 */
export function apnsJwt(config: ApnsEnv, now = Date.now()): string {
  const cached = apnsJwtCache.get(config.keyId);
  if (cached && now - cached.issuedAt < 50 * 60_000) return cached.value;
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'ES256', kid: config.keyId })}.${encode({ iss: config.teamId, iat: Math.floor(now / 1_000) })}`;
  const signature = sign('sha256', Buffer.from(unsigned), { key: config.privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  const value = `${unsigned}.${signature}`;
  apnsJwtCache.set(config.keyId, { value, issuedAt: now });
  return value;
}

/** One HTTP/2 request; tests replace it. APNs speaks HTTP/2 only, which Node's fetch does not. */
export type ApnsPost = (origin: string, path: string, headers: Record<string, string>, body: string) => Promise<{ status: number; body: string }>;

const sessions = new Map<string, ClientHttp2Session>();
const http2Post: ApnsPost = (origin, path, headers, body) => new Promise((resolve, reject) => {
  let session = sessions.get(origin);
  if (!session || session.closed || session.destroyed) {
    session = connect(origin);
    session.on('error', () => sessions.delete(origin));
    session.on('close', () => sessions.delete(origin));
    // An idle connection does not keep the process (or a test run) alive.
    session.unref();
    sessions.set(origin, session);
  }
  const request = session.request({ ':method': 'POST', ':path': path, ...headers });
  request.setTimeout(10_000, () => request.close());
  let status = 0, text = '';
  request.on('response', response => { status = Number(response[':status']); });
  request.setEncoding('utf8');
  request.on('data', chunk => { text += chunk; });
  request.on('end', () => resolve({ status, body: text }));
  request.on('error', reject);
  request.end(body);
});

export async function sendApns(config: ApnsEnv, token: string, message: PushMessage, post: ApnsPost = http2Post): Promise<void> {
  const origin = config.sandbox ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com';
  const response = await post(origin, `/3/device/${encodeURIComponent(token)}`, {
    authorization: `bearer ${apnsJwt(config)}`,
    'apns-topic': config.topic,
    'apns-push-type': 'alert',
    'apns-priority': '10',
    'content-type': 'application/json',
  }, JSON.stringify(apnsBody(message)));
  if (response.status === 200) return;
  // 410 Unregistered: the app was removed; 400 BadDeviceToken / DeviceTokenNotForTopic: a token of another app or environment.
  const permanent = response.status === 410 || (response.status === 400 && /BadDeviceToken|DeviceTokenNotForTopic/u.test(response.body));
  throw new PushError(`APNs ${response.status} ${response.body.slice(0, 200)}`, permanent);
}
