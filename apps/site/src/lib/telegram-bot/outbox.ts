import type { Pool, PoolClient } from 'pg';
import { getNotificationById } from '@/lib/notifications';
import { callTelegram, TelegramApiError, type InlineKeyboard } from './api';
import type { BotPromo } from './catalog';
import {
  adminSummaryText,
  digestText,
  marketText,
  notificationText,
  openButton,
  promoAlertText,
  type AdminSummary,
  type MarketEvent,
} from './format';

export type OutboxKind = 'notification' | 'market' | 'promo' | 'digest' | 'admin-summary';

export interface MarketPayload { event: MarketEvent; orderId: string; title: string; counterpart: string; message?: string }
export interface PromoPayload { cityName: string; promos: BotPromo[] }
export interface AdminSummaryPayload { day: string; summary: AdminSummary }

type Queryable = Pool | PoolClient;

/** Queues a message for a member; a no-op without a started bot chat or with that kind switched off. */
export async function enqueueTelegram(db: Queryable, userId: string, kind: OutboxKind, payload: object, dedupeKey: string): Promise<void> {
  await db.query('select telegram_enqueue($1, $2, $3::jsonb, $4)', [userId, kind, JSON.stringify(payload), dedupeKey]);
}

interface OutboxRow { id: string; chatId: string; kind: OutboxKind; payload: Record<string, unknown>; attempts: number }

export interface RenderedMessage { text: string; keyboard?: InlineKeyboard }

export async function renderOutboxMessage(row: Pick<OutboxRow, 'kind' | 'payload'>, siteUrl: string): Promise<RenderedMessage | null> {
  const open = (text: string, path: string): InlineKeyboard => [[openButton(text, `${siteUrl}${path}`)]];
  switch (row.kind) {
    case 'notification': {
      const item = await getNotificationById(String(row.payload.notificationId));
      return item ? { text: notificationText(item.title, item.detail), keyboard: open('Открыть', item.href) } : null;
    }
    case 'market': {
      const p = row.payload as unknown as MarketPayload;
      return { text: marketText(p.event, p.title, p.counterpart, p.message), keyboard: open('Открыть переписку', `/messages/${encodeURIComponent(p.orderId)}`) };
    }
    case 'promo': {
      const p = row.payload as unknown as PromoPayload;
      return { text: promoAlertText(p.promos, p.cityName), keyboard: open('Моё избранное', '/profile/favorites') };
    }
    case 'digest': {
      const p = row.payload as unknown as PromoPayload;
      return { text: digestText(p.promos, p.cityName), keyboard: open('Все акции', '/catalog?sort=deals') };
    }
    case 'admin-summary': {
      const p = row.payload as unknown as AdminSummaryPayload;
      return { text: adminSummaryText(p.summary, p.day), keyboard: open('Админка', '/admin') };
    }
  }
}

const MAX_ATTEMPTS = 5;

/**
 * Sends up to `batch` due messages. Rows are leased for two minutes (sendAfter moves forward),
 * so a crashed sender or a parallel instance never sends a message twice in a row.
 */
export async function deliverOutbox(pool: Pool, token: string, siteUrl: string, batch = 20): Promise<number> {
  const { rows } = await pool.query<OutboxRow>(`
    update "telegramOutbox" o set attempts = o.attempts + 1, "sendAfter" = now() + interval '2 minutes'
    from (select id from "telegramOutbox" where "sentAt" is null and "sendAfter" <= now() order by "sendAfter", id limit $1 for update skip locked) due
    where o.id = due.id
    returning o.id, o."chatId", o.kind, o.payload, o.attempts`, [batch]);

  for (const row of rows) {
    try {
      const message = await renderOutboxMessage(row, siteUrl);
      if (message) {
        await callTelegram(token, 'sendMessage', {
          chat_id: row.chatId,
          text: message.text,
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
          ...(message.keyboard ? { reply_markup: { inline_keyboard: message.keyboard } } : {}),
        });
      }
      await pool.query('update "telegramOutbox" set "sentAt" = now(), "lastError" = null where id = $1', [row.id]);
    } catch (error) {
      const description = error instanceof Error ? error.message.slice(0, 500) : 'unknown error';
      if (error instanceof TelegramApiError && error.retryAfter) {
        await pool.query(`update "telegramOutbox" set "sendAfter" = now() + make_interval(secs => $2), attempts = attempts - 1, "lastError" = $3 where id = $1`, [row.id, error.retryAfter, description]);
        break;
      }
      // 403: the member blocked the bot; 400: chat not found. Retrying will not help.
      const permanent = error instanceof TelegramApiError && (error.code === 403 || error.code === 400);
      if (error instanceof TelegramApiError && error.code === 403) {
        await pool.query('update "telegramChat" set "blockedAt" = now() where "chatId" = $1', [row.chatId]);
      }
      if (permanent || row.attempts >= MAX_ATTEMPTS) {
        await pool.query('update "telegramOutbox" set "sentAt" = now(), "lastError" = $2 where id = $1', [row.id, description]);
      } else {
        await pool.query(`update "telegramOutbox" set "sendAfter" = now() + make_interval(secs => $2), "lastError" = $3 where id = $1`, [row.id, 30 * 2 ** row.attempts, description]);
      }
    }
  }
  return rows.length;
}

export async function pruneOutbox(pool: Pool): Promise<void> {
  await pool.query(`delete from "telegramOutbox" where "sentAt" < now() - interval '30 days'`);
  await pool.query(`delete from "telegramPromoSeen" where "seenAt" < now() - interval '90 days'`);
}
