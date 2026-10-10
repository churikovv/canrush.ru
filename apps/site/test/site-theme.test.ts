import { beforeEach, expect, it, vi } from 'vitest';
const set = vi.hoisted(() => vi.fn());
vi.mock('next/headers', () => ({ cookies: async () => ({ set }) }));
import { saveThemeSettings } from '../src/app/profile/settings/theme-actions';
import { parseSiteTheme, SITE_THEME_COOKIE } from '../src/lib/site-theme';
beforeEach(() => { set.mockReset(); });
it('whitelists themes and rejects untrusted cookie and form values', async () => {
  expect(parseSiteTheme('graphite')).toBe('graphite'); expect(parseSiteTheme('light')).toBe('light'); expect(parseSiteTheme('system')).toBe('system');
  for (const value of [null, '', 'dark', '<script>', {}, ['light']]) expect(parseSiteTheme(value)).toBeNull();
  const form = new FormData(); form.set('theme', 'evil');
  expect((await saveThemeSettings({}, form)).error).toBeTruthy(); expect(set).not.toHaveBeenCalled();
});
it('persists both themes as a same-site HTTP-only preference available before rendering', async () => {
  for (const theme of ['system', 'graphite', 'light']) {
    const form = new FormData(); form.set('theme', theme);
    expect((await saveThemeSettings({}, form)).success).toBeTruthy();
    expect(set).toHaveBeenLastCalledWith(SITE_THEME_COOKIE, theme, expect.objectContaining({ path: '/', httpOnly: true, sameSite: 'lax', maxAge: 31536000 }));
  }
});
it('reports a failed preference save without claiming success', async () => {
  set.mockImplementationOnce(() => { throw new Error('Unavailable'); });
  const form = new FormData(); form.set('theme','graphite');
  expect(await saveThemeSettings({},form)).toEqual({ error: expect.any(String) });
});
