import { describe, expect, it } from 'vitest';
import { DECK_SIZE, STARTER_CARDS, battleStats, buildDeck, ringsLabel, type BattleCardDef, type DrinkFacts } from '../src/lib/battle-fields';

const drink = (facts: Partial<DrinkFacts> = {}): DrinkFacts => ({ price: 100, reviews: 0, taste: 0, design: 0, swipes: 0, likes: 0, favorites: 0, tierLists: 0, tierAverage: 0, sugarfree: false, ...facts });
const market = Array.from({ length: 50 }, (_, index) => drink({ price: 50 + index * 3 }));

const card = (id: string, cost: number, attack: number, health: number, extra: Partial<BattleCardDef & { count: number }> = {}): BattleCardDef & { count: number } => ({
  id, brand: 'B', flavor: id, title: 'B', name: id, cover: `/${id}.jpg`, rarity: 'common', cost, attack, health, keyword: null, count: 1, ...extra,
});

describe('battleStats', () => {
  it('takes mana from the price: a cheap can comes early, an expensive one late', () => {
    const stats = battleStats(market);
    expect(stats[0]!.cost).toBe(1);
    expect(stats[49]!.cost).toBe(6);
    expect(stats.map(item => item.cost)).toEqual([...stats.map(item => item.cost)].sort((a, b) => a - b));
  });

  it('spends the budget on attack for taste and on health for design', () => {
    const [tasty, pretty] = battleStats([drink({ reviews: 40, taste: 9, design: 5 }), drink({ reviews: 40, taste: 5, design: 9 }), ...market]);
    expect(tasty!.attack).toBeGreaterThan(pretty!.attack);
    expect(pretty!.health).toBeGreaterThan(tasty!.health);
  });

  it('does not let a single review make a legend', () => {
    const rated = Array.from({ length: 20 }, () => drink({ reviews: 20, taste: 8, design: 8 }));
    const budget = (item: { attack: number; health: number; keyword: unknown }) => item.attack + item.health + (item.keyword ? 1 : 0);
    const [one, many] = battleStats([drink({ reviews: 1, taste: 10, design: 10 }), drink({ reviews: 40, taste: 10, design: 10 }), ...rated]);
    expect(budget(one!)).toBeLessThan(budget(many!));
  });

  it('gives one property, dating before discussion, and charges a point for it', () => {
    const plain = drink();
    const swiped = drink({ swipes: 8, likes: 0.5, favorites: 5, sugarfree: true });
    const [left, right] = battleStats([plain, swiped, ...market]);
    expect(left!.keyword).toBeNull();
    expect(right!.keyword).toBe('match');
    expect(right!.attack + right!.health).toBe(left!.attack + left!.health - 1);
  });

  it('keeps the thresholds: few swipes, few lists and few favourites give nothing', () => {
    const facts = [drink({ swipes: 4, likes: 1 }), drink({ tierLists: 2, tierAverage: 6 }), drink({ favorites: 2 }), drink({ tierLists: 3, tierAverage: 4.5 }), drink({ favorites: 3 }), drink({ sugarfree: true })];
    expect(battleStats(facts).map(item => item.keyword)).toEqual([null, null, null, 'shield', 'loyal', 'rush']);
  });

  it('prices an archive can by its reviews and always leaves a living card', () => {
    const stats = battleStats([drink({ price: null, reviews: 30, taste: 1, design: 1 }), drink({ price: null, reviews: 30, taste: 10, design: 10 }), ...market]);
    expect(stats[0]!.cost).toBe(4);
    expect(stats[1]!.cost).toBe(6);
    for (const item of stats) { expect(item.attack).toBeGreaterThan(0); expect(item.health).toBeGreaterThan(0); }
  });
});

describe('buildDeck', () => {
  it('fills an empty collection with starter cans', () => {
    expect(buildDeck([])).toEqual(STARTER_CARDS);
    expect(STARTER_CARDS).toHaveLength(DECK_SIZE);
  });

  it('puts own cards first, keeps the mana curve and pads with starters', () => {
    const owned = Array.from({ length: 10 }, (_, index) => card(`c${index}`, 2, 4, 4));
    const deck = buildDeck(owned);
    expect(deck).toHaveLength(DECK_SIZE);
    expect(deck.filter(item => item.cover)).toHaveLength(4);
  });

  it('adds a second copy for a duplicate, but never of a legendary', () => {
    const deck = buildDeck([card('dupe', 3, 4, 4, { count: 3 }), card('legend', 4, 5, 5, { count: 2, rarity: 'legendary' })]);
    expect(deck.filter(item => item.id === 'dupe')).toHaveLength(2);
    expect(deck.filter(item => item.id === 'legend')).toHaveLength(1);
  });
});

it('declines the rings', () => {
  expect([1, 2, 5, 11, 21, 22].map(ringsLabel)).toEqual(['1 колечко', '2 колечка', '5 колечек', '11 колечек', '21 колечко', '22 колечка']);
});
