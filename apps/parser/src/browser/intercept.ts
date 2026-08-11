import type { Page, Response } from 'playwright';

export interface CollectJsonOptions<T> {
  url: string;
  /** Отбирает, какие сетевые ответы нас интересуют (по URL внутреннего API). */
  matchUrl: (url: string) => boolean;
  /** Кастомный парсинг ответа, по умолчанию response.json(). */
  parse?: (response: Response) => Promise<T>;
  waitAfterLoadMs?: number;
  /** Сколько раз прокрутить страницу, чтобы подтянуть ленивую пагинацию. */
  scrolls?: number;
  scrollDelayMs?: number;
}

export interface CollectJsonResult<T> {
  response: Response | null;
  items: T[];
}

/** Имитирует прокрутку страницы пользователем, чтобы подгрузить следующие страницы каталога. */
export async function autoScroll(page: Page, times = 6, delayMs = 800): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await page.mouse.wheel(0, 1800);
    await page.waitForTimeout(delayMs);
  }
}

/**
 * Открывает страницу и пассивно перехватывает JSON-ответы внутреннего API, которые
 * сама страница загружает при рендере/скролле (стратегия "intercept" — без прямых
 * запросов от нашего кода, только чтение того, что уже запросил браузер).
 */
export async function collectJsonResponses<T = unknown>(
  page: Page,
  options: CollectJsonOptions<T>,
): Promise<CollectJsonResult<T>> {
  const items: T[] = [];
  const parse = options.parse ?? ((response: Response) => response.json() as Promise<T>);

  const onResponse = (response: Response) => {
    if (!options.matchUrl(response.url())) return;
    parse(response)
      .then((json) => items.push(json))
      .catch(() => {
        // Ответ не JSON, пуст или уже потреблён другим слушателем — игнорируем.
      });
  };

  page.on('response', onResponse);
  let response: Response | null = null;
  try {
    response = await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(options.waitAfterLoadMs ?? 2000);
    await autoScroll(page, options.scrolls ?? 6, options.scrollDelayMs ?? 800);
  } finally {
    page.off('response', onResponse);
  }

  return { response, items };
}
