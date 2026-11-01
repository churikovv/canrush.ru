import { describe, expect, it } from 'vitest';
import { matchDrinksPrompt, parseMatches, parseSeenDrinks, splitSeenDrinks } from '../src/lib/store-photo-fields';

const options = [
  { brand: 'Red Bull', flavor: 'original', label: 'Red Bull · Оригинальный' },
  { brand: 'Flash Up', flavor: 'ultra', label: 'Flash Up · Ultra Energy' },
  { brand: 'Adrenaline Rush', flavor: 'original', label: 'Adrenaline Rush · Оригинальный' },
];

describe('what the model saw', () => {
  it('reads the array out of any wrapping and keeps only the expected fields', () => {
    expect(parseSeenDrinks('Вот список:\n```json\n[{"brand":"Red Bull","flavor":"Tropical","extra":1}]\n```')).toEqual([{ brand: 'Red Bull', flavor: 'Tropical' }]);
    expect(parseSeenDrinks('[{"brand":"X"},{"flavor":"y"},"z",{"brand":"Burn"}]')).toEqual([{ brand: 'Burn', flavor: '' }]);
    expect(parseSeenDrinks('Энергетиков нет')).toEqual([]);
    expect(parseSeenDrinks('[{"brand":')).toEqual([]);
  });

  it('finds catalog brands by the short name on the can and leaves the rest as a hint', () => {
    const split = splitSeenDrinks([{ brand: 'Flash', flavor: 'Ultra' }, { brand: 'Adrenaline', flavor: 'Energy' }, { brand: 'Неизвестный', flavor: 'Манго' }], options);
    expect(split.cans.map(can => can.brand)).toEqual(['Flash', 'Adrenaline']);
    expect(split.options.map(option => option.brand)).toEqual(['Flash Up', 'Adrenaline Rush']);
    expect(split.others).toEqual(['Неизвестный Манго']);
  });

  it('does not guess a flavor that could not be read', () => {
    const split = splitSeenDrinks([{ brand: 'Red Bull', flavor: '' }], options);
    expect(split).toMatchObject({ cans: [], options: [], unread: ['Red Bull'] });
  });
});

describe('catalog numbers', () => {
  it('keeps one number per can and drops everything outside the lists', () => {
    const matches = parseMatches('[{"can":1,"item":2},{"can":1,"item":3},{"can":2,"item":0},{"can":3,"item":9},{"can":9,"item":1},{"can":"1","item":1}]', 3, 3);
    expect([...matches]).toEqual([[1, 2]]);
  });

  it('asks about the cans seen, not the photo again', () => {
    const prompt = matchDrinksPrompt([{ brand: 'Flash', flavor: 'Ultra' }], options);
    expect(prompt).toContain('1. Flash Ultra');
    expect(prompt).toContain('2. Flash Up · Ultra Energy');
  });
});
