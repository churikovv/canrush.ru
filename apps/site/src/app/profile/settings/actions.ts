'use server';
import { randomBytes } from 'node:crypto';
import { getTelegramEnv } from '@/lib/env';
import { TELEGRAM_LINK_TTL_SECONDS, TELEGRAM_PROVIDER_ID, telegramLinkIdentifier } from '@/lib/telegram-auth';
import { isTelegramPlaceholderEmail, TELEGRAM_LINK_PREFIX } from '@/lib/telegram-init-data';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getPool } from '@/db/pool';
import { NOTIFICATION_OPTIONS } from '@/lib/notification-preferences';

export async function saveNotificationSettings(form: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in');
  await getPool().query(`insert into "notificationPreference" ("userId",kind,enabled)
    select $1, unnest($2::text[]), unnest($3::boolean[])
    on conflict ("userId",kind) do update set enabled=excluded.enabled`,
    [session.user.id, NOTIFICATION_OPTIONS.map(x => x.kind), NOTIFICATION_OPTIONS.map(x => form.get(x.kind) === 'on')]);
  redirect('/profile/settings?saved=1');
}

export type TelegramLinkResult = { url: string } | { error: string };

/** Issues a one-time code and returns the Mini App link that carries it in the signed `start_param`. */
export async function createTelegramLink(): Promise<TelegramLinkResult> {
  const telegram = getTelegramEnv();
  if (!telegram) return { error: 'Вход через Telegram пока не настроен.' };
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: 'Войдите в аккаунт.' };
  const code = randomBytes(24).toString('base64url');
  const context = await auth.$context;
  await context.internalAdapter.createVerificationValue({
    identifier: telegramLinkIdentifier(code),
    value: session.user.id,
    expiresAt: new Date(Date.now() + TELEGRAM_LINK_TTL_SECONDS * 1_000),
  });
  const url = new URL(telegram.miniAppUrl);
  url.searchParams.set('startapp', `${TELEGRAM_LINK_PREFIX}${code}`);
  return { url: url.toString() };
}

export async function unlinkTelegram() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in');
  // An account created through Telegram has no working email: unlinking would lock it out.
  if (!isTelegramPlaceholderEmail(session.user.email)) {
    await getPool().query('delete from "account" where "userId" = $1 and "providerId" = $2', [session.user.id, TELEGRAM_PROVIDER_ID]);
  }
  redirect('/profile/settings');
}
