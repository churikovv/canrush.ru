import type { SourceAdapter, SourceName } from '@canrush/shared';
import { edadealAdapter } from './edadeal.js';
import { lavkaAdapter } from './lavka.js';

export const adapters: Partial<Record<SourceName, SourceAdapter>> = { edadeal: edadealAdapter, lavka: lavkaAdapter };
