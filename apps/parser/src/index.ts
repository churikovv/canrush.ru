#!/usr/bin/env node
import { reindexCatalog } from './reindex-catalog.js';
import 'dotenv/config';
import type { SourceName } from '@canrush/shared';
const SOURCES = ['edadeal'] as const;
import { parseCities, runRegionalParser } from './regions.js';
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
  if (flags.cities !== undefined && typeof flags.cities !== 'string') throw new Error('Укажите --cities=all или список городов.');
  const cities = typeof flags.cities === 'string' ? parseCities(flags.cities) : undefined;
  if (cities && sources && (sources.length !== 1 || sources[0] !== 'edadeal')) throw new Error('Региональный прогон поддерживает только --source=edadeal.');

  switch (command) {
    case 'run': {
      if (flags.schedule) {
        startSchedule({ sources, cities });
        return;
      }
      if (cities) {
        await runRegionalParser({ cities, force: flags.force === true }); return;
      }
      const results = await runParser({ sources });
      printSummary(results);
      return;
    }
    case 'reindex-catalog':
      await reindexCatalog(); return;
    case 'download-images': {
      await runDownloadImages();
      return;
    }
    case 'download-icons': {
      await runDownloadIcons();
      return;
    }
    default:
      throw new Error(`Неизвестная команда: "${command}". Доступны: run, reindex-catalog, download-images, download-icons`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
