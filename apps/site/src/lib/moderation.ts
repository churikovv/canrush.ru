import { getPool } from '@/db/pool';

export async function isUserBlocked(userId: string): Promise<boolean> {
  const result = await getPool().query<{ blocked: boolean }>(
    'select exists(select 1 from "userBlock" where "userId" = $1) as blocked',
    [userId],
  );
  return result.rows[0]?.blocked === true;
}

const FROZEN_UNTIL = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' });

/**
 * A freeze from the admin panel ("userFreeze", migration 0108): the member may not post until the moment passes, while
 * their profile and earlier posts stay visible. Returns the message to show, or null when they may post.
 */
export async function frozenMessage(userId: string): Promise<string | null> {
  const until = (await getPool().query<{ until: Date }>('select until from "userFreeze" where "userId" = $1 and until > now()', [userId])).rows[0]?.until;
  return until ? `Аккаунт заморожен модератором до ${FROZEN_UNTIL.format(until)} — писать пока нельзя.` : null;
}

/** The database's own guard for a frozen author (`prevent_frozen_posting`, errcode CR002). */
export function isFrozenError(error: unknown): error is Error {
  return (error as { code?: string } | null)?.code === 'CR002';
}
