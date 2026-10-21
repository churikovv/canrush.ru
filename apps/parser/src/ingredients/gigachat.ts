import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { request } from 'node:https';
import path from 'node:path';

const OAUTH_URL = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';
const API_URL = 'https://gigachat.devices.sberbank.ru/api/v1';
/** GigaChat serves certificates of the Russian Trusted Root CA; it is trusted for these requests only, never globally. */
const CA_FILE = path.resolve(import.meta.dirname, '../../certs/russian_trusted_root_ca.pem');

export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }
type Post = (url: string, headers: Record<string, string>, body: string) => Promise<{ status: number; body: string }>;

function httpsPost(ca: string): Post {
  return (url, headers, body) => new Promise((resolve, reject) => {
    const req = request(url, { method: 'POST', headers: { ...headers, 'Content-Length': Buffer.byteLength(body) }, ca, timeout: 60_000 }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('timeout', () => req.destroy(new Error('gigachat_timeout')));
    req.on('error', reject);
    req.end(body);
  });
}

/**
 * The Authorization key from the Sber cabinet is permanent; the access token it buys lives 30 minutes.
 * The token stays in memory and is renewed a minute before `expires_at` or after a 401.
 */
export class GigaChatClient {
  private token: { value: string; expiresAt: number } | null = null;
  private readonly post: Post;

  constructor(private readonly authKey: string, readonly model = 'GigaChat-2', post?: Post, private readonly now = () => Date.now()) {
    if (!authKey.trim()) throw new Error('Не задан GIGACHAT_AUTH_KEY');
    this.post = post ?? httpsPost(readFileSync(CA_FILE, 'utf8'));
  }

  async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt - 60_000 > this.now()) return this.token.value;
    const response = await this.post(OAUTH_URL, {
      'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json',
      RqUID: randomUUID(), Authorization: `Basic ${this.authKey}`,
    }, new URLSearchParams({ scope: 'GIGACHAT_API_PERS' }).toString());
    // Never echo the response: on errors it may repeat request details.
    if (response.status !== 200) throw new Error(`gigachat_oauth_${response.status}`);
    const json = JSON.parse(response.body) as { access_token?: unknown; expires_at?: unknown };
    if (typeof json.access_token !== 'string' || typeof json.expires_at !== 'number') throw new Error('gigachat_oauth_invalid');
    this.token = { value: json.access_token, expiresAt: json.expires_at };
    return json.access_token;
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const body = JSON.stringify({ model: this.model, messages, temperature: 0.1, max_tokens: 400 });
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
