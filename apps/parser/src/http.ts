import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios';
import pRetry from 'p-retry';

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface HttpGetOptions extends AxiosRequestConfig {
  retries?: number;
}

/**
 * GET-запрос с повторными попытками (backoff) и реалистичным User-Agent.
 * Используется адаптерами, у которых есть публичный JSON API.
 */
export async function httpGet<T = unknown>(
  url: string,
  options: HttpGetOptions = {},
): Promise<AxiosResponse<T>> {
  const { retries = 3, headers, ...rest } = options;

  return pRetry(
    () =>
      axios.get<T>(url, {
        timeout: 15_000,
        headers: {
          'User-Agent': DEFAULT_USER_AGENT,
          Accept: 'application/json, text/plain, */*',
          ...headers,
        },
        ...rest,
      }),
    { retries },
  );
}

/** Пауза между запросами, чтобы не создавать чрезмерную нагрузку на источник. */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { DEFAULT_USER_AGENT };
