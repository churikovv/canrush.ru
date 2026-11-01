import type { Pool, PoolClient } from 'pg';
import { getPool } from '@/db/pool';
import { BOT_MESSAGE_LIMIT } from '@/lib/bot-message-limits';
import { getTelegramEnv } from '@/lib/env';
import { callTelegram } from '@/lib/telegram-bot/api';
import { enqueueTelegram, telegramAdminIds } from '@/lib/telegram-bot/outbox';

/** How long after the team's message a member's text in the bot counts as an answer, not a drink search. */
export const BOT_DIALOG_DAYS = 7;

const TELEGRAM_NICK = /^[A-Za-z0-9_]{3,32}$/u;

export class BotMessageError extends Error {}

export interface BotMessage { id: string; fromTeam: boolean; text: string; createdAt: string; failed: boolean }
export interface BotMember { id: string; name: string; username: string | null; email: string; avatarId: string | null; reachable: boolean }
export interface BotDialogRow extends BotMember { preview: string; lastFromTeam: boolean; lastMessageAt: string; unread: number }
export interface TelegramNick { username: string | null; failed: boolean }

const MEMBER_COLUMNS = `u.id, u.name, u.username, u.email,
  (select id::text from "profileImage" where "userId" = u.id and kind = 'avatar') as "avatarId",
  exists(select 1 from account a join "telegramChat" c on c."telegramId"::text = a."accountId"
    where a."userId" = u.id and a."providerId" = 'telegram' and c."blockedAt" is null) as reachable`;

export function parseBotMessage(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new BotMessageError('Напишите текст сообщения.');
  if (text.length > BOT_MESSAGE_LIMIT) throw new BotMessageError(`Сообщение длиннее ${BOT_MESSAGE_LIMIT} символов.`);
  return text;
}

/** Dialogs, those with an unread answer first, then the most recent. */
export async function listBotDialogs(): Promise<BotDialogRow[]> {
  const { rows } = await getPool().query<BotDialogRow>(`
    select ${MEMBER_COLUMNS}, last.text as preview, last."fromTeam" as "lastFromTeam", last."createdAt" as "lastMessageAt", waiting.unread
    from "user" u
    join lateral (select text, "fromTeam", "createdAt" from "botMessage" m where m."userId" = u.id order by m."createdAt" desc limit 1) last on true
    cross join lateral (select count(*)::int as unread from "botMessage" m where m."userId" = u.id and not m."fromTeam" and m."readAt" is null) waiting
    order by waiting.unread > 0 desc, last."createdAt" desc limit 100`);
  return rows;
}

/** Members to start a dialog with, by nick, name or mail; those the bot can reach come first. */
export async function findBotMembers(query: string): Promise<BotMember[]> {
  const { rows } = await getPool().query<BotMember>(`
    select ${MEMBER_COLUMNS} from "user" u
    where u.username ilike '%' || $1 || '%' or u.name ilike '%' || $1 || '%' or u.email ilike '%' || $1 || '%'
    order by reachable desc, u.username nulls last limit 12`, [query.replace(/[%_\\]/gu, '\\$&')]);
  return rows;
}

/** One member's dialog; opening it marks their answers read. */
export async function getBotDialog(userId: string): Promise<{ member: BotMember; messages: BotMessage[] } | null> {
  const db = getPool();
  const member = (await db.query<BotMember>(`select ${MEMBER_COLUMNS} from "user" u where u.id = $1`, [userId])).rows[0];
  if (!member) return null;
  await db.query(`update "botMessage" set "readAt" = now() where "userId" = $1 and not "fromTeam" and "readAt" is null`, [userId]);
  // The worker stamps a hopeless delivery as sent, with the reason in `lastError`: the team should see the winner did not get it.
  const { rows } = await db.query<BotMessage>(`select m.id, m."fromTeam", m.text, m."createdAt",
      exists(select 1 from "telegramOutbox" o where o."dedupeKey" = 'direct:' || m.id and o."sentAt" is not null and o."lastError" is not null) as failed
    from (select * from "botMessage" where "userId" = $1 order by "createdAt" desc limit 200) m order by m."createdAt"`, [userId]);
  return { member, messages: rows };
}

/**
 * The member's real Telegram nick, asked from Telegram each time and stored nowhere: `user.username` is the nick on the
 * site and `user.telegramUsername` is whatever the member typed. Null when they have no chat with the bot.
 */
export async function getTelegramNick(userId: string): Promise<TelegramNick | null> {
  const chatId = (await getPool().query<{ chatId: string }>(`select c."chatId" from account a
    join "telegramChat" c on c."telegramId"::text = a."accountId" where a."userId" = $1 and a."providerId" = 'telegram'`, [userId])).rows[0]?.chatId;
  if (!chatId) return null;
  const token = getTelegramEnv()?.botToken;
  if (!token) return { username: null, failed: true };
  try {
    const { username } = await callTelegram<{ username?: string }>(token, 'getChat', { chat_id: chatId });
    return { username: username && TELEGRAM_NICK.test(username) ? username : null, failed: false };
  } catch {
    return { username: null, failed: true };
  }
}

/** Queues the team's message: it goes out through the bot's outbox, and the audit log says who wrote it. */
export async function sendBotMessage(adminEmail: string, userId: string, value: unknown): Promise<void> {
  const text = parseBotMessage(value);
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const member = (await client.query<{ reachable: boolean }>(`select ${MEMBER_COLUMNS} from "user" u where u.id = $1`, [userId])).rows[0];
    if (!member) throw new BotMessageError('Участник не найден.');
    if (!member.reachable) throw new BotMessageError('Сообщение не дойдёт: участник не запускал бота или остановил его.');
    const id = (await client.query<{ id: string }>(`insert into "botMessage" ("userId", "fromTeam", text, "adminEmail") values ($1, true, $2, $3) returning id`, [userId, text, adminEmail])).rows[0]!.id;
    await enqueueTelegram(client, userId, 'direct', { text }, `direct:${id}`);
    await client.query(`insert into "adminAuditLog" ("adminEmail", action, "targetType", "targetId") values ($1, 'bot-message', 'user', $2)`, [adminEmail, userId]);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * A member's text in the bot: within a week of the team's message it is their answer, it is kept and the administrators
 * hear about it; otherwise `false`, and the bot treats it as a drink search and keeps nothing.
 */
export async function recordBotReply(db: Pool | PoolClient, from: { id: number; username?: string }, value: string): Promise<boolean> {
  const text = value.trim().slice(0, BOT_MESSAGE_LIMIT);
  const member = (await db.query<{ id: string; name: string }>(`
    select u.id, u.name from account a join "user" u on u.id = a."userId"
    where a."providerId" = 'telegram' and a."accountId" = $1
      and exists(select 1 from "botMessage" m where m."userId" = u.id and m."fromTeam" and m."createdAt" > now() - make_interval(days => $2))`,
  [String(from.id), BOT_DIALOG_DAYS])).rows[0];
  if (!member || !text) return false;
  const id = (await db.query<{ id: string }>(`insert into "botMessage" ("userId", "fromTeam", text) values ($1, false, $2) returning id`, [member.id, text])).rows[0]!.id;
  // Only the sender's own nick gets an «@»: Telegram links any @word, so a nick from the site could open a stranger's account.
  const name = from.username && TELEGRAM_NICK.test(from.username) ? `${member.name} (@${from.username})` : member.name;
  for (const admin of await telegramAdminIds(db)) await enqueueTelegram(db, admin, 'direct-reply', { userId: member.id, name, text }, `direct-reply:${id}:${admin}`);
  return true;
}
