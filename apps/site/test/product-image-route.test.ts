import { expect, it, vi } from 'vitest';
vi.mock('node:fs/promises', () => ({ readFile: vi.fn() }));
import { readFile } from 'node:fs/promises';
import { GET } from '../src/app/images/products/[filename]/route';
const read = vi.mocked(readFile);
const request = (filename: string) => GET(new Request('http://localhost/images/products/test'), { params: Promise.resolve({ filename }) });
it('does not cache missing images and reads newly added images on the next request', async () => {
  read.mockRejectedValueOnce(Object.assign(new Error('missing'), { code: 'ENOENT' }));
  const filename = `${'a'.repeat(64)}.jpg`;
  const missing = await request(filename);
  expect(missing.status).toBe(404);
  expect(missing.headers.get('cache-control')).toBe('no-store');
  read.mockResolvedValueOnce(Buffer.from('image bytes'));
  const found = await request(filename);
  expect(found.status).toBe(200);
  expect(found.headers.get('content-type')).toBe('image/jpeg');
  expect(await found.text()).toBe('image bytes');
});
it('rejects traversal and non-image filenames without touching the filesystem', async () => {
  read.mockClear();
  for (const filename of ['../../.env.local', 'test.svg', `${'a'.repeat(64)}.jpg/..`]) expect((await request(filename)).status).toBe(404);
  expect(read).not.toHaveBeenCalled();
});
