/** Источник полностью заблокировал запросы (бан IP, 403/401 без челленджа). */
export class SourceBlockedError extends Error {
  constructor(source: string, details?: string) {
    super(`[${source}] источник заблокировал запросы${details ? `: ${details}` : ''}`);
    this.name = 'SourceBlockedError';
  }
}

/** Стратегия неприменима в текущих условиях (например, регион не поддерживается). */
export class StrategyNotApplicableError extends Error {
  constructor(source: string, strategy: string, details?: string) {
    super(`[${source}] стратегия "${strategy}" недоступна${details ? `: ${details}` : ''}`);
    this.name = 'StrategyNotApplicableError';
  }
}
