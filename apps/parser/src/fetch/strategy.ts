import type { FetchStrategyName, Product, SourceName, SourceQueryConfig } from '@canrush/shared';
import { ChallengeRequiredError, SourceBlockedError, StrategyNotApplicableError } from './errors.js';

export interface StrategyContext {
  source: SourceName;
  config: SourceQueryConfig;
}

export type StrategyFn = (ctx: StrategyContext) => Promise<Product[]>;

export interface StrategyDefinition {
  name: FetchStrategyName;
  run: StrategyFn;
}

export interface StrategyResult {
  strategy: FetchStrategyName;
  products: Product[];
}

/**
 * Прогоняет "живые" стратегии адаптера по порядку (feed → intercept → in_page_fetch)
 * до первого успеха. "Мягкие" ошибки (недоступна/заблокирована/нужен челлендж) не
 * прерывают цепочку — переходим к следующей стратегии. Если все стратегии исчерпаны,
 * бросаем SourceBlockedError — на этом уровне run.ts решает, откатиться ли на
 * последние сохранённые данные (стратегия "cached", см. src/run.ts).
 */
export async function runStrategies(
  ctx: StrategyContext,
  strategies: StrategyDefinition[],
): Promise<StrategyResult> {
  if (strategies.length === 0) {
    throw new SourceBlockedError(ctx.source, 'для источника не задано ни одной стратегии');
  }

  const softErrors: string[] = [];

  for (const strategy of strategies) {
    try {
      const products = await strategy.run(ctx);
      return { strategy: strategy.name, products };
    } catch (err) {
      if (
        err instanceof StrategyNotApplicableError ||
        err instanceof ChallengeRequiredError ||
        err instanceof SourceBlockedError
      ) {
        softErrors.push(err.message);
        continue;
      }
      throw err;
    }
  }

  throw new SourceBlockedError(
    ctx.source,
    softErrors.length > 0 ? softErrors.join('; ') : 'все стратегии недоступны',
  );
}
