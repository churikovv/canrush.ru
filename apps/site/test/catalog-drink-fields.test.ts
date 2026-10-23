import { describe, expect, it } from 'vitest';
import { CatalogDrinkError, drinkFlavorKey, parseCatalogDrink } from '../src/lib/catalog-drink-fields';
import { flavorName } from '../src/lib/catalog-query';

const known = new Set(['mango', 'passion_fruit', 'apple']);
const form = (entries: [string, string][]) => { const data = new FormData(); for (const [key, value] of entries) data.append(key, value); return data; };

describe('catalog drink form', () => {
  it('builds the catalog flavour key the way the parser does', () => {
    expect(drinkFlavorKey({ flavors: ['passion_fruit', 'mango'], sugarFree: true })).toBe('blend:mango+passion_fruit:sugarfree');
    expect(flavorName('blend:mango+passion_fruit:sugarfree')).toBe('Манго + Маракуйя · без сахара');
    expect(drinkFlavorKey({ flavors: [], custom: ['  дыня   и огурец '], sugarFree: false })).toBe('Дыня и огурец');
    expect(flavorName('Дыня и огурец:sugarfree')).toBe('Дыня и огурец · без сахара');
    // Own names mix with known flavours in one blend.
    expect(drinkFlavorKey({ flavors: ['mango'], custom: ['огурец'], sugarFree: false })).toBe('blend:mango+Огурец');
    expect(flavorName('blend:mango+Огурец')).toBe('Манго + Огурец');
  });

  it('reads brand, flavour, volumes and the label text', () => {
    expect(parseCatalogDrink(form([['brand', ' Burn '], ['flavor', 'apple'], ['volume', '450'], ['volume', '250'], ['volume', '450'], ['ingredients', 'Вода,  сахар\r\n\r\n\r\nтаурин']]), known))
      .toEqual({ brand: 'Burn', flavor: 'apple', volumes: [250, 450], ingredients: 'Вода, сахар\n\nтаурин' });
  });

  it('rejects unknown flavours, odd names and volumes', () => {
    expect(() => parseCatalogDrink(form([['brand', 'Burn'], ['volume', '450']]), known)).toThrow(CatalogDrinkError);
    expect(() => parseCatalogDrink(form([['brand', 'Burn'], ['flavor', 'cola'], ['volume', '450']]), known)).toThrow('Неизвестный');
    expect(() => parseCatalogDrink(form([['brand', 'Burn'], ['flavor', 'apple'], ['flavor', 'mango'], ['customFlavor', 'Огурец'], ['customFlavor', 'Дыня'], ['volume', '450']]), known)).toThrow('до 3');
    expect(() => parseCatalogDrink(form([['brand', 'Burn'], ['customFlavor', 'Манго+киви'], ['volume', '450']]), known)).toThrow('«:»');
    expect(() => parseCatalogDrink(form([['brand', 'Burn'], ['flavor', 'apple'], ['volume', '50']]), known)).toThrow('объёмов');
    expect(() => parseCatalogDrink(form([['brand', 'B'], ['flavor', 'apple'], ['volume', '450']]), known)).toThrow('бренд');
  });
});
