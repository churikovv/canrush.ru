import { describe, expect, it } from 'vitest';
import { drinkKey, opinions, rankRecommendations, similarity, type CatalogDrink, type TasteProfile } from '../src/lib/story-recommendations.js';

const fav = (brand: string, flavor: string) => ({ brand, flavor });
const rev = (brand: string, flavor: string, taste: number) => ({ brand, flavor, taste, design: 7 });
const profile = (parts: Partial<TasteProfile>): TasteProfile => ({ favorites: [], reviews: [], drinks: [], ...parts });
const catalog = (...items: [string, string][]): CatalogDrink[] => items.map(([brand, flavor]) => ({ brand, flavor, inStock: true }));

const viewer = profile({ reviews: [rev('Burn', 'apple_kiwi', 9), rev('Monster', 'monster_mango_loco', 8), rev('Adrenaline', 'original', 3)] });

describe('story recommendations', () => {
  it('reads a strict rater relative to their own average', () => {
    const strict = opinions(profile({ reviews: [rev('A', 'x', 4), rev('B', 'y', 4), rev('C', 'z', 7)] }));
    expect(strict.get(drinkKey(fav('C', 'z')))!.score).toBeGreaterThan(0.3);
    expect(strict.get(drinkKey(fav('A', 'x')))!.score).toBeLessThan(0);
  });

  it('treats repeated cans as liking and a single can as tried', () => {
    const drinks = opinions(profile({ drinks: [{ brand: 'Volt', flavor: 'original', count: 3 }, { brand: 'Gorilla', flavor: 'original', count: 1 }] }));
    expect(drinks.get(drinkKey(fav('Volt', 'original')))!.score).toBe(0.7);
    expect(drinks.get(drinkKey(fav('Gorilla', 'original')))!.score).toBe(0.2);
  });

  it('counts a swipe only where nothing stronger is known', () => {
    const mixed = opinions(profile({ reviews: [rev('Burn', 'apple_kiwi', 2)], swipes: [{ brand: 'Burn', flavor: 'apple_kiwi', liked: true }, { brand: 'Volt', flavor: 'mango', liked: true }, { brand: 'Gorilla', flavor: 'original', liked: false }] }));
    expect(mixed.get(drinkKey(fav('Burn', 'apple_kiwi')))!.score).toBeLessThan(0);
    expect(mixed.get(drinkKey(fav('Volt', 'mango')))!.score).toBe(0.5);
    expect(mixed.get(drinkKey(fav('Gorilla', 'original')))!.score).toBe(-0.4);
  });

  it('weights members who agree above members who disagree', () => {
    const agree = opinions(profile({ reviews: [rev('Burn', 'apple_kiwi', 9), rev('Monster', 'monster_mango_loco', 9), rev('Adrenaline', 'original', 2)] }));
    const disagree = opinions(profile({ reviews: [rev('Burn', 'apple_kiwi', 2), rev('Monster', 'monster_mango_loco', 3), rev('Adrenaline', 'original', 9)] }));
    const mine = opinions(viewer);
    expect(similarity(mine, agree)).toBeGreaterThan(0.4);
    expect(similarity(mine, disagree)).toBeLessThan(0);
  });

  it('suggests what similar members love, not what dissimilar ones do, and skips what the viewer tried', () => {
    const twin = profile({ reviews: [rev('Burn', 'apple_kiwi', 9), rev('Monster', 'monster_mango_loco', 9), rev('Adrenaline', 'original', 2), rev('Flash Up', 'mango', 10)] });
    const twin2 = profile({ reviews: [rev('Burn', 'apple_kiwi', 8), rev('Monster', 'monster_mango_loco', 9), rev('Flash Up', 'mango', 9)] });
    const opposite = profile({ reviews: [rev('Burn', 'apple_kiwi', 2), rev('Monster', 'monster_mango_loco', 2), rev('Adrenaline', 'original', 10), rev('Gorilla', 'original', 10)] });
    const ranked = rankRecommendations(viewer, [twin, twin2, opposite], catalog(['Flash Up', 'mango'], ['Gorilla', 'original'], ['Burn', 'apple_kiwi']));
    expect(ranked.map(drink => drink.brand)).toEqual(['Flash Up']);
    expect(ranked[0]!.reason).toMatchObject({ kind: 'similar', fans: 2 });
  });

  it('falls back on the viewer’s own brands and flavours without neighbours, at most two per brand', () => {
    const fan = profile({ reviews: [rev('Burn', 'apple_kiwi', 10), rev('Burn', 'original', 9), rev('Monster', 'monster_mango_loco', 9), rev('Flash Up', 'mango', 10), rev('Adrenaline', 'original', 4)], favorites: [fav('Burn', 'original')] });
    const ranked = rankRecommendations(fan, [], catalog(['Burn', 'mango'], ['Burn', 'cherry'], ['Burn', 'lime'], ['Volt', 'mango'], ['Volt', 'original']));
    expect(ranked.filter(drink => drink.brand === 'Burn')).toHaveLength(2);
    expect(ranked[0]!.reason).toEqual({ kind: 'brand', brand: 'Burn' });
    expect(ranked.find(drink => drink.brand === 'Volt')?.reason).toEqual({ kind: 'flavor', token: 'mango' });
    expect(ranked.some(drink => drink.flavor === 'original' && drink.brand === 'Volt')).toBe(false);
  });
});
