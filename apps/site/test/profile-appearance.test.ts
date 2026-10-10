import { expect, it } from 'vitest';
import { parseProfileAppearance, PROFILE_THEMES, PROFILE_FRAMES } from '../src/lib/profile-appearance';
it('accepts only named presets and frames, never arbitrary styles', () => {
  for (const theme of PROFILE_THEMES) for (const frame of PROFILE_FRAMES) expect(parseProfileAppearance({ theme: theme.key, frame: frame.key })).toEqual({ theme: theme.key, frame: frame.key });
  for (const value of [null, [], {}, { theme: 'dark' }, { theme: 'url(evil)', frame: 'none' }, { theme: 'dark', frame: 'custom' }]) expect(parseProfileAppearance(value)).toBeNull();
});
