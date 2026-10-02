import { beforeEach, describe, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ files: new Map<string, string | Buffer>(), get: vi.fn() }));
vi.mock('axios', () => ({ default: { get: fixture.get } }));
vi.mock('node:fs/promises', () => ({
  stat: async (file: string) => { const value = fixture.files.get(file); if (!value) throw new Error('Missing'); return { size: value.length }; },
  access: async (file: string) => { if (!fixture.files.has(file)) throw new Error('Missing'); },
  readFile: async (file: string) => { if (!fixture.files.has(file)) throw new Error('Missing'); return fixture.files.get(file); },
  mkdir: vi.fn(), writeFile: vi.fn(), rename: vi.fn(), rm: vi.fn(),
}));
vi.mock('../src/atomic-file.js', () => ({ writeAtomic: async (file: string, data: string | Buffer) => { fixture.files.set(file, data); } }));
const { downloadImage } = await import('../src/images.js');
beforeEach(() => { fixture.files.clear(); fixture.get.mockReset(); });
describe('shared binary image cache', () => {
  it('coalesces simultaneous downloads and reuses cached files on subsequent requests', async () => {
    fixture.get.mockResolvedValue({ data: Buffer.alloc(200, 42), headers: { 'content-type': 'image/jpeg' } });
    const first = await Promise.all([downloadImage('https://cdn.example.com/one.jpg'), downloadImage('https://cdn.example.com/one.jpg')]);
    expect(first[0]).toBeTruthy(); expect(first[0]).toBe(first[1]);
    expect(await downloadImage('https://cdn.example.com/one.jpg')).toBe(first[0]);
    expect(fixture.get).toHaveBeenCalledTimes(1);
  });
  it('stores identical bytes from different URLs in one shared file', async () => {
    fixture.get.mockResolvedValue({ data: Buffer.alloc(200, 42), headers: { 'content-type': 'image/jpeg' } });
    const first = await downloadImage('https://cdn.example.com/a.jpg');
    const second = await downloadImage('https://cdn.example.com/b.jpg');
    expect(first).toBe(second);
    expect([...fixture.files.keys()].filter(file => file.includes('/public/images/products/'))).toHaveLength(1);
  });
  it('backs off failed downloads across cities and never saves HTML as an image', async () => {
    fixture.get.mockResolvedValue({ data: Buffer.alloc(200, 42), headers: { 'content-type': 'text/html' } });
    expect(await downloadImage('https://cdn.example.com/error.jpg')).toBeUndefined();
    expect(await downloadImage('https://cdn.example.com/error.jpg')).toBeUndefined();
    expect(fixture.get).toHaveBeenCalledTimes(1);
    expect([...fixture.files.keys()].filter(file => file.includes('/public/images/products/'))).toHaveLength(0);
  });
});
