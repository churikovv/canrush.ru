import { randomUUID } from 'node:crypto';
import { request } from 'node:https';
import { RUSSIAN_TRUSTED_ROOT_CA } from '@/lib/gigachat-ca';

/**
 * GigaChat for the site — the parser's client (apps/parser/src/ingredients/gigachat.ts) with a longer answer allowed.
 * The permanent Authorization key (`GIGACHAT_AUTH_KEY`) buys a 30-minute access token kept in memory; without the key
 * the features that need it are off. Responses are never logged: they may echo request details.
 */
const OAUTH_URL = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';
const API_URL = 'https://gigachat.devices.sberbank.ru/api/v1';

export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }
type Post = (url: string, headers: Record<string, string>, body: string) => Promise<{ status: number; body: string }>;

const httpsPost: Post = (url, headers, body) => new Promise((resolve, reject) => {
  const req = request(url, { method: 'POST', headers: { ...headers, 'Content-Length': Buffer.byteLength(body) }, ca: RUSSIAN_TRUSTED_ROOT_CA, timeout: 60_000 }, res => {
    const chunks: Buffer[] = [];
    res.on('data', (chunk: Buffer) => chunks.push(chunk));
    res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }));
  });
  req.on('timeout', () => req.destroy(new Error('gigachat_timeout')));
  req.on('error', reject);
  req.end(body);
});

export class GigaChatClient {
  private token: { value: string; expiresAt: number } | null = null;
  constructor(private readonly authKey: string, readonly model = 'GigaChat-2', private readonly post: Post = httpsPost, private readonly now = () => Date.now()) {
    if (!authKey.trim()) throw new Error('Не задан GIGACHAT_AUTH_KEY');
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt - 60_000 > this.now()) return this.token.value;
    const response = await this.post(OAUTH_URL, {
      'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', RqUID: randomUUID(), Authorization: `Basic ${this.authKey}`,
    }, new URLSearchParams({ scope: 'GIGACHAT_API_PERS' }).toString());
    if (response.status !== 200) throw new Error(`gigachat_oauth_${response.status}`);
    const json = JSON.parse(response.body) as { access_token?: unknown; expires_at?: unknown };
    if (typeof json.access_token !== 'string' || typeof json.expires_at !== 'number') throw new Error('gigachat_oauth_invalid');
    this.token = { value: json.access_token, expiresAt: json.expires_at };
    return json.access_token;
  }

  async chat(messages: ChatMessage[], options: { maxTokens?: number; temperature?: number } = {}): Promise<string> {
    const body = JSON.stringify({ model: this.model, messages, temperature: options.temperature ?? 0.2, max_tokens: options.maxTokens ?? 400 });
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await this.post(`${API_URL}/chat/completions`, {
        'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${await this.accessToken()}`,
      }, body);
      if (response.status === 401 && attempt === 0) { this.token = null; continue; }
      if (response.status !== 200) throw new Error(`gigachat_chat_${response.status}`);
      const content = (JSON.parse(response.body) as { choices?: { message?: { content?: unknown } }[] }).choices?.[0]?.message?.content;
      if (typeof content !== 'string') throw new Error('gigachat_chat_invalid');
      return content;
    }
    throw new Error('gigachat_unauthorized');
  }
}

let shared: GigaChatClient | null | undefined;
/** The process-wide client, or null when `GIGACHAT_AUTH_KEY` is not set. */
export function getGigaChat(): GigaChatClient | null {
  if (shared === undefined) { const key = process.env.GIGACHAT_AUTH_KEY?.trim(); shared = key ? new GigaChatClient(key) : null; }
  return shared;
}

let sharedMax: GigaChatClient | null | undefined;
/**
 * GigaChat-2-Max, the larger model, for checks where the small one is too careless (duplicate drinks: on real requests
 * it found more twins and called fewer different drinks the same). Null without `GIGACHAT_AUTH_KEY`.
 */
export function getGigaChatMax(): GigaChatClient | null {
  if (sharedMax === undefined) { const key = process.env.GIGACHAT_AUTH_KEY?.trim(); sharedMax = key ? new GigaChatClient(key, 'GigaChat-2-Max') : null; }
  return sharedMax;
}
