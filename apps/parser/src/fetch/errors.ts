/** Источник требует прохождения капчи/challenge — нужен ручной session:unlock. */
export class ChallengeRequiredError extends Error {
  constructor(source: string, details?: string) {
    super(`[${source}] требуется прохождение проверки браузера${details ? `: ${details}` : ''}`);
    this.name = 'ChallengeRequiredError';
  }
}

/** Источник полностью заблокировал запросы (бан IP, 403/401 без челленджа). */
export class SourceBlockedError extends Error {
  constructor(source: string, details?: string) {
    super(`[${source}] источник заблокировал запросы${details ? `: ${details}` : ''}`);
    this.name = 'SourceBlockedError';
  }
}

/** Стратегия неприменима в текущих условиях (например, feedUrl не задан). */
export class StrategyNotApplicableError extends Error {
  constructor(source: string, strategy: string, details?: string) {
    super(`[${source}] стратегия "${strategy}" недоступна${details ? `: ${details}` : ''}`);
    this.name = 'StrategyNotApplicableError';
  }
}
