import { describe, expect, it } from 'vitest';
import { MASS_MARKET_PRESETS, MASS_MARKET_SIZE, PRESET_NAME_LIMIT, massMarketPresets, parsePresetDrinks, parsePresetName, presetCaptions, presetItems } from '../src/lib/store-preset-fields';

const id = (brand: string, flavor: string) => JSON.stringify([brand, flavor]);
const drink = (brand: string, flavor: string) => ({ brand, flavor, label: `${brand} · ${flavor}` });

describe('preset names', () => {
  it('tidies spaces and refuses an empty or a long name', () => {
    expect(parsePresetName('  Моя   сеть ')).toBe('Моя сеть');
    expect(() => parsePresetName('   ')).toThrow('Назовите');
    expect(() => parsePresetName('я'.repeat(PRESET_NAME_LIMIT + 1))).toThrow('Назовите');
  });
});

describe('preset drinks', () => {
  it('keeps the name and the catalog link, never a price', () => {
    expect(parsePresetDrinks([{ name: ' Burn ', brand: 'Burn', flavor: 'original', price: 15900, availability: 'unknown' }, { name: 'Свой' }]))
      .toEqual([{ name: 'Burn', brand: 'Burn', flavor: 'original' }, { name: 'Свой' }]);
  });

  it('drops repeats, by link or by a typed name in any case', () => {
    expect(parsePresetDrinks([{ name: 'A', brand: 'B', flavor: 'c' }, { name: 'Другое имя', brand: 'B', flavor: 'c' }, { name: 'Свой' }, { name: 'СВОЙ' }])).toHaveLength(2);
  });

  it('turns a half link into a typed drink', () => {
    expect(parsePresetDrinks([{ name: 'A', brand: 'B' }])).toEqual([{ name: 'A' }]);
  });

  it.each([['not a list', 'text'], ['an empty list', []], ['a nameless drink', [{ name: '' }]], ['too many drinks', Array.from({ length: 51 }, (_, index) => ({ name: `Напиток ${index}` }))]])('refuses %s', (_title, value) => {
    expect(() => parsePresetDrinks(value)).toThrow();
  });

  it('becomes store rows with no prices', () => {
    expect(presetItems([{ name: 'A', brand: 'B', flavor: 'c' }])).toEqual([{ name: 'A', brand: 'B', flavor: 'c', price: null, availability: 'available' }]);
  });

  it('drops the brand from captions only when the whole template is one brand', () => {
    const burn = [{ name: 'Burn · Яблоко', brand: 'Burn', flavor: 'apple' }, { name: 'Burn · Манго', brand: 'Burn', flavor: 'mango' }];
    expect(presetCaptions(burn)).toEqual(['Яблоко', 'Манго']);
    expect(presetCaptions([...burn, { name: 'Свой' }])).toEqual(['Burn · Яблоко', 'Burn · Манго', 'Свой']);
    expect(presetCaptions([])).toEqual([]);
  });
});

describe('ready presets', () => {
  it('makes one template per brand, its best sellers first, real stores above chains', () => {
    const options = [drink('Burn', 'a'), drink('Burn', 'b'), drink('Burn', 'c'), drink('Tiny', 'd')];
    const presets = massMarketPresets(options, new Map([[id('Burn', 'b'), 2], [id('Tiny', 'd'), 9]]), new Map([[id('Burn', 'a'), 3]]));
    expect(presets).toEqual([{ name: 'Масс-маркет Burn', drinks: [{ name: 'Burn · b', brand: 'Burn', flavor: 'b' }, { name: 'Burn · a', brand: 'Burn', flavor: 'a' }] }]);
  });

  it('stops at the size of a template', () => {
    const monsters = Array.from({ length: 30 }, (_, index) => drink('Monster', `f${index}`));
    const [preset] = massMarketPresets(monsters, new Map(monsters.map(option => [id(option.brand, option.flavor), 1])), new Map());
    expect(preset?.drinks).toHaveLength(MASS_MARKET_SIZE);
  });

  it('covers the four brands, each with a template of its own', () => {
    const options = MASS_MARKET_PRESETS.map(preset => drink(preset.brand, 'a'));
    const presets = massMarketPresets(options, new Map(options.map(option => [id(option.brand, option.flavor), 1])), new Map());
    expect(presets.map(preset => preset.name)).toEqual(['Масс-маркет Burn', 'Масс-маркет Monster', 'Масс-маркет Adrenaline', 'Масс-маркет Flash Up']);
  });
});
