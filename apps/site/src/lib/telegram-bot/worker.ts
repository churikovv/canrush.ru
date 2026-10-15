import { getPool } from '@/db/pool';
import { getAuthEnv, getTelegramEnv } from '@/lib/env';
import { runDueJobs } from './jobs';
import { deliverOutbox } from './outbox';

const DELIVERY_INTERVAL_MS = 1_000;
const SCHEDULE_INTERVAL_MS = 60_000;

const globalForWorker = globalThis as typeof globalThis & { canrushTelegramWorker?: boolean };

/**
 * Runs inside the site process: sends the outbox (≤20 messages per second, under Telegram's 30/s)
 * and starts scheduled jobs. Safe with several instances: rows are leased, job periods are claimed.
 */
export function startTelegramWorker(): void {
  const telegram = getTelegramEnv();
  if (!telegram || globalForWorker.canrushTelegramWorker) return;
  globalForWorker.canrushTelegramWorker = true;
  const pool = getPool();
  const siteUrl = getAuthEnv().authUrl;

  let delivering = false;
  setInterval(() => {
    if (delivering) return;
    delivering = true;
    deliverOutbox(pool, telegram.botToken, siteUrl)
      .catch(error => console.error('Telegram delivery failed', error instanceof Error ? error.message : error))
      .finally(() => { delivering = false; });
  }, DELIVERY_INTERVAL_MS).unref();

  let scheduling = false;
  const schedule = () => {
    if (scheduling) return;
    scheduling = true;
    runDueJobs(pool)
      .catch(error => console.error('Telegram jobs failed', error instanceof Error ? error.message : error))
      .finally(() => { scheduling = false; });
  };
  setTimeout(schedule, 10_000).unref();
  setInterval(schedule, SCHEDULE_INTERVAL_MS).unref();
}
