import cron from 'node-cron';
import type { CityId, SourceName } from '@canrush/shared';
import { runRegionalParser } from './regions.js';
import { runParser } from './run.js';

export interface ScheduleOptions {
  sources?: SourceName[];
  cities?: CityId[];
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

  let running = false;
  const task = cron.schedule(
    expression,
    async () => {
      console.log(`[canrush-parser] плановый запуск: ${new Date().toISOString()}`);
      if (running) return;
      running = true;
      try {
        if (options.sources?.some(source => source !== 'edadeal') && !options.cities) await runParser({ sources: options.sources });
        else await runRegionalParser({ cities: options.cities });
      } catch (err) { console.error('[canrush-parser] ошибка планового запуска:', err); }
      finally { running = false; }
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
