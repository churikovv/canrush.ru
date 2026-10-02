import type { AdapterRunResult, SourceName } from '@canrush/shared';
import { adapters } from './adapters/index.js';
import { loadProductsConfig } from './config.js';
import { delay } from './http.js';
import { notifySourceIssue } from './notify.js';
import { applyRunResult, loadState, saveState } from './state.js';
import { mergeWithPrevious, saveHistorySnapshot, saveLatest, saveRawSnapshot } from './storage.js';

export interface RunOptions {
  /** Ограничить прогон конкретными источниками (по умолчанию — все из конфига). */
  sources?: SourceName[];
  /** Базовая задержка между источниками, мс (плюс случайный джиттер до +2с). */
  delayMsBetweenSources?: number;
}

/**
 * Прогоняет по очереди адаптеры всех (или выбранных) источников, изолируя ошибки:
 * падение одного источника не мешает остальным. Результат каждого источника
 * сохраняется в data/raw/, состояние — в data/state.json, а итоговый срез
 * (с учётом stale-фоллбэка на предыдущие данные) — в data/latest.json и data/history/.
 */
export async function runParser(options: RunOptions = {}): Promise<AdapterRunResult[]> {
  const config = loadProductsConfig();
  const targets = options.sources ?? ['edadeal'];
  if (targets.some(source => source !== 'edadeal')) throw new Error('Поддерживается только источник edadeal.');
  const delayMs = options.delayMsBetweenSources ?? 3000;

  let state = await loadState();
  const results: AdapterRunResult[] = [];

  for (const [i, source] of targets.entries()) {
    const adapter = adapters[source];
    const sourceConfig = config.sources[source];
    // Глобальные keywords/brands из products.json — запасной вариант, если у
    // источника не заданы свои (используется фидами и определением бренда).
    const effectiveConfig = sourceConfig && {
      ...sourceConfig,
      keywords: sourceConfig.keywords ?? config.keywords,
      brands: sourceConfig.brands ?? config.brands,
      brandAliases: sourceConfig.brandAliases ?? config.brandAliases,
      flavors: sourceConfig.flavors ?? config.flavors,
      flavorAliases: sourceConfig.flavorAliases ?? config.flavorAliases,
    };
    const startedAt = new Date().toISOString();

    let result: AdapterRunResult;
    if (!adapter || !effectiveConfig) {
      console.warn(`[canrush-parser] пропускаю "${source}": нет адаптера или конфига`);
      result = {
        source,
        status: 'error',
        products: [],
        error: 'адаптер или конфиг источника не найден',
        startedAt,
        finishedAt: new Date().toISOString(),
      };
    } else {
      try {
        const { products, strategyUsed } = await adapter.fetchPrices(effectiveConfig);
        result = {
          source,
          status: 'ok',
          strategyUsed,
          products,
          startedAt,
          finishedAt: new Date().toISOString(),
        };
        console.log(`[canrush-parser] ${source}: ok (${strategyUsed}), товаров: ${products.length}`);
      } catch (err) {
        const hadPreviousSuccess = Boolean(state.sources[source]?.lastSuccessAt);
        result = {
          source,
          status: hadPreviousSuccess ? 'stale' : 'blocked',
          products: [],
          error: (err as Error).message,
          startedAt,
          finishedAt: new Date().toISOString(),
        };
        await notifySourceIssue(result);
      }
    }

    results.push(result);
    await saveRawSnapshot(result);
    state = applyRunResult(state, result);
    await saveState(state);

    const isLast = i === targets.length - 1;
    if (!isLast) {
      await delay(delayMs + Math.random() * 2000);
    }
  }

  const merged = await mergeWithPrevious(results);
  await saveLatest(merged);
  await saveHistorySnapshot(merged);

  return results;
}
