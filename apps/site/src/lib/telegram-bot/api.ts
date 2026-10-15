import { getTelegramApiUrl } from '@/lib/env';

export class TelegramApiError extends Error {
  constructor(message: string, readonly code: number, readonly retryAfter?: number) {
    super(message);
    this.name = 'TelegramApiError';
  }
}

export interface InlineButton {
  text: string;
  url?: string;
  web_app?: { url: string };
  callback_data?: string;
}
export type InlineKeyboard = InlineButton[][];

interface TelegramResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
  parameters?: { retry_after?: number };
}

/** Calls the Bot API. Errors never include the request URL, so the token cannot leak into logs. */
export async function callTelegram<T = unknown>(token: string, method: string, body: Record<string, unknown>): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${getTelegramApiUrl()}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new TelegramApiError(`${method}: network error`, 0);
  }
  const data = (await response.json().catch(() => null)) as TelegramResponse<T> | null;
  if (!data?.ok) {
    throw new TelegramApiError(`${method}: ${data?.description ?? `HTTP ${response.status}`}`, data?.error_code ?? response.status, data?.parameters?.retry_after);
  }
  return data.result as T;
}
