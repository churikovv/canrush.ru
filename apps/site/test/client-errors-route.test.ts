import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

process.env.DATABASE_URL = 'postgresql://localhost:5432/canrush_site_test';
process.env.BETTER_AUTH_URL = 'https://canrush.test';
process.env.BETTER_AUTH_SECRET = 'canrush-integration-test-secret-32-bytes-minimum';

const recordError = vi.fn(async () => undefined);
vi.mock('@/lib/error-log', () => ({ recordError }));
const { POST } = await import('../src/app/api/client-errors/route');

let ip = 0;
const post = (body: string, headers: Record<string, string> = {}, address = `10.0.0.${++ip}`) => POST(new NextRequest('https://canrush.test/api/client-errors', {
  method: 'POST', body, headers: { origin: 'https://canrush.test', 'x-real-ip': address, ...headers },
}));
const report = JSON.stringify({ path: '/catalog/burn?token=x', message: 'boom', stack: 'at f (https://canrush.test/a.js:1:2)' });

beforeEach(() => recordError.mockClear());

it('records a cleaned report from the site', async () => {
  expect((await post(report)).status).toBe(204);
  expect(recordError).toHaveBeenCalledWith({ source: 'client', path: '/catalog/burn', scope: '/catalog', message: 'boom', stack: 'at f (https://canrush.test/a.js:1:2)' });
});

it('accepts nothing from other sites or bots', async () => {
  expect((await post(report, { origin: 'https://evil.example' })).status).toBe(403);
  expect((await post(report, { 'sec-fetch-site': 'cross-site' })).status).toBe(403);
  expect((await post(report, { 'user-agent': 'Googlebot/2.1' })).status).toBe(204);
  expect(recordError).not.toHaveBeenCalled();
});

it('refuses malformed and oversized reports', async () => {
  expect((await post('not json')).status).toBe(400);
  expect((await post('{"path":"/"}')).status).toBe(400);
  expect((await post(JSON.stringify({ path: '/', message: 'x'.repeat(40_000) }))).status).toBe(413);
  expect(recordError).not.toHaveBeenCalled();
});

it('limits one address and answers 503 when the database is away', async () => {
  const statuses = [];
  for (let attempt = 0; attempt < 11; attempt++) statuses.push((await post(report, {}, '10.9.9.9')).status);
  expect(statuses.filter(status => status === 204)).toHaveLength(10);
  expect(statuses.at(-1)).toBe(429);
  recordError.mockRejectedValueOnce(new Error('down'));
  expect((await post(report)).status).toBe(503);
});
