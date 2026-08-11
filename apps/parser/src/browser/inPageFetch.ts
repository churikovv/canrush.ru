import type { Page } from 'playwright';

/**
 * Выполняет fetch() внутри контекста уже открытой страницы (стратегия "in_page_fetch").
 * Куки, заголовки и анти-бот токены текущей сессии подставляет сам браузер —
 * мы просто просим его дёрнуть внутренний JSON API так, как это делает сама страница.
 */
export async function fetchJsonInPage<T = unknown>(
  page: Page,
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: string } = {},
): Promise<T> {
  const result = await page.evaluate(
    async ({ url, init }) => {
      const res = await fetch(url, { ...init, credentials: 'include' });
      const text = await res.text();
      return { status: res.status, ok: res.ok, text };
    },
    { url, init },
  );

  if (!result.ok) {
    throw new Error(`in-page fetch ${url} -> HTTP ${result.status}`);
  }

  try {
    return JSON.parse(result.text) as T;
  } catch (err) {
    throw new Error(`in-page fetch ${url}: ответ не JSON (${(err as Error).message})`);
  }
}
