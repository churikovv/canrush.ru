import { reportedWeek, runWeeklyReports } from '@/lib/business-report';
import { moscowClock } from '@/lib/telegram-bot/jobs';

const CHECK_EVERY_MS = 15 * 60_000;
let running = false;

/**
 * The weekly business report: on Mondays from 09:00 Moscow a pass sends last week's report to everyone who has not got
 * it yet (`runWeeklyReports` claims each letter, so passes and instances do not repeat). Started from
 * `instrumentation.ts` in production unless `BUSINESS_REPORT_WORKER=off`; in development only with `=on`.
 */
export function startBusinessReportWorker(): void {
  const tick = async () => {
    const clock = moscowClock();
    if (running || clock.weekday !== 1 || clock.hour < 9) return;
    running = true;
    try {
      const result = await runWeeklyReports(reportedWeek(clock.date));
      if (result.sent || result.failed) console.info(`[business-report] ${clock.date}: sent ${result.sent}, failed ${result.failed}`);
    } catch (error) { console.error('[business-report] run failed', error instanceof Error ? error.message : 'unknown'); }
    finally { running = false; }
  };
  setTimeout(() => void tick(), 90_000).unref();
  setInterval(() => void tick(), CHECK_EVERY_MS).unref();
}
