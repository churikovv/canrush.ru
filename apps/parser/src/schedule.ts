import cron from 'node-cron';
import type { SourceName } from '@canrush/shared';
import { runParser } from './run.js';

export interface ScheduleOptions {
  sources?: SourceName[];
  cronExpression?: string;
}

/**
 * Запускает долгоживущий планировщик (node-cron). Расписание берётся из
 * CRON_SCHEDULE (.env) или options.cronExpression, по умолчанию — раз в сутки в 6:00
 * по московскому времени (низкая нагрузка на источники + свежие цены к утру).
 */
export function startSchedule(options: ScheduleOptions = {}): void {
  const expression = options.cronExpression ?? process.env.CRON_SCHEDULE ?? '0 6 * * *';
  console.log(`[canrush-parser] планировщик запущен, расписание "${expression}" (Europe/Moscow)`);

  const task = cron.schedule(
    expression,
    () => {
      console.log(`[canrush-parser] плановый запуск: ${new Date().toISOString()}`);
      runParser({ sources: options.sources }).catch((err) => {
        console.error('[canrush-parser] ошибка планового запуска:', err);
      });
    },
    { timezone: 'Europe/Moscow' },
  );

  task.start();

  process.on('SIGINT', () => {
    console.log('\n[canrush-parser] остановка планировщика...');
    task.stop();
    process.exit(0);
  });
}
