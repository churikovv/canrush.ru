import { expect, it } from 'vitest';
import { cleanErrorMessage, cleanErrorPath, cleanErrorStack, errorGroupHash, errorText, isErrorGroupHash, isIgnoredError, parseClientErrorReport, serverErrorReport } from '../src/lib/error-log-fields';

it('removes what identifies a person or opens a door from a message', () => {
  const clean = cleanErrorMessage('fail for ivan@example.com at https://user:hunter2@db.local/app?token=abc#x, Bearer abc.def token=s3cr3t password: qwerty id 7d1f3c2a-8b4e-4f6a-9c1d-2e3f4a5b6c7d phone +7 (916) 123-45-67 key AAEabcdefghijklmnopqrstuvwxyz0123456789');
  for (const secret of ['ivan@', 'hunter2', 'abc#x', 'abc.def', 's3cr3t', 'qwerty', '7d1f3c2a', '916', 'AAEabc']) expect(clean).not.toContain(secret);
  expect(clean).toContain('https://db.local/app');
  expect(clean).toContain('[почта]');
});

it('caps the message and survives an empty one', () => {
  expect(cleanErrorMessage('x '.repeat(1000)).length).toBeLessThanOrEqual(500);
  expect(cleanErrorMessage('   ')).toBe('Ошибка без описания');
});

it('groups the same failure for different rows', () => {
  const group = (id: number) => errorGroupHash({ source: 'server', scope: '/catalog/[slug]', message: cleanErrorMessage(`Row ${id} not found`) });
  expect(group(123456)).toBe(group(987654));
  expect(isErrorGroupHash(group(123456))).toBe(true);
  expect(isErrorGroupHash("1' or 1=1")).toBe(false);
  // Another route or another side of the network is another group.
  expect(errorGroupHash({ source: 'server', scope: '/a', message: 'x' })).not.toBe(errorGroupHash({ source: 'server', scope: '/b', message: 'x' }));
  expect(errorGroupHash({ source: 'server', scope: '/a', message: 'x' })).not.toBe(errorGroupHash({ source: 'client', scope: '/a', message: 'x' }));
});

it('keeps frames of a stack, not its message, and no queries', () => {
  const stack = cleanErrorStack(`Error: secret text ivan@example.com
second line of the message
    at load (https://canrush.ru/_next/static/chunks/a.js?dpl=abc:1:234567)
    at async Promise.all (index 0)`);
  expect(stack).toBe('at load (https://canrush.ru/_next/static/chunks/a.js:1:234567)\nat async Promise.all (index 0)');
  expect(cleanErrorStack('load@https://canrush.ru/_next/static/chunks/a.js:1:234567')).toContain(':1:234567');
  expect(cleanErrorStack(undefined)).toBe('');
});

it('keeps the path of a page without its query, nick or ids', () => {
  expect(cleanErrorPath('/auth/confirm?token=abc#top')).toBe('/auth/confirm');
  expect(cleanErrorPath('/profile/ivan/calendar?month=2026-10')).toBe('/profile/[ник]/calendar');
  expect(cleanErrorPath('/profile/settings')).toBe('/profile/settings');
  expect(cleanErrorPath('/messages/7d1f3c2a-8b4e-4f6a-9c1d-2e3f4a5b6c7d')).toBe('/messages/[id]');
  expect(cleanErrorPath('/api/market-photos/1234567')).toBe('/api/market-photos/[id]');
  expect(cleanErrorPath('/catalog/red-bull-original-sugarfree-limited-edition-350')).toBe('/catalog/red-bull-original-sugarfree-limited-edition-350');
  expect(cleanErrorPath('https://evil.example/x')).toBe('/');
});

it('reads the cause of an error and prints nothing of a thrown object', () => {
  expect(errorText(new TypeError('fetch failed', { cause: new Error('connect ECONNREFUSED') }))).toBe('TypeError: fetch failed ← connect ECONNREFUSED');
  expect(errorText({ body: 'private' })).toBe('Ошибка без описания');
  expect(errorText('boom')).toBe('boom');
});

it('ignores control flow of Next and dropped connections', () => {
  expect(isIgnoredError(Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;/sign-in;307;' }))).toBe(true);
  expect(isIgnoredError(Object.assign(new Error('x'), { digest: 'NEXT_HTTP_ERROR_FALLBACK;404' }))).toBe(true);
  expect(isIgnoredError(Object.assign(new Error('aborted'), { name: 'AbortError' }))).toBe(true);
  expect(isIgnoredError(new Error('Failed to find Server Action "4072d38f". This request might be from an older or newer deployment.'))).toBe(true);
  expect(isIgnoredError(Object.assign(new Error('real'), { digest: '2843918' }))).toBe(false);
  expect(isIgnoredError('text')).toBe(false);
});

it('groups server errors by route and browser errors by section', () => {
  const server = serverErrorReport(new Error('boom'), '/catalog/burn?x=1', '/catalog/[slug]');
  expect(server).toMatchObject({ source: 'server', path: '/catalog/burn', scope: '/catalog/[slug]', message: 'boom' });
  expect(serverErrorReport(new Error('boom'), '/proxy-path').scope).toBe('/proxy-path');
  expect(parseClientErrorReport({ path: '/catalog/burn', message: 'boom' })).toMatchObject({ source: 'client', path: '/catalog/burn', scope: '/catalog', stack: '' });
});

it('rejects a browser report that is not one', () => {
  for (const body of [null, 'text', {}, { path: '/', message: '' }, { path: 1, message: 'x' }, { path: '/', message: 2 }]) expect(parseClientErrorReport(body)).toBeNull();
});
