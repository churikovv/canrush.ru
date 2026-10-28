import { getGigaChatMax } from '@/lib/gigachat';
import { runDrinkChecks } from '@/lib/drink-duplicate-check';
import { runCardChecks } from '@/lib/catalog-card-check';

const CHECK_EVERY_MS = 10 * 60_000;
let running = false;

/**
 * The neural network's duplicate check catches up every ten minutes: requests a sent-time check missed, drinks edited
 * since their check and, a batch at a time, the published ones («Возможные дубли»); then the parser's cards
 * (`runCardChecks`: sure duplicates merged, the rest to the moderators). Off without the model key, with
 * `DRINK_CHECK_WORKER=off`, and in development unless `DRINK_CHECK_WORKER=on`.
 */
export function startDrinkCheckWorker(): void {
  const client = getGigaChatMax();
  if (!client) return;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const result = await runDrinkChecks(client);
      if (result.checked || result.failed) console.info(`[drink-check] checked ${result.checked}, failed ${result.failed}`);
      // Then the parser's cards: sure duplicates are merged on their own, the rest waits in «Карточки каталога».
      const cards = await runCardChecks(client);
      if (cards.checked || cards.failed) console.info(`[card-check] checked ${cards.checked}, merged ${cards.merged}, failed ${cards.failed}`);
    } catch (error) {
      console.error('[drink-check] run failed', error instanceof Error ? error.message : 'unknown');
    } finally { running = false; }
  };
  setTimeout(() => void tick(), 90_000).unref();
  setInterval(() => void tick(), CHECK_EVERY_MS).unref();
}
