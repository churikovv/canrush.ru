import type { Pool, PoolClient } from 'pg';
import type { PushEnv } from '@/lib/env';
import { getNotificationById } from '@/lib/notifications';
import { truncate, type MarketEvent } from '@/lib/telegram-bot/format';
import type { MarketPayload } from '@/lib/telegram-bot/outbox';
import { PushError, sendApns, sendFcm, sendRuStore, type ApnsPost, type PushMessage } from './providers';

export type PushKind = 'notification' | 'market' | 'broadcast';
type Queryable = Pool | PoolClient;
const MAX_ATTEMPTS = 5;

/** Queues a push for every device of the member; a no-op without registered devices. */
export async function enqueuePush(db: Queryable, userId: string, kind: PushKind, payload: object, dedupeKey: string): Promise<void> {
  await db.query('select push_enqueue($1, $2, $3::jsonb, $4)', [userId, kind, JSON.stringify(payload), dedupeKey]);
}

const MARKET_TITLES: Record<MarketEvent, (counterpart: string) => string> = {
  new: counterpart => `Новый заказ от ${counterpart}`,
  confirmed: () => 'Продавец подтвердил заказ',
  completed: () => 'Покупатель завершил заказ',
  cancelled: () => 'Заказ отменён',
  message: counterpart => `Новое сообщение от ${counterpart}`,
};

/** Plain-text title, body and in-app path; null when the source is gone (e.g. the notification was deleted). */
export async function renderPush(row: { kind: PushKind; payload: Record<string, unknown> }, siteUrl: string): Promise<PushMessage | null> {
  const link = (path: string) => new URL(path, siteUrl).toString();
  if (row.kind === 'notification') {
    const item = await getNotificationById(String(row.payload.notificationId));
    return item ? { title: truncate(item.title, 80), body: truncate(item.detail, 200), url: item.href, link: link(item.href) } : null;
  }
  if (row.kind === 'broadcast') {
    const { title, body, path } = row.payload as { title: string; body: string; path: string };
    return { title, body, url: path, link: link(path) };
  }
  const p = row.payload as unknown as MarketPayload;
  const body = p.message ? `«${truncate(p.title, 60)}»: ${truncate(p.message, 160)}` : `«${truncate(p.title, 120)}»`;
  const url = `/messages/${encodeURIComponent(p.orderId)}`;
  return { title: MARKET_TITLES[p.event](p.counterpart), body, url, link: link(url) };
}

export type PushProvider = 'fcm' | 'rustore' | 'apns';
interface OutboxRow { id: string; token: string; provider: PushProvider; kind: PushKind; payload: Record<string, unknown>; attempts: number }

/** Sends up to `batch` due pushes. Rows are leased for two minutes, as in the Telegram outbox. `apnsPost` — tests only. */
export async function deliverPush(pool: Pool, env: PushEnv, siteUrl: string, batch = 50, apnsPost?: ApnsPost): Promise<number> {
  const { rows } = await pool.query<OutboxRow>(`
    update "pushOutbox" o set attempts = o.attempts + 1, "sendAfter" = now() + interval '2 minutes'
    from (select id from "pushOutbox" where "sentAt" is null and "sendAfter" <= now() order by "sendAfter", id limit $1 for update skip locked) due,
      "pushDevice" d
    where o.id = due.id and d.token = o.token
    returning o.id, o.token, d.provider, o.kind, o.payload, o.attempts`, [batch]);

  for (const row of rows) {
    try {
      const message = await renderPush(row, siteUrl);
      if (message) {
        if (row.provider === 'fcm') {
          if (!env.fcm) throw new PushError('FCM is not configured', false);
          await sendFcm(env.fcm, row.token, message);
        } else if (row.provider === 'apns') {
          if (!env.apns) throw new PushError('APNs is not configured', false);
          await sendApns(env.apns, row.token, message, apnsPost);
        } else {
          if (!env.rustore) throw new PushError('RuStore Push is not configured', false);
          await sendRuStore(env.rustore, row.token, message);
        }
      }
      await pool.query('update "pushOutbox" set "sentAt" = now(), "lastError" = null where id = $1', [row.id]);
      if (row.kind === 'broadcast') await pool.query('update "pushBroadcast" set delivered = delivered + 1 where id = $1', [row.payload.broadcastId]);
    } catch (error) {
      const description = error instanceof Error ? error.message.slice(0, 500) : 'unknown error';
      if (error instanceof PushError && error.permanent) {
        // The device's queue goes with it (on delete cascade).
        await pool.query('delete from "pushDevice" where token = $1', [row.token]);
      } else if (row.attempts >= MAX_ATTEMPTS) {
        await pool.query('update "pushOutbox" set "sentAt" = now(), "lastError" = $2 where id = $1', [row.id, description]);
      } else {
        await pool.query(`update "pushOutbox" set "sendAfter" = now() + make_interval(secs => $2), "lastError" = $3 where id = $1`, [row.id, 30 * 2 ** row.attempts, description]);
      }
    }
  }
  return rows.length;
}

export async function prunePush(pool: Pool): Promise<void> {
  await pool.query(`delete from "pushOutbox" where "sentAt" < now() - interval '30 days'`);
  // A device not seen for half a year is most likely gone; FCM drops such tokens too.
  await pool.query(`delete from "pushDevice" where "lastSeenAt" < now() - interval '180 days'`);
}

export async function registerPushDevice(db: Queryable, userId: string, token: string, provider: PushProvider): Promise<void> {
  await db.query(`insert into "pushDevice" (token, "userId", provider) values ($1, $2, $3)
    on conflict (token) do update set "userId" = excluded."userId", provider = excluded.provider, "lastSeenAt" = now()`, [token, userId, provider]);
}

export async function unregisterPushDevice(db: Queryable, userId: string, token: string): Promise<void> {
  await db.query('delete from "pushDevice" where token = $1 and "userId" = $2', [token, userId]);
}
