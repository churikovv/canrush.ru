import robotsParserImport from 'robots-parser';
import { httpGet } from './http.js';

interface Robot {
  isAllowed(url: string, ua?: string): boolean | undefined;
}

// Типы, которые поставляет сам пакет robots-parser, некорректно описывают его
// CommonJS-экспорт (module.exports = function). Приводим к реальной сигнатуре явно.
const robotsParser = robotsParserImport as unknown as (url: string, robotstxt: string) => Robot;

const cache = new Map<string, Robot>();

async function getRobots(origin: string) {
  const cached = cache.get(origin);
  if (cached) return cached;

  const robotsUrl = new URL('/robots.txt', origin).toString();
  try {
    const { data } = await httpGet<string>(robotsUrl, { retries: 1, responseType: 'text' });
    const parsed = robotsParser(robotsUrl, typeof data === 'string' ? data : String(data));
    cache.set(origin, parsed);
    return parsed;
  } catch {
    // Если robots.txt недоступен — не блокируем адаптер, считаем всё разрешённым.
    const permissive = robotsParser(robotsUrl, '');
    cache.set(origin, permissive);
    return permissive;
  }
}

/**
 * Проверяет, разрешён ли данный URL по robots.txt источника для нашего User-Agent.
 * Используется адаптерами перед обращением к разделам сайта (например, у Магнита
 * запрещён путь /*search — значит по каталогу/категориям ходим, а по поиску нет).
 */
export async function isAllowedByRobots(url: string, userAgent = '*'): Promise<boolean> {
  const origin = new URL(url).origin;
  const robots = await getRobots(origin);
  const allowed = robots.isAllowed(url, userAgent);
  // isAllowed может вернуть undefined, если правило не найдено — трактуем как разрешено.
  return allowed !== false;
}
