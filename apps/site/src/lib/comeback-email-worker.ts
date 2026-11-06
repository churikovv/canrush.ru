import { COMEBACK_START_HOUR } from '@/lib/comeback-email-fields';
import { runComebackEmails } from '@/lib/comeback-email';
import { getPool } from '@/db/pool';
import { moscowClock } from '@/lib/telegram-bot/jobs';

const CHECK_EVERY_MS = 15 * 60_000;
let running = false;

/**
 * Письма «Что нового на CanRush» тем, кто давно не заходил: раз в московские сутки, с `COMEBACK_START_HOUR`, один проход
 * (`runComebackEmails`). День захватывается в `telegramJobRun` (`comeback-email`), поэтому второй инстанс его не
 * повторит, а сбой прохода освобождает день для следующей проверки. Запускается из `instrumentation.ts` в production,
 * если не `COMEBACK_EMAIL_WORKER=off`; в разработке — только с `=on`.
 */
export function startComebackEmailWorker(): void {
  const tick = async () => {
    const clock = moscowClock();
    if (running || clock.hour < COMEBACK_START_HOUR) return;
    running = true;
    const db = getPool();
    try {
      const claimed = await db.query(`insert into "telegramJobRun" (job, period) values ('comeback-email', $1) on conflict do nothing`, [clock.date]);
      if (!claimed.rowCount) return;
      try {
        const result = await runComebackEmails();
        if (result.sent || result.failed) console.info(`[comeback-email] ${clock.date}: sent ${result.sent}, failed ${result.failed}, without news ${result.skipped}`);
      } catch (error) {
        await db.query(`delete from "telegramJobRun" where job = 'comeback-email' and period = $1`, [clock.date]).catch(() => undefined);
        throw error;
      }
    } catch (error) { console.error('[comeback-email] run failed', error instanceof Error ? error.message : 'unknown'); }
    finally { running = false; }
  };
  setTimeout(() => void tick(), 120_000).unref();
  setInterval(() => void tick(), CHECK_EVERY_MS).unref();
}
