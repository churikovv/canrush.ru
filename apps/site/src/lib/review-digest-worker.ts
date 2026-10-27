import { getPool } from '@/db/pool';
import { getGigaChat } from '@/lib/gigachat';
import { runCatalogDigests } from '@/lib/review-digest';
import { moscowClock } from '@/lib/telegram-bot/jobs';

const CHECK_EVERY_MS = 10 * 60_000;
const JOB = 'review-digests';
let running = false;

/**
 * Nightly review summaries for the catalog: from 03:00 Moscow (or at the first check after a deploy that day) one pass
 * writes summaries for drinks with enough new reviews. The day is claimed in `telegramJobRun`, so several instances run
 * it once; a failed pass releases the claim to retry. Off without the model key, with `DIGEST_WORKER=off`, and in
 * development unless `DIGEST_WORKER=on`.
 */
export function startReviewDigestWorker(): void {
  if (!getGigaChat()) return;
  const tick = async () => {
    if (running) return;
    const clock = moscowClock();
    if (clock.hour < 3) return;
    const pool = getPool();
    const claimed = await pool.query('insert into "telegramJobRun"(job, period) values ($1, $2) on conflict do nothing', [JOB, clock.date]).catch(() => null);
    if (!claimed?.rowCount) return;
    running = true;
    try {
      const result = await runCatalogDigests(getGigaChat()!);
      console.info(`[review-digest] ${clock.date}: written ${result.written}, failed ${result.failed}`);
    } catch (error) {
      await pool.query('delete from "telegramJobRun" where job = $1 and period = $2', [JOB, clock.date]).catch(() => undefined);
      console.error('[review-digest] run failed', error instanceof Error ? error.message : 'unknown');
    } finally { running = false; }
  };
  setTimeout(() => void tick(), 60_000).unref();
  setInterval(() => void tick(), CHECK_EVERY_MS).unref();
}
