#!/usr/bin/env node
import 'dotenv/config';
import { SOURCES, type SourceName } from '@canrush/shared';
import { detectChallenge, waitForClear } from './browser/challenge.js';
import { withSession } from './browser/session.js';
import { SOURCE_CHECK_URLS } from './browser/targets.js';
import { runParser } from './run.js';
import { startSchedule } from './schedule.js';
import { applyLocalImages, downloadProductImages, loadLatestData, saveLatestData } from './images.js';
import { downloadRetailerIcons } from './retailer-icons.js';

type Flags = Record<string, string | boolean>;

function parseFlags(args: string[]): Flags {
  const flags: Flags = {};
  for (const arg of args) {
    if (!arg.startsWith('--')) continue;
    const eqIndex = arg.indexOf('=');
    const key = eqIndex === -1 ? arg.slice(2) : arg.slice(2, eqIndex);
    flags[key] = eqIndex === -1 ? true : arg.slice(eqIndex + 1);
  }
  return flags;
}

function isSourceName(value: string): value is SourceName {
  return (SOURCES as readonly string[]).includes(value);
}

function parseSources(flags: Flags): SourceName[] | undefined {
  if (typeof flags.source !== 'string') return undefined;
  const requested = flags.source.split(',').map((s) => s.trim());
  const invalid = requested.filter((s) => !isSourceName(s));
  if (invalid.length > 0) {
    throw new Error(`Неизвестные источники: ${invalid.join(', ')}. Доступны: ${SOURCES.join(', ')}`);
  }
  return requested as SourceName[];
}

async function runDoctor(sources: SourceName[], headed: boolean): Promise<void> {
  console.log('Диагностика источников (использует сохранённые сессии из .sessions/):\n');
  for (const source of sources) {
    const url = SOURCE_CHECK_URLS[source];
    try {
      await withSession(source, { headless: !headed }, async (context) => {
        const page = await context.newPage();
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        const waited = await waitForClear(page, 10_000);
        const state = waited === 'challenge' ? await detectChallenge(page, response) : waited;
        console.log(`  ${source.padEnd(12)} ${state.toUpperCase()} (HTTP ${response?.status() ?? '?'})`);
      });
    } catch (err) {
      console.log(`  ${source.padEnd(12)} ERROR (${(err as Error).message})`);
    }
  }
}

async function unlockSession(source: SourceName): Promise<void> {
  console.log(`Открываю "${source}" в видимом браузере.`);
  console.log('Пройдите проверку/капчу и, если потребуется, выберите магазин доставки.');
  console.log('Когда каталог откроется нормально — вернитесь в терминал и нажмите Enter.\n');

  await withSession(source, { headless: false }, async (context) => {
    const page = await context.newPage();
    await page.goto(SOURCE_CHECK_URLS[source], { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await new Promise<void>((resolve) => {
      process.stdin.resume();
      process.stdin.once('data', () => resolve());
    });
  });

  console.log(`\nСессия для "${source}" сохранена в apps/parser/.sessions/${source}`);
}

function printSummary(results: Awaited<ReturnType<typeof runParser>>): void {
  console.log('\nИтоги прогона:');
  for (const result of results) {
    const suffix = result.error ? ` — ${result.error}` : '';
    console.log(
      `  ${result.source.padEnd(12)} ${result.status.toUpperCase().padEnd(8)} товаров: ${result.products.length}${suffix}`,
    );
  }
}

async function runDownloadImages(): Promise<void> {
  console.log('Загружаю data/latest.json…');
  const data = await loadLatestData();
  const totalImages = new Set(data.products.map((p) => p.imageUrl).filter(Boolean)).size;
  console.log(`Уникальных изображений: ${totalImages}`);

  let lastPercent = -1;
  const urlMap = await downloadProductImages(data.products, ({ processed, total, downloaded, skipped, failed }) => {
    const percent = Math.floor((processed / total) * 100);
    if (percent !== lastPercent) {
      lastPercent = percent;
      process.stdout.write(
        `\r  обработано: ${processed}/${total} (новых: ${downloaded}, уже были: ${skipped}, ошибок: ${failed}) — ${percent}%`,
      );
    }
  });
  console.log('');

  console.log(`Готово: ${urlMap.size} изображений в локальном кэше.`);
  console.log('Обновляю data/latest.json…');
  const updated = applyLocalImages(data, urlMap);
  await saveLatestData(updated);
  console.log('data/latest.json обновлён с локальными путями.');
}

async function runDownloadIcons(): Promise<void> {
  console.log('Загружаю data/latest.json…');
  const data = await loadLatestData();
  const retailers = new Set(data.products.map((p) => p.retailer).filter(Boolean));
  console.log(`Уникальных сетей: ${retailers.size}`);

  let lastPercent = -1;
  await downloadRetailerIcons(data.products, ({ processed, total, downloaded, skipped, failed }) => {
    const percent = total > 0 ? Math.floor((processed / total) * 100) : 100;
    if (percent !== lastPercent) {
      lastPercent = percent;
      process.stdout.write(
        `\r  обработано: ${processed}/${total} (новых: ${downloaded}, уже были: ${skipped}, ошибок: ${failed}) — ${percent}%`,
      );
    }
  });
  console.log('\nГотово. Манифест сохранён в apps/site/data/retailer-icons.json.');
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const first = argv[0];
  const hasSubcommand = first !== undefined && !first.startsWith('--');
  const command = hasSubcommand && first ? first : 'run';
  const flags = parseFlags(hasSubcommand ? argv.slice(1) : argv);
  const sources = parseSources(flags);

  switch (command) {
    case 'run': {
      if (flags.schedule) {
        startSchedule({ sources });
        return;
      }
      const results = await runParser({ sources });
      printSummary(results);
      return;
    }
    case 'doctor':
      await runDoctor(sources ?? [...SOURCES], Boolean(flags.headed));
      return;
    case 'session:unlock': {
      const only = sources?.length === 1 ? sources[0] : undefined;
      if (!only) {
        throw new Error('Укажите ровно один источник: --source=<name>');
      }
      await unlockSession(only);
      return;
    }
    case 'download-images': {
      await runDownloadImages();
      return;
    }
    case 'download-icons': {
      await runDownloadIcons();
      return;
    }
    default:
      throw new Error(`Неизвестная команда: "${command}". Доступны: run, doctor, session:unlock, download-images, download-icons`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
