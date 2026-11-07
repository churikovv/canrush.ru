import { latestHistoryDay, refreshPriceIndex } from '@/lib/price-index';

const CHECK_EVERY_MS = 60 * 60_000;
let running = false;
let done: string | null = null;

/**
 * «Индекс цен»: once an hour, when the parser has written a new day, the index is computed again
 * (`refreshPriceIndex`: only the new day's files are read in full, the rest come from compact copies).
 * Started from `instrumentation.ts` in production unless `PRICE_INDEX_WORKER=off`; in development only with `=on`.
 */
export function startPriceIndexWorker(): void {
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const latest = await latestHistoryDay();
      if (!latest || latest === done) return;
      const data = await refreshPriceIndex();
      done = latest;
      if (data) console.info(`[price-index] ${data.current.month}: ${data.current.positions.length} positions, ${data.current.days.length} days`);
    } catch (error) { console.error('[price-index] run failed', error instanceof Error ? error.message : 'unknown'); }
    finally { running = false; }
  };
  setTimeout(() => void tick(), 3 * 60_000).unref();
  setInterval(() => void tick(), CHECK_EVERY_MS).unref();
}
