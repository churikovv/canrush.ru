import { expect, it } from 'vitest';
import { canUseProfileAppearance, parseProfileAppearance, profileThemeAttributes, PROFILE_THEMES, PROFILE_FRAMES } from '../src/lib/profile-appearance';
it('opens a theme on every rank up to Legend and marks its tone', () => {
  expect(PROFILE_THEMES.map(theme => theme.level)).toEqual([1, 2, 4, 6, 8, 10, 12, 15, 18, 20]);
  expect(canUseProfileAppearance({ theme: 'legend', frame: 'none' }, 19)).toBe(false);
  expect(canUseProfileAppearance({ theme: 'legend', frame: 'none' }, 20)).toBe(true);
  expect(profileThemeAttributes('cobalt')).toEqual({ 'data-profile-theme': 'cobalt', 'data-profile-tone': 'dark' });
  expect(profileThemeAttributes('gold')['data-profile-tone']).toBe('light');
  expect(profileThemeAttributes(undefined)).toEqual({ 'data-profile-theme': 'default', 'data-profile-tone': undefined });
  expect(profileThemeAttributes('url(evil)')['data-profile-theme']).toBe('default');
});
it('accepts only named presets and frames, never arbitrary styles', () => {
  for (const theme of PROFILE_THEMES) for (const frame of PROFILE_FRAMES) expect(parseProfileAppearance({ theme: theme.key, frame: frame.key })).toEqual({ theme: theme.key, frame: frame.key });
  for (const value of [null, [], {}, { theme: 'dark' }, { theme: 'url(evil)', frame: 'none' }, { theme: 'dark', frame: 'custom' }]) expect(parseProfileAppearance(value)).toBeNull();
});
