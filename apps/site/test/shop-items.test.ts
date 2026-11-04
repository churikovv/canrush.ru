import { expect, it } from 'vitest';
import { DEAL_DISCOUNT, priceNow, SHOP_ITEMS, SHOP_TIERS, weekIndex, weeklyDeal } from '@/lib/shop-items';
import { PROFILE_ACHIEVEMENTS } from '@/lib/profile-achievements';

it('prices every item inside its tier and never sells an achievement tag', () => {
  for (const item of SHOP_ITEMS) {
    const [low, high] = SHOP_TIERS[item.tier].range;
    expect(item.price, item.key).toBeGreaterThanOrEqual(low);
    expect(item.price, item.key).toBeLessThanOrEqual(high);
    expect(PROFILE_ACHIEVEMENTS.some(achievement => achievement.key === item.key)).toBe(false);
  }
  expect(new Set(SHOP_ITEMS.map(item => item.key)).size).toBe(SHOP_ITEMS.length);
});

it('changes the deal on Monday by Moscow time and walks through every item before repeating one', () => {
  const sunday = new Date('2026-11-08T23:59:00+03:00'), monday = new Date('2026-11-09T00:00:00+03:00');
  expect(weekIndex(monday)).toBe(weekIndex(sunday) + 1);
  expect(weeklyDeal(sunday).endsAt).toEqual(monday);
  const seen = new Set(Array.from({ length: SHOP_ITEMS.length }, (_, week) => weeklyDeal(new Date(monday.getTime() + week * 7 * 86_400_000)).item.key));
  expect(seen.size).toBe(SHOP_ITEMS.length);
  const deal = weeklyDeal(monday);
  expect(deal.price).toBeLessThan(deal.item.price);
  expect(Math.abs(deal.price - deal.item.price * (1 - DEAL_DISCOUNT))).toBeLessThanOrEqual(2.5);
  expect(priceNow(deal.item, monday)).toBe(deal.price);
  expect(priceNow(SHOP_ITEMS.find(item => item.key !== deal.item.key)!, monday)).toBe(SHOP_ITEMS.find(item => item.key !== deal.item.key)!.price);
});
