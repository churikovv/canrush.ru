import path from 'node:path';
import { chromium, type BrowserContext } from 'playwright';
import { DEFAULT_USER_AGENT } from '../http.js';

// apps/parser/src/browser/session.ts -> apps/parser/.sessions
const SESSIONS_DIR = path.resolve(import.meta.dirname, '../../.sessions');

export interface SessionOptions {
  /** headless=true (по умолчанию) — для регулярных прогонов на уже разблокированной сессии.
   *  headless=false — для session:unlock, когда человек вручную проходит капчу/челлендж. */
  headless?: boolean;
}

function sessionDir(source: string): string {
  return path.join(SESSIONS_DIR, source);
}

/**
 * Открывает persistent-контекст Chrome для источника: куки, localStorage и
 * пройденные антибот-челленджи сохраняются между запусками в .sessions/<source>.
 *
 * По умолчанию используется бандловый Chromium от Playwright. Если на машине
 * установлен настоящий Google Chrome, можно задать PARSER_BROWSER_CHANNEL=chrome
 * в .env — это дополнительно снижает вероятность детекта автоматизации.
 */
export async function withSession<T>(
  source: string,
  options: SessionOptions,
  fn: (context: BrowserContext) => Promise<T>,
): Promise<T> {
  const channel = process.env.PARSER_BROWSER_CHANNEL || undefined;

  const context = await chromium.launchPersistentContext(sessionDir(source), {
    headless: options.headless ?? true,
    channel,
    userAgent: DEFAULT_USER_AGENT,
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    viewport: { width: 1366, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });

  try {
    return await fn(context);
  } finally {
    await context.close();
  }
}

export { SESSIONS_DIR, sessionDir };
