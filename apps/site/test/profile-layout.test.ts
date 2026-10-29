import { expect, it } from 'vitest';
import { DEFAULT_PROFILE_LAYOUT, parseProfileLayout, placeProfileBlock } from '../src/lib/profile-layout';
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
  expect(DEFAULT_PROFILE_LAYOUT.hidden).toEqual(['favorites', 'listings', 'drinks', 'cards']);
});

it('adds the gacha cards hidden before the wall to layouts saved before them', () => {
  const order = DEFAULT_PROFILE_LAYOUT.order.filter(key => key !== 'cards');
  const parsed = parseProfileLayout({ order, hidden: [] });
  expect(parsed?.order[parsed.order.indexOf('wall') - 1]).toBe('cards');
  expect(parsed?.hidden).toEqual(['cards']);
});

it('adds the calendar right after the level to layouts saved before it existed', () => {
  const order = DEFAULT_PROFILE_LAYOUT.order.filter(key => key !== 'calendar').reverse();
  const parsed = parseProfileLayout({ order, hidden: ['wall'] });
  expect(parsed?.order[parsed.order.indexOf('experience') + 1]).toBe('calendar');
  expect(parsed?.hidden).toEqual(['wall']);
});

it('places the wall last by default', () => { expect(DEFAULT_PROFILE_LAYOUT.order.at(-1)).toBe('wall'); });

it('adds the optional «Добавленные напитки» hidden, right before the wall, to older layouts', () => {
  const order = DEFAULT_PROFILE_LAYOUT.order.filter(key => key !== 'drinks');
  const parsed = parseProfileLayout({ order, hidden: [] });
  expect(parsed?.order.at(-2)).toBe('drinks');
  expect(parsed?.hidden).toEqual(['drinks']);
});

it('moves a block before or after a target and reports no-op moves', () => {
  const order = ['experience', 'ratings', 'listings', 'social'] as const;
  expect(placeProfileBlock(order, 'experience', 'ratings', true)).toEqual(['ratings', 'experience', 'listings', 'social']);
  expect(placeProfileBlock(order, 'listings', 'experience', false)).toEqual(['listings', 'experience', 'ratings', 'social']);
  expect(placeProfileBlock(order, 'experience', 'ratings', false)).toBeNull();
  expect(placeProfileBlock(order, 'ratings', 'ratings', true)).toBeNull();
  expect(placeProfileBlock(order, 'wall', 'ratings', true)).toBeNull();
});

it('adds the collection right after the calendar to layouts saved before it existed', () => {
  const order = DEFAULT_PROFILE_LAYOUT.order.filter(key => key !== 'collection' && key !== 'calendar');
  const parsed = parseProfileLayout({ order, hidden: [] });
  expect(parsed?.order.slice(parsed.order.indexOf('experience'), parsed.order.indexOf('experience') + 3)).toEqual(['experience', 'calendar', 'collection']);
});
it('keeps hidden rows of the about block and rejects unknown ones', () => {
  expect(parseProfileLayout({ ...DEFAULT_PROFILE_LAYOUT, hiddenFields: ['telegramChannel'] })?.hiddenFields).toEqual(['telegramChannel']);
  expect(parseProfileLayout({ ...DEFAULT_PROFILE_LAYOUT, hiddenFields: [] })).toEqual(DEFAULT_PROFILE_LAYOUT);
  expect(parseProfileLayout({ ...DEFAULT_PROFILE_LAYOUT, hiddenFields: ['email'] })).toBeNull();
  expect(parseProfileLayout({ ...DEFAULT_PROFILE_LAYOUT, hiddenFields: ['telegramChannel', 'telegramChannel'] })).toBeNull();
});
