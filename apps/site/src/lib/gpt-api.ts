/**
 * ChatGPT through gpt-api.ru — an OpenAI-compatible gateway reachable from a Russian server. The key (`GPT_API_KEY`) stays on
 * the server; without it the features that need it are off. Responses are never logged: they may echo request details.
 */
const API_URL = 'https://gpt-api.ru/v1';
/** Reads shelves best among the gateway's models (November 2026 trial on real store photos). */
export const GPT_VISION_MODEL = 'gpt-6.1-sol';

/** Seconds from `Retry-After`, at most 10: a longer wait is better spent filling the list by hand. */
const retryDelay = (header: string | null) => {
  const seconds = header?.trim() ? Number(header) : Number.NaN;
  return Math.min(Number.isFinite(seconds) ? Math.max(seconds, 0) : 2, 10) * 1000;
};

export interface AskOptions { image?: Buffer; maxTokens?: number; signal?: AbortSignal }
type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export class GptApiClient {
  constructor(private readonly key: string, readonly model = GPT_VISION_MODEL, private readonly fetcher: Fetch = fetch) {
    if (!key.trim()) throw new Error('Не задан GPT_API_KEY');
  }

  /**
   * One question, with a JPEG if given. The photo travels inside the request: nothing is uploaded or left behind to clean up.
   * `reasoning_effort: low` — a 2–3 times faster answer, and on shelves it read no worse than the default.
   */
  async ask(prompt: string, options: AskOptions = {}): Promise<string> {
    const content = options.image
      ? [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${options.image.toString('base64')}`, detail: 'high' } }]
      : prompt;
    const body = JSON.stringify({ model: this.model, reasoning_effort: 'low', max_tokens: options.maxTokens ?? 2000, messages: [{ role: 'user', content }] });
    for (let attempt = 0; ; attempt++) {
      const response = await this.fetcher(`${API_URL}/chat/completions`, {
        method: 'POST', headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json', Accept: 'application/json' }, body, signal: options.signal,
      });
      // The gateway already tries its other providers; one more try covers a short outage behind all of them, or its per-minute limit.
      if ((response.status === 429 || response.status === 502 || response.status === 503) && attempt === 0) {
        await response.body?.cancel();
        if (response.status === 429) await new Promise(resolve => setTimeout(resolve, retryDelay(response.headers.get('retry-after'))));
        continue;
      }
      if (response.status !== 200) { await response.body?.cancel(); throw new Error(`gpt_api_${response.status}`); }
      const text = (await response.json() as { choices?: { message?: { content?: unknown } }[] }).choices?.[0]?.message?.content;
      if (typeof text !== 'string') throw new Error('gpt_api_invalid');
      return text;
    }
  }
}

let shared: GptApiClient | null | undefined;
/** The process-wide client, or null when `GPT_API_KEY` is not set. */
export function getGptApi(): GptApiClient | null {
  if (shared === undefined) { const key = process.env.GPT_API_KEY?.trim(); shared = key ? new GptApiClient(key) : null; }
  return shared;
}
