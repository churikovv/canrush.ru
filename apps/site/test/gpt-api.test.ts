import { describe, expect, it } from 'vitest';
import { GptApiClient } from '../src/lib/gpt-api';

function gateway(statuses: number[]) {
  const requests: { url: string; init: RequestInit }[] = [];
  const fetcher = async (url: string, init: RequestInit) => {
    requests.push({ url, init });
    const status = statuses.shift() ?? 200;
    return new Response(JSON.stringify(status === 200 ? { choices: [{ message: { content: '[]' } }] } : { error: { message: 'busy' } }), { status, headers: status === 429 ? { 'Retry-After': '0' } : {} });
  };
  return { requests, fetcher };
}

describe('gpt-api.ru client', () => {
  it('asks the fast mode and sends the photo inside the request', async () => {
    const { requests, fetcher } = gateway([200]);
    await expect(new GptApiClient('key', 'gpt-6.1-sol', fetcher).ask('Что на фото?', { image: Buffer.from('jpeg'), maxTokens: 4000 })).resolves.toBe('[]');
    expect(requests[0]?.url).toBe('https://gpt-api.ru/v1/chat/completions');
    expect((requests[0]?.init.headers as Record<string, string>).Authorization).toBe('Bearer key');
    const body = JSON.parse(String(requests[0]?.init.body));
    expect(body).toMatchObject({ model: 'gpt-6.1-sol', reasoning_effort: 'low', max_tokens: 4000 });
    expect(body.messages[0].content).toEqual([
      { type: 'text', text: 'Что на фото?' },
      { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${Buffer.from('jpeg').toString('base64')}`, detail: 'high' } },
    ]);
  });

  it('sends a question without a photo as plain text', async () => {
    const { requests, fetcher } = gateway([200]);
    await new GptApiClient('key', 'gpt-6.1-sol', fetcher).ask('Какой номер?');
    expect(JSON.parse(String(requests[0]?.init.body)).messages).toEqual([{ role: 'user', content: 'Какой номер?' }]);
  });

  it('retries a gateway outage or limit once and reports other errors by status', async () => {
    const outage = gateway([503, 200]);
    await expect(new GptApiClient('key', 'gpt-6.1-sol', outage.fetcher).ask('?')).resolves.toBe('[]');
    expect(outage.requests).toHaveLength(2);
    await expect(new GptApiClient('key', 'gpt-6.1-sol', gateway([502, 502]).fetcher).ask('?')).rejects.toThrow('gpt_api_502');
    const limited = gateway([429, 429]);
    await expect(new GptApiClient('key', 'gpt-6.1-sol', limited.fetcher).ask('?')).rejects.toThrow('gpt_api_429');
    expect(limited.requests).toHaveLength(2);
    const denied = gateway([401]);
    await expect(new GptApiClient('key', 'gpt-6.1-sol', denied.fetcher).ask('?')).rejects.toThrow('gpt_api_401');
    expect(denied.requests).toHaveLength(1);
  });

  it('needs a key', () => {
    expect(() => new GptApiClient(' ')).toThrow('GPT_API_KEY');
  });
});
