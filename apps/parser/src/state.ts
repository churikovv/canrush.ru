import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AdapterRunResult, ParserState, SourceState } from '@canrush/shared';
import { DATA_DIR } from './storage.js';

const STATE_PATH = path.join(DATA_DIR, 'state.json');

/** Читает data/state.json; если файла ещё нет — возвращает пустое состояние. */
export async function loadState(): Promise<ParserState> {
  try {
    const raw = await readFile(STATE_PATH, 'utf-8');
    return JSON.parse(raw) as ParserState;
  } catch {
    return { updatedAt: new Date().toISOString(), sources: {} };
  }
}

export async function saveState(state: ParserState): Promise<void> {
  await mkdir(path.dirname(STATE_PATH), { recursive: true });
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
}

/** Обновляет запись состояния для одного источника по результату его прогона. */
export function applyRunResult(state: ParserState, result: AdapterRunResult): ParserState {
  const prev = state.sources[result.source];
  const next: SourceState = {
    source: result.source,
    status: result.status,
    strategyUsed: result.strategyUsed ?? prev?.strategyUsed,
    lastAttemptAt: result.finishedAt,
    lastSuccessAt: result.status === 'ok' ? result.finishedAt : prev?.lastSuccessAt,
    lastError: result.error ?? (result.status === 'ok' ? undefined : prev?.lastError),
  };

  return {
    updatedAt: new Date().toISOString(),
    sources: { ...state.sources, [result.source]: next },
  };
}

export { STATE_PATH };
