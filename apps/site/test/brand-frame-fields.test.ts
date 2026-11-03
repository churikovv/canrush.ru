import { expect, it } from 'vitest';
import { brandFrameProgress, lockedBrandFrameMessage, ownedBrandFrames } from '../src/lib/brand-frame-fields';
import { BRAND_FRAME_ITEMS, BRAND_FRAME_REVIEWS, canUseProfileAppearance, isLevelCosmetic, nextAppearanceUnlock, PROFILE_FRAMES } from '../src/lib/profile-appearance';

const reviewed = (reviews: { brand: string; flavor: string }[], key: string) => brandFrameProgress(reviews).find(item => item.key === key)?.reviewed;

it('counts different flavours of the brand once each, whatever the case of the brand', () => {
  const reviews = [{ brand: 'Monster', flavor: 'test-a' }, { brand: 'monster', flavor: 'test-a' }, { brand: 'MONSTER', flavor: 'test-b' }, { brand: 'Burn', flavor: 'test-a' }];
  expect(reviewed(reviews, 'monster')).toBe(2);
  expect(reviewed(reviews, 'burn')).toBe(1);
  expect(reviewed(reviews, 'jaguar')).toBe(0);
});

it('counts a product line for its parent brand and skips the assortment', () => {
  const reviews = [{ brand: 'Adrenaline Game Fuel', flavor: 'test-a' }, { brand: 'Adrenaline Rush', flavor: 'test-a' }, { brand: 'Adrenaline Rush', flavor: 'unresolved:60396be429e67ccda809b2ce' }];
  expect(reviewed(reviews, 'adrenaline')).toBe(2);
});

it('opens a frame at the review threshold and keeps brand frames out of the level rewards', () => {
  const reviews = Array.from({ length: BRAND_FRAME_REVIEWS }, (_, index) => ({ brand: 'Volt Energy', flavor: `test-${index}` }));
  expect(ownedBrandFrames(brandFrameProgress(reviews.slice(1)))).toEqual([]);
  expect(ownedBrandFrames(brandFrameProgress(reviews))).toEqual(['volt']);
  expect(canUseProfileAppearance({ theme: 'default', frame: 'volt' }, 30)).toBe(false);
  expect(canUseProfileAppearance({ theme: 'default', frame: 'volt' }, 1, undefined, ['volt'])).toBe(true);
  expect(BRAND_FRAME_ITEMS).toHaveLength(11);
  expect(PROFILE_FRAMES.filter(isLevelCosmetic).every(item => item.level <= 20)).toBe(true);
  expect(nextAppearanceUnlock(20)).toBeNull();
  expect(lockedBrandFrameMessage('volt')).toBe(`Рамка «Volt» пока закрыта: оцените ${BRAND_FRAME_REVIEWS} разных вкусов Volt Energy.`);
  expect(lockedBrandFrameMessage('legend')).toBeNull();
});
