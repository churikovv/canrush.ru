import { expect, it } from 'vitest';
import { profileCompatibility, type PreferenceProfile } from '../src/lib/profile-compatibility';
const favorites = ['mango', 'apple', 'peach'].map(flavor => ({ brand: 'Test', flavor }));
const profile = (items = favorites): PreferenceProfile => ({ favorites: items, reviews: [] });
it('does not invent a percentage for empty or tiny collections', () => {
  expect(profileCompatibility(profile([]), profile()).score).toBeNull();
  expect(profileCompatibility(profile(favorites.slice(0, 1)), profile()).score).toBeNull();
});
it('is symmetric and compares flavor preferences across different products', () => {
  const a = profile(), b = profile(favorites.map(item => ({ ...item, brand: 'Other' })));
  const result = profileCompatibility(a, b);
  expect(result).toEqual(profileCompatibility(b, a));
  expect(result.common).toBe(0);
  expect(result.parts[2]?.score).toBe(100);
  expect(result.score).toBeGreaterThan(0);
  expect(profileCompatibility(a, a).score).toBe(100);
});
it('ignores missing review criteria and requires three paired reviews', () => {
  const a = { ...profile(), reviews: favorites.map(item => ({ ...item, taste: 10, design: 1 })) };
  const b = { ...profile(), reviews: favorites.map(item => ({ ...item, taste: 1, design: 10 })) };
  const result = profileCompatibility(a, b);
  expect(result.parts[3]?.score).toBe(0);
  expect(result.parts[4]?.score).toBe(0);
  expect(result.score).toBe(70);
  expect(profileCompatibility(a, { ...b, reviews: b.reviews.slice(0, 2) }).parts[3]?.score).toBeNull();
});
it('does not interpret different reviewed products or unknown flavors as agreement', () => {
  const a = { favorites: [], reviews: favorites.map(item => ({ ...item, taste: 8, design: 8 })) };
  const b = { favorites: [], reviews: a.reviews.map(item => ({ ...item, brand: 'Other' })) };
  expect(profileCompatibility(a, b).score).toBeNull();
  expect(profileCompatibility(profile([{ brand: 'Test', flavor: 'unknown' }]), profile()).score).toBeNull();
});
it('deduplicates legacy identities before measuring overlap', () => {
  const a = profile([{ brand: 'Monster', flavor: 'mango' }, { brand: 'Monster', flavor: 'monster_mango_loco' }, favorites[0]!]);
  expect(profileCompatibility(a, a).score).toBeNull();
});
