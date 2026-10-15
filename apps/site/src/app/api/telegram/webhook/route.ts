import { timingSafeEqual } from 'node:crypto';
import { getPool } from '@/db/pool';
import { getAuthEnv, getTelegramEnv } from '@/lib/env';
import { handleTelegramUpdate, type TelegramUpdate } from '@/lib/telegram-bot/updates';

export const dynamic = 'force-dynamic';

function sameSecret(received: string | null, expected: string): boolean {
  if (!received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Telegram Bot API webhook. Registered by `npm -w apps/site run telegram:setup`. */
export async function POST(request: Request): Promise<Response> {
  const telegram = getTelegramEnv();
  if (!telegram?.webhookSecret) return new Response(null, { status: 404 });
  if (!sameSecret(request.headers.get('x-telegram-bot-api-secret-token'), telegram.webhookSecret)) {
    return new Response(null, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return new Response(null, { status: 400 });
  }
  try {
    await handleTelegramUpdate(
      { pool: getPool(), token: telegram.botToken, siteUrl: getAuthEnv().authUrl, botUsername: telegram.botUsername },
      update,
    );
  } catch (error) {
    // Answer 200 anyway: Telegram would otherwise redeliver the same failing update in a loop.
    console.error('Telegram update failed', error instanceof Error ? error.message : error);
  }
  return new Response(null, { status: 200 });
}
