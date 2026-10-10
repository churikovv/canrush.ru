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

it('restores mandatory blocks in saved or submitted layouts without changing order', () => {
  const order = [...DEFAULT_PROFILE_LAYOUT.order].reverse();
  expect(parseProfileLayout({ order, hidden: ['experience', 'social', 'wall'] })).toEqual({ order, hidden: ['wall'] });
});

it('keeps existing arrangements and adds a hidden favorites block', () => {
  const order = DEFAULT_PROFILE_LAYOUT.order.filter(key => key !== 'favorites');
  expect(parseProfileLayout({ order, hidden: ['wall'] })).toEqual({ order: [...order, 'favorites'], hidden: ['wall', 'favorites'] });
  expect(DEFAULT_PROFILE_LAYOUT.hidden).toEqual(['favorites', 'listings']);
});

it('places the wall last by default', () => { expect(DEFAULT_PROFILE_LAYOUT.order.at(-1)).toBe('wall'); });
