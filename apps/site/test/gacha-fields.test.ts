import { describe, expect, it } from 'vitest';
import { GACHA_BANNERS, MAIN_SCENE, PITY_EPIC, PITY_LEGENDARY, RARITY_ODDS, activeBanner, activeScene, isSeasonStar, nextPity, pickFromPool, pityLeft, rarityOf, rollCosmetic, rollRarity, type PityState, type Rarity } from '../src/lib/gacha-fields';

const seeded = (seed: number) => (max: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % max; };

describe('gacha rules', () => {
  it('takes rarity from the catalog', () => {
    expect(rarityOf({ retailers: 5, member: false, discontinued: false, manual: false })).toBe('common');
    expect(rarityOf({ retailers: 2, member: false, discontinued: false, manual: false })).toBe('rare');
    expect(rarityOf({ retailers: 0, member: false, discontinued: false, manual: false })).toBe('epic');
    expect(rarityOf({ retailers: 0, member: true, discontinued: false, manual: false })).toBe('legendary');
    expect(rarityOf({ retailers: 4, member: false, discontinued: false, manual: true })).toBe('legendary');
    expect(rarityOf({ retailers: 0, member: false, discontinued: true, manual: false })).toBe('legendary');
  });

  it('odds add up to 100% and land near the published shares over many pulls', () => {
    expect(Object.values(RARITY_ODDS).reduce((sum, value) => sum + value, 0)).toBe(1000);
    const roll = seeded(7);
    const counts: Record<Rarity, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
    for (let i = 0; i < 100_000; i++) counts[rollRarity(roll, { sinceEpic: 0, sinceLegendary: 0 }).rarity] += 1;
    for (const rarity of Object.keys(counts) as Rarity[]) expect(Math.abs(counts[rarity] / 100_000 - RARITY_ODDS[rarity] / 1000)).toBeLessThan(0.01);
  });

  it('guarantees an epic within ten pulls and a legendary within sixty', () => {
    const never = () => 999; // always the worst roll: common
    let state: PityState = { sinceEpic: 0, sinceLegendary: 0 };
    const seen: Rarity[] = [];
    for (let i = 0; i < PITY_LEGENDARY; i++) {
      const { rarity } = rollRarity(never, state);
      seen.push(rarity);
      state = nextPity(state, rarity);
    }
    expect(seen.slice(0, PITY_EPIC - 1).every(rarity => rarity === 'common')).toBe(true);
    expect(seen[PITY_EPIC - 1]).toBe('epic');
    expect(seen.at(-1)).toBe('legendary');
    expect(pityLeft({ sinceEpic: 3, sinceLegendary: 59 })).toEqual({ epic: 7, legendary: 1 });
  });

  it('falls back to the nearest rarity that has drinks', () => {
    const pool = [{ rarity: 'common' as Rarity, id: 'a' }, { rarity: 'epic' as Rarity, id: 'b' }];
    expect(pickFromPool(pool, 'legendary', () => 0)?.id).toBe('b');
    expect(pickFromPool(pool, 'rare', () => 0)?.id).toBe('a');
    expect(pickFromPool([], 'rare', () => 0)).toBeNull();
  });

  it('gives a season star more tickets inside its rarity', () => {
    const pool = [{ rarity: 'common' as Rarity, id: 'a' }, { rarity: 'common' as Rarity, id: 'star' }];
    const picked = [0, 1, 2, 3].map(ticket => pickFromPool(pool, 'common', () => ticket, item => (item.id === 'star' ? 3 : 1))?.id);
    expect(picked).toEqual(['a', 'star', 'star', 'star']);
  });

  it('runs the Halloween banner by Moscow time, with its stars and a frame by chance or by the 30th pull', () => {
    const halloween = GACHA_BANNERS[0]!;
    expect(activeBanner(Date.parse('2026-10-30T12:00:00+03:00'))?.key).toBe('halloween-2026');
    expect(activeBanner(Date.parse('2026-11-03T00:00:00+03:00'))).toBeNull();
    // The season's scene runs to its last minute, then the machine goes on with its own: no season, no gap.
    expect(activeScene(Date.parse('2026-11-02T23:59:00+03:00'))).toBe(halloween.scene);
    expect(activeScene(Date.parse('2026-11-03T00:00:00+03:00'))).toBe(MAIN_SCENE);
    expect(isSeasonStar(halloween, { flavor: 'tornado_black', name: 'Black' })).toBe(true);
    expect(isSeasonStar(halloween, { flavor: 'mango', name: 'Манго' })).toBe(false);
    expect(rollCosmetic(() => 999, halloween, false, 0)).toBe(false);
    expect(rollCosmetic(() => 5, halloween, false, 0)).toBe(true);
    expect(rollCosmetic(() => 999, halloween, false, 29)).toBe(true);
    expect(rollCosmetic(() => 0, halloween, true, 29)).toBe(false);
    expect(rollCosmetic(() => 0, null, false, 29)).toBe(false);
  });
});
