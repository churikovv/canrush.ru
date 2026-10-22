'use server';
import { randomBytes } from 'node:crypto';
import { getTelegramEnv } from '@/lib/env';
import { TELEGRAM_LINK_TTL_SECONDS, TELEGRAM_PROVIDER_ID, telegramLinkIdentifier } from '@/lib/telegram-auth';
import { isTelegramPlaceholderEmail, TELEGRAM_LINK_PREFIX } from '@/lib/telegram-init-data';
import { findCity } from '@canrush/shared';
import { isSiteAdminEmail } from '@/lib/admin';
import { TELEGRAM_BOT_OPTIONS } from '@/lib/telegram-bot/settings';
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
  redirect('/profile/settings?section=notifications&saved=1');
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
  redirect('/profile/settings?section=telegram-bot');
}

export async function saveTelegramBotSettings(form: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in');
  const city = findCity(form.get('city'))?.id ?? null;
  const admin = await isSiteAdminEmail(session.user.email);
  const values = TELEGRAM_BOT_OPTIONS.map(option => (option.adminOnly && !admin ? null : form.get(option.column) === 'on'));
  // Column names come from the fixed option list; values are parameters.
  await getPool().query(`update "telegramChat" c set ${TELEGRAM_BOT_OPTIONS.map((option, index) => `"${option.column}" = coalesce($${index + 3}, c."${option.column}")`).join(', ')}, city = coalesce($2, c.city)
    from account a where a."userId" = $1 and a."providerId" = 'telegram' and a."accountId" = c."telegramId"::text`,
    [session.user.id, city, ...values]);
  redirect('/profile/settings?section=telegram-bot&saved=telegram');
}
