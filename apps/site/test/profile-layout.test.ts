import { expect, it } from 'vitest';
import { DEFAULT_PROFILE_LAYOUT, parseProfileLayout } from '../src/lib/profile-layout';
it('validates complete unique block orders and visibility', () => {
  expect(parseProfileLayout(DEFAULT_PROFILE_LAYOUT)).toEqual(DEFAULT_PROFILE_LAYOUT);
  expect(parseProfileLayout({ order: ['wall'], hidden: [] })).toBeNull();
  expect(parseProfileLayout({ ...DEFAULT_PROFILE_LAYOUT, hidden: ['unknown'] })).toBeNull();
  expect(parseProfileLayout({ ...DEFAULT_PROFILE_LAYOUT, hidden: ['wall', 'wall'] })).toBeNull();
  expect(parseProfileLayout({ order: Array(6).fill('wall'), hidden: [] })).toBeNull();
  expect(parseProfileLayout(null)).toBeNull();
});
