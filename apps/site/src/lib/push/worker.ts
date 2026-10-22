import { getPool } from '@/db/pool';
import { getAuthEnv, getPushEnv } from '@/lib/env';
import { deliverPush, prunePush } from './outbox';

const DELIVERY_INTERVAL_MS = 1_000;
const PRUNE_INTERVAL_MS = 6 * 60 * 60 * 1_000;

const globalForWorker = globalThis as typeof globalThis & { canrushPushWorker?: boolean };

/** Runs inside the site process next to the Telegram worker; off until FCM or RuStore Push is configured. */
export function startPushWorker(): void {
  // A broken key file must not take the site down: push stays off and the error is logged.
  let env: ReturnType<typeof getPushEnv>;
  try {
    env = getPushEnv();
  } catch (error) {
    console.error('Push is off: bad push configuration', error instanceof Error ? error.message : error);
    return;
  }
  if ((!env.fcm && !env.rustore) || globalForWorker.canrushPushWorker) return;
  globalForWorker.canrushPushWorker = true;
  const pool = getPool();
  const siteUrl = getAuthEnv().authUrl;

  let delivering = false;
  setInterval(() => {
    if (delivering) return;
    delivering = true;
    deliverPush(pool, env, siteUrl)
      .catch(error => console.error('Push delivery failed', error instanceof Error ? error.message : error))
      .finally(() => { delivering = false; });
  }, DELIVERY_INTERVAL_MS).unref();

  setInterval(() => {
    prunePush(pool).catch(error => console.error('Push prune failed', error instanceof Error ? error.message : error));
  }, PRUNE_INTERVAL_MS).unref();
}
