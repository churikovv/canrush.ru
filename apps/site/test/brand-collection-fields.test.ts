import { expect, it } from 'vitest';
import { MIN_COLLECTION_SIZE, brandMilestones, buildBrandCollections, collectionAwards, earnedCollectionXp, flavors, nextMilestone, paidShares } from '../src/lib/brand-collection-fields';

const options = [
  { brand: 'Burn', flavor: 'original', cover: '/images/burn.jpg' },
  { brand: 'Burn', flavor: 'guava' },
  { brand: 'Burn', flavor: 'cherry' },
  { brand: 'Monster', flavor: 'monster_mango_loco' },
  { brand: 'Monster', flavor: 'monster_ultra_white' },
  { brand: 'Solo', flavor: 'original' },
  { brand: 'Tornado', flavor: 'tornado_black' },
  { brand: 'Tornado', flavor: 'tornado_storm' },
  { brand: 'Adrenaline Rush', flavor: 'original' },
  { brand: 'Adrenaline Game Fuel', flavor: 'mango' },
];

it('groups catalog drinks by brand and skips single-drink brands', () => {
  const summary = buildBrandCollections(options, []);
  expect(summary.brands.map(item => item.brand)).toEqual(['Adrenaline Rush', 'Burn', 'Monster', 'Tornado']);
  expect(summary.brands.every(item => item.total >= MIN_COLLECTION_SIZE)).toBe(true);
  expect(summary).toMatchObject({ tried: 0, total: 9, started: 0, completed: 0 });
  expect(summary.brands[0]!.items[0]).toMatchObject({ href: expect.stringMatching(/^\/catalog\//), tried: [] });
});

it('counts reviews and calendar cans once and sorts started brands by completion', () => {
  const summary = buildBrandCollections(options, [
    { brand: 'Burn', flavor: 'guava', source: 'review' },
    { brand: 'Burn', flavor: 'guava', source: 'calendar' },
    { brand: 'Tornado', flavor: 'tornado_black', source: 'calendar' },
    { brand: 'Tornado', flavor: 'tornado_storm', source: 'review' },
    { brand: 'Gone', flavor: 'original', source: 'review' },
  ]);
  expect(summary.brands.map(item => [item.brand, item.tried, item.total])).toEqual([['Tornado', 2, 2], ['Burn', 1, 3], ['Adrenaline Rush', 0, 2], ['Monster', 0, 2]]);
  expect(summary).toMatchObject({ tried: 3, total: 9, started: 2, completed: 1 });
  const burn = summary.brands[1]!;
  expect(burn.items[0]).toMatchObject({ flavor: 'guava', tried: ['review', 'calendar'] });
});

it('matches reviews saved under an older product identity', () => {
  const summary = buildBrandCollections(options, [{ brand: 'Monster', flavor: 'mango', source: 'review' }, { brand: 'Burn', flavor: 'apple', source: 'calendar' }]);
  expect(summary.brands.find(item => item.brand === 'Monster')?.items.find(item => item.flavor === 'monster_mango_loco')?.tried).toEqual(['review']);
  // Archived Burn "apple" is the same can as apple + kiwi.
  expect(summary.brands.find(item => item.brand === 'Burn')?.tried).toBe(0);
});

it('collects product lines together with their parent brand', () => {
  const summary = buildBrandCollections(options, [{ brand: 'Adrenaline Game Fuel', flavor: 'mango', source: 'review' }]);
  const rush = summary.brands.find(item => item.brand === 'Adrenaline Rush')!;
  expect(rush.items[0]).toMatchObject({ brand: 'Adrenaline Game Fuel', flavor: 'mango', name: 'Game Fuel · Манго', tried: ['review'] });
  expect(summary.brands.some(item => item.brand === 'Adrenaline Game Fuel')).toBe(false);
});

it('pays each share of a brand once, merging shares small brands reach with one drink', () => {
  expect(brandMilestones(17).map(step => [step.percent, step.needed])).toEqual([[25, 5], [50, 9], [75, 13], [100, 17]]);
  expect(brandMilestones(2).map(step => [step.percent, step.needed])).toEqual([[50, 1], [100, 2]]);
  expect(brandMilestones(3).map(step => [step.percent, step.needed])).toEqual([[25, 1], [50, 2], [100, 3]]);
  const summary = buildBrandCollections(options, [
    { brand: 'Tornado', flavor: 'tornado_black', source: 'calendar' }, { brand: 'Tornado', flavor: 'tornado_storm', source: 'review' },
    { brand: 'Burn', flavor: 'original', source: 'review' },
  ]);
  expect(collectionAwards(summary)).toEqual([{ key: 'Tornado:50', points: 25 }, { key: 'Tornado:100', points: 75 }, { key: 'Burn:25', points: 15 }]);
  expect(nextMilestone(summary.brands.find(item => item.brand === 'Burn')!)).toEqual({ percent: 50, points: 25, needed: 2 });
  expect(nextMilestone(summary.brands.find(item => item.brand === 'Tornado')!)).toBeUndefined();
});

it('skips shares already paid when the catalog grows after completion', () => {
  // 3/3 paid 25, 50 and the merged 100; a fourth flavor makes it 3/4: 75 is reached (and paid in the same settlement),
  // and 100 must not be promised again.
  expect(nextMilestone({ tried: 3, total: 4 })).toEqual({ percent: 100, points: 75, needed: 4 });
  expect(nextMilestone({ tried: 3, total: 4, paid: [25, 50, 100] })).toBeUndefined();
  expect(nextMilestone({ tried: 3, total: 4, paid: [25, 50, 75, 100] })).toBeUndefined();
  expect(nextMilestone({ tried: 1, total: 4, paid: [25] })).toEqual({ percent: 50, points: 25, needed: 2 });
  expect(earnedCollectionXp({ tried: 3, total: 4, paid: [25, 50, 75, 100] })).toBe(155);
  expect(earnedCollectionXp({ tried: 3, total: 3 })).toBe(115);
});

it('reads paid shares from ledger keys, brand names with colons included', () => {
  expect(Object.fromEntries(paidShares(['Burn:50', 'Burn:100', 'Red: Bull:25', 'Burn:33', 'broken']))).toEqual({ Burn: [50, 100], 'Red: Bull': [25] });
});

it('pluralises flavours in Russian', () => {
  expect([1, 2, 5, 11, 21, 24, 112].map(flavors)).toEqual(['1 вкус', '2 вкуса', '5 вкусов', '11 вкусов', '21 вкус', '24 вкуса', '112 вкусов']);
});
