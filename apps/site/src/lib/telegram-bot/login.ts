import type { Pool } from 'pg';
import {
  parseTelegramLoginState,
  telegramLoginHash,
  telegramLoginIdentifier,
  telegramLoginToken,
} from '@/lib/telegram-auth';
import type { TelegramUser } from '@/lib/telegram-init-data';
import { callTelegram } from './api';

export interface TelegramFrom { id: number; first_name?: string; last_name?: string; username?: string }

export function telegramUserFrom(from: TelegramFrom): TelegramUser {
  return {
    id: String(from.id),
    firstName: from.first_name ?? '',
    ...(from.last_name ? { lastName: from.last_name } : {}),
    ...(from.username && /^[A-Za-z0-9_]{3,32}$/u.test(from.username) ? { username: from.username } : {}),
  };
}

async function pendingLogin(pool: Pool, hash: string): Promise<boolean> {
  const { rows } = await pool.query<{ value: string }>(
    'select value from verification where identifier = $1 and "expiresAt" > now() order by "createdAt" desc limit 1',
    [telegramLoginIdentifier(hash)],
  );
  return parseTelegramLoginState(rows[0]?.value ?? '')?.state === 'pending';
}

/** `/start login_<token>`: asks the member to confirm the website sign-in started in their browser. */
export async function askLoginConfirmation(pool: Pool, token: string, send: (text: string, keyboard?: { text: string; callback_data: string }[][]) => Promise<void>): Promise<boolean> {
  const valid = telegramLoginToken(`login_${token}`);
  if (!valid) return false;
  const hash = telegramLoginHash(valid);
  if (!(await pendingLogin(pool, hash))) {
    await send('Ссылка для входа устарела. Нажмите «Войти через Telegram» на canrush.ru ещё раз.');
    return true;
  }
  await send(
    [
      '🔐 <b>Вход на canrush.ru</b>',
      '',
      'Подтвердите, только если вы сами только что нажали «Войти через Telegram» на сайте: этот браузер войдёт в ваш аккаунт CanRush.',
      'Если вы ничего не нажимали — выберите «Это не я».',
    ].join('\n'),
    [[{ text: '✅ Подтвердить вход', callback_data: `lg:y:${hash}` }], [{ text: 'Это не я', callback_data: `lg:n:${hash}` }]],
  );
  return true;
}

/** Records the member's decision; the waiting browser picks it up on its next poll. */
export async function decideLogin(pool: Pool, token: string, from: TelegramFrom, data: string, chatId: number, messageId: number): Promise<string | null> {
  const match = /^lg:([yn]):([A-Za-z0-9_-]{43})$/u.exec(data);
  if (!match) return null;
  const approve = match[1] === 'y';
  const updated = await pool.query(
    `update verification
       set value = (value::jsonb || jsonb_build_object('state', $2::text, 'user', $3::jsonb))::text, "updatedAt" = now()
     where identifier = $1 and "expiresAt" > now() and value::jsonb ->> 'state' = 'pending'`,
    [telegramLoginIdentifier(match[2] ?? ''), approve ? 'confirmed' : 'rejected', approve ? JSON.stringify(telegramUserFrom(from)) : 'null'],
  );
  const text = !updated.rowCount
    ? 'Ссылка для входа устарела. Нажмите «Войти через Telegram» на canrush.ru ещё раз.'
    : approve
      ? '✅ Вход подтверждён. Вернитесь в браузер — страница откроется сама.'
      : 'Вход отменён. Если это были не вы, просто проигнорируйте ссылку.';
  await callTelegram(token, 'editMessageText', { chat_id: chatId, message_id: messageId, text });
  return updated.rowCount ? (approve ? 'Вход подтверждён' : 'Вход отменён') : 'Ссылка устарела';
}
