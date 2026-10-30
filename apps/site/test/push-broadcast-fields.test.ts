import { describe, expect, it } from 'vitest';
import { parseBroadcast, parseBroadcastPath } from '../src/lib/push-broadcast-fields';

describe('parseBroadcast', () => {
  const input = { title: ' Банкомат  ждёт ', body: 'Бесплатная\nкрутка', path: '/gacha', audience: 'all' };

  it('keeps one clean line of text', () => {
    expect(parseBroadcast(input)).toEqual({ title: 'Банкомат ждёт', body: 'Бесплатная крутка', path: '/gacha', audience: 'all' });
  });

  it('refuses empty, long text and an unknown audience', () => {
    expect(() => parseBroadcast({ ...input, title: '  ' })).toThrow('заголовок');
    expect(() => parseBroadcast({ ...input, body: 'а'.repeat(181) })).toThrow('180');
    expect(() => parseBroadcast({ ...input, audience: 'self' })).toThrow('кому');
  });
});

describe('parseBroadcastPath', () => {
  it('takes paths of this site only', () => {
    expect(parseBroadcastPath('')).toBe('/');
    expect(parseBroadcastPath('https://canrush.ru/catalog?q=burn')).toBe('/catalog?q=burn');
    expect(parseBroadcastPath('https://canrush.ru')).toBe('/');
    for (const bad of ['https://evil.example/', '//evil.example', '/\\evil.example', 'gacha', '/a b', 'https://canrush.ru.evil.example/']) expect(() => parseBroadcastPath(bad)).toThrow('страница этого сайта');
  });
});
