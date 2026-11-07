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
  /** Opens the chat picker with `@bot <query>` typed in: the inline search, one tap away. */
  switch_inline_query?: string;
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
  return request<T>(token, method, { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }, 10_000);
}

/** The same call as multipart form data: for uploading a file (the /start video) rather than naming one. */
export async function callTelegramForm<T = unknown>(token: string, method: string, form: FormData): Promise<T> {
  return request<T>(token, method, { body: form }, 60_000);
}

async function request<T>(token: string, method: string, init: { headers?: Record<string, string>; body: string | FormData }, timeout: number): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${getTelegramApiUrl()}/bot${token}/${method}`, { method: 'POST', ...init, signal: AbortSignal.timeout(timeout) });
  } catch {
    throw new TelegramApiError(`${method}: network error`, 0);
  }
  const data = (await response.json().catch(() => null)) as TelegramResponse<T> | null;
  if (!data?.ok) {
    throw new TelegramApiError(`${method}: ${data?.description ?? `HTTP ${response.status}`}`, data?.error_code ?? response.status, data?.parameters?.retry_after);
  }
  return data.result as T;
}
