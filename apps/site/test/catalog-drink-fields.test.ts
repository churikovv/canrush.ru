import { describe, expect, it } from 'vitest';
import { CatalogDrinkError, drinkFlavorKey, parseCatalogDrink, parseCatalogDrinkEdit } from '../src/lib/catalog-drink-fields';
import { flavorName } from '../src/lib/catalog-query';

const known = new Set(['mango', 'passion_fruit', 'apple']);
const form = (entries: [string, string][]) => { const data = new FormData(); for (const [key, value] of entries) data.append(key, value); return data; };

describe('catalog drink form', () => {
  it('builds the catalog flavour key the way the parser does', () => {
    expect(drinkFlavorKey({ flavors: ['passion_fruit', 'mango'], sugar: 'free' })).toBe('blend:mango+passion_fruit:sugarfree');
    expect(flavorName('blend:mango+passion_fruit:sugarfree')).toBe('Манго + Маракуйя · без сахара');
    expect(drinkFlavorKey({ flavors: [], custom: ['  дыня   и огурец '], sugar: 'regular' })).toBe('Дыня и огурец');
    expect(flavorName('Дыня и огурец:sugarfree')).toBe('Дыня и огурец · без сахара');
    // Own names mix with known flavours in one blend.
    expect(drinkFlavorKey({ flavors: ['mango'], custom: ['огурец'], sugar: 'regular' })).toBe('blend:mango+Огурец');
    expect(flavorName('blend:mango+Огурец')).toBe('Манго + Огурец');
    // A sweetener version is its own drink next to the regular one.
    expect(drinkFlavorKey({ flavors: ['lime', 'melon', 'mint'], sugar: 'sweetener' })).toBe('blend:lime+melon+mint:sweetener');
    expect(flavorName('blend:lime+melon+mint:sweetener')).toBe('Лайм + Дыня + Мята · с сахарозаменителем');
  });

  it('reads brand, flavour, volumes and the label text', () => {
    expect(parseCatalogDrink(form([['brand', ' Burn '], ['flavor', 'apple'], ['volume', '450'], ['volume', '250'], ['volume', '450'], ['ingredients', 'Вода,  сахар\r\n\r\n\r\nтаурин']]), known))
      .toEqual({ brand: 'Burn', flavor: 'apple', fullName: '', volumes: [250, 450], ingredients: 'Вода, сахар\n\nтаурин' });
  });

  it('reads the optional full name from the can, spaces collapsed, up to 80 characters', () => {
    const base: [string, string][] = [['brand', 'Monster'], ['flavor', 'apple'], ['volume', '500']];
    expect(parseCatalogDrink(form([...base, ['fullName', '  Monster   Ultra Paradise ']]), known).fullName).toBe('Monster Ultra Paradise');
    expect(() => parseCatalogDrink(form([...base, ['fullName', 'M']]), known)).toThrow('Полное название');
    expect(() => parseCatalogDrink(form([...base, ['fullName', 'x'.repeat(81)]]), known)).toThrow('Полное название');
  });

  it('reads the admin edit: volumes from one field, brand and flavour only when the form has them', () => {
    expect(parseCatalogDrinkEdit(form([['fullName', 'Monster  Ultra'], ['volumes', '500, 250; 500'], ['ingredients', 'Вода']])))
      .toEqual({ fullName: 'Monster Ultra', volumes: [250, 500], ingredients: 'Вода' });
    expect(parseCatalogDrinkEdit(form([['brand', ' Burn '], ['flavor', ' blend:mango+peach '], ['volumes', '450']])))
      .toMatchObject({ brand: 'Burn', flavor: 'blend:mango+peach', volumes: [450] });
    expect(() => parseCatalogDrinkEdit(form([['volumes', '50']]))).toThrow('объёмов');
    expect(() => parseCatalogDrinkEdit(form([['brand', 'Burn'], ['flavor', ''], ['volumes', '450']]))).toThrow('ключ вкуса');
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
