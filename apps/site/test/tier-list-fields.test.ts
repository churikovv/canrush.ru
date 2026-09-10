import { describe, expect, it } from 'vitest';
import { parseTierListItems, validateTierListInput } from '../src/lib/tier-list-fields.js';

describe('tier list fields', () => {
  it('валидирует название и расположение товаров', () => {
    const result = validateTierListInput({
      title: '  Мои   любимые  ',
      items: JSON.stringify([
        { brand: 'Volt Energy', flavor: 'original', tier: 'S', position: 0 },
        { brand: 'Burn', flavor: 'apple', tier: 'A', position: 0 },
      ]),
    });

    expect(result).toEqual({
      data: {
        title: 'Мои любимые',
        items: [
          { brand: 'Volt Energy', flavor: 'original', tier: 'S', position: 0 },
          { brand: 'Burn', flavor: 'apple', tier: 'A', position: 0 },
        ],
      },
    });
  });

  it('разрешает сохранить пустой черновик', () => {
    expect(validateTierListInput({ title: 'Черновик', items: '[]' })).toEqual({
      data: { title: 'Черновик', items: [] },
    });
  });

  it('отклоняет дубликаты товаров и неизвестные категории', () => {
    const duplicate = JSON.stringify([
      { brand: 'Burn', flavor: 'apple', tier: 'S', position: 0 },
      { brand: 'Burn', flavor: 'apple', tier: 'A', position: 0 },
    ]);
    const unknownTier = JSON.stringify([{ brand: 'Burn', flavor: 'apple', tier: 'X', position: 0 }]);

    expect(parseTierListItems(duplicate)).toBeNull();
    expect(parseTierListItems(unknownTier)).toBeNull();
  });

  it('отклоняет некорректный JSON и слишком длинное название', () => {
    expect(validateTierListInput({ title: 'а'.repeat(81), items: '{' }).errors).toMatchObject({
      title: expect.any(String),
      items: expect.any(String),
    });
  });
});
