import type { Page, Request } from 'playwright';

/**
 * Слушает исходящие запросы страницы к urlPrefix и возвращает значения заданных
 * заголовков из первого подходящего запроса. Это не подмена/генерация токенов —
 * мы читаем заголовки, которые сама SPA уже отправляет в рамках обычной работы
 * (приём применяется, например, в справочной реализации pyaterochka_api).
 */
export async function sniffRequestHeaders(
  page: Page,
  urlPrefix: string,
  headerNames: string[],
  timeoutMs = 12_000,
): Promise<Record<string, string>> {
  return new Promise((resolve) => {
    const found: Record<string, string> = {};
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      page.off('request', onRequest);
      resolve(found);
    };

    const onRequest = (request: Request) => {
      if (!request.url().startsWith(urlPrefix)) return;
      const headers = request.headers();
      for (const name of headerNames) {
        const value = headers[name.toLowerCase()];
        if (value) found[name] = value;
      }
      if (headerNames.every((name) => found[name])) finish();
    };

    page.on('request', onRequest);
    setTimeout(finish, timeoutMs);
  });
}
