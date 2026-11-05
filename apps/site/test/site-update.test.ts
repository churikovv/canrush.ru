import { afterEach, describe, expect, it, vi } from 'vitest';
import { isStaleBuildError, markSiteUpdated, onSiteUpdated, reloadForUpdate } from '@/lib/site-update';

afterEach(() => { vi.unstubAllGlobals(); });

function browser(path = '/feed', scrollY = 640) {
  const store = new Map<string, string>();
  const reload = vi.fn();
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => { store.set(key, value); } });
  vi.stubGlobal('location', { pathname: path, search: '', reload });
  vi.stubGlobal('window', { scrollY });
  return { store, reload };
}

describe('a page of the previous build', () => {
  it('knows the errors that only mean a newer build is out', () => {
    expect(isStaleBuildError(new Error('Server Action "40ab12" was not found on the server. \nRead more: https://nextjs.org/docs/messages/failed-to-find-server-action'))).toBe(true);
    expect(isStaleBuildError(Object.assign(new Error('Failed to load chunk /_next/static/chunks/0ti.js'), { name: 'ChunkLoadError' }))).toBe(true);
    expect(isStaleBuildError(new TypeError('Failed to fetch dynamically imported module: https://canrush.ru/_next/static/chunks/a.js'))).toBe(true);
    expect(isStaleBuildError(new Error('Не удалось сохранить.'))).toBe(false);
    expect(isStaleBuildError('Server Action not found')).toBe(false);
  });

  it('reloads keeping the scroll position, and not twice within a minute', () => {
    const { store, reload } = browser();
    expect(reloadForUpdate()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(JSON.parse(store.get('canrush-site-update')!)).toMatchObject({ path: '/feed', y: 640 });
    // During the deploy a reload can land on the old server again: the page asks the member instead of looping.
    expect(reloadForUpdate()).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('tells every listener once, including one that comes later', () => {
    const early = vi.fn(), late = vi.fn();
    const stop = onSiteUpdated(early);
    markSiteUpdated();
    markSiteUpdated();
    onSiteUpdated(late)();
    stop();
    expect(early).toHaveBeenCalledTimes(1);
    expect(late).toHaveBeenCalledTimes(1);
  });
});
