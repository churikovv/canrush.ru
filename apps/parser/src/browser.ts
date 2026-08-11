import { chromium, type Browser, type BrowserContext } from 'playwright';
import { DEFAULT_USER_AGENT } from './http.js';

/**
 * Общий хелпер для адаптеров, которым приходится скрейпить страницы через
 * headless-браузер (нет стабильного публичного API у источника).
 */
export async function withBrowserContext<T>(
  fn: (context: BrowserContext) => Promise<T>,
): Promise<T> {
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: DEFAULT_USER_AGENT,
      locale: 'ru-RU',
      viewport: { width: 1366, height: 900 },
    });
    return await fn(context);
  } finally {
    await browser?.close();
  }
}
