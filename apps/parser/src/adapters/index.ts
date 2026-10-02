import type { SourceAdapter, SourceName } from '@canrush/shared';
import { edadealAdapter } from './edadeal.js';

export const adapters: Partial<Record<SourceName, SourceAdapter>> = { edadeal: edadealAdapter };
