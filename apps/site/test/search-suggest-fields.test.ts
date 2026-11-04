import { describe, expect, it } from 'vitest';
import { buildSuggestIndex, suggest, swapLayout, SUGGEST_BRANDS, type Suggestion } from '../src/lib/search-suggest-fields.js';

const drinks = [
  { brand: 'Adrenaline Rush', flavor: 'original', cover: '/a.jpg' },
  { brand: 'Adrenaline Rush', flavor: 'mango' },
  { brand: 'Adrenaline Rush', flavor: 'sugarfree' },
  { brand: 'Monster', flavor: 'monster_mango_loco' },
  { brand: 'Tornado', flavor: 'mango', cover: '/t.jpg' },
  { brand: 'Black Rocket', flavor: 'blend:apricot+mango' },
  { brand: 'Gorilla', flavor: 'original' },
];
const popularity = new Map([[JSON.stringify(['Monster', 'monster_mango_loco']), 50]]);
const index = buildSuggestIndex(drinks, popularity);
const brands = (items: Suggestion[]) => items.map(item => item.brand);

describe('search suggestions: brands only', () => {
  it('offers the brand from its first letters, with how many drinks it has', () => {
    expect(suggest(index, 'Adrena')).toEqual([{ brand: 'Adrenaline Rush', drinks: 3, matched: 0, query: 'Adrenaline Rush', cover: '/a.jpg' }]);
  });

  it('puts the bigger brand first when the letters fit both equally', () => {
    const both = buildSuggestIndex([{ brand: 'Monky Kong', flavor: 'original' }, ...Array.from({ length: 30 }, (_, at) => ({ brand: 'Monster', flavor: `f${at}` }))]);
    expect(brands(suggest(both, 'mon'))).toEqual(['Monster', 'Monky Kong']);
  });

  it('finds the brand by its Russian spelling, a typo and the wrong keyboard layout', () => {
    for (const query of ['адрена', 'adrenalin', 'adrenaline rus', 'фвкутф']) expect(suggest(index, query)[0]?.brand).toBe('Adrenaline Rush');
    expect(suggest(index, 'gorila')[0]?.brand).toBe('Gorilla');
  });

  it('turns a flavour into the brands that have it, a flavour that leads before a mix', () => {
    const mango = suggest(index, 'манго');
    // «Манго» itself first (equal ones by name), then «Mango Loco», then the mix with apricot.
    expect(brands(mango)).toEqual(['Adrenaline Rush', 'Tornado', 'Monster', 'Black Rocket']);
    expect(mango[1]).toEqual({ brand: 'Tornado', drinks: 1, matched: 1, query: 'Tornado манго', cover: '/t.jpg' });
  });

  it('keeps what was typed when it already names the brand', () => {
    expect(suggest(index, 'adre ман')).toEqual([{ brand: 'Adrenaline Rush', drinks: 3, matched: 1, query: 'adre ман' }]);
  });

  it('keeps the list short and says nothing to nonsense', () => {
    const many = buildSuggestIndex(Array.from({ length: 20 }, (_, at) => ({ brand: `Brand ${at}`, flavor: 'mango' })));
    expect(suggest(many, 'mango')).toHaveLength(SUGGEST_BRANDS);
    expect(suggest(index, 'zzqx')).toEqual([]);
    expect(suggest(index, '  ')).toEqual([]);
  });

  it('swaps the keyboard layout both ways', () => {
    expect(swapLayout('фвкутф')).toBe('adrena');
    expect(swapLayout('ghbdtn')).toBe('привет');
  });
});
