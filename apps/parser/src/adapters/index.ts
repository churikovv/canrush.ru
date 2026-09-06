import type { SourceAdapter, SourceName } from '@canrush/shared';
import { edadealAdapter } from './edadeal.js';
import { lentaAdapter } from './lenta.js';
import { magnitAdapter } from './magnit.js';
import { ozonAdapter } from './ozon.js';
import { pyaterochkaAdapter } from './pyaterochka.js';
import { wildberriesAdapter } from './wildberries.js';

/** Реестр адаптеров источников, используемый оркестратором (src/run.ts). */
export const adapters: Partial<Record<SourceName, SourceAdapter>> = {
  wildberries: wildberriesAdapter,
  ozon: ozonAdapter,
  pyaterochka: pyaterochkaAdapter,
  magnit: magnitAdapter,
  lenta: lentaAdapter,
  edadeal: edadealAdapter,
};
