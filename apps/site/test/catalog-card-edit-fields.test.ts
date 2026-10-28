import { describe, expect, it } from 'vitest';
import type { CatalogGroup } from '@canrush/shared';
import { applyCardEdits, cardKey, mergeTarget, parseCardFullName, type CardEdit } from '../src/lib/catalog-card-edit-fields';

const offer = (price: number, url: string) => ({ source: 'edadeal' as const, retailer: 'Магнит', volumeMl: 450, price, url, fetchedAt: '2026-10-29T00:00:00.000Z' });
const group = (flavor: string, variants: CatalogGroup['variants'] = [], cover?: string): CatalogGroup => ({ brand: 'Tornado', flavor, variants, minPrice: variants.length ? Math.min(...variants.map(item => item.price)) : 0, ...(cover ? { coverImageUrl: cover } : {}) });
const edit = (flavor: string, patch: Partial<CardEdit>): CardEdit => ({ id: `id-${flavor}`, brand: 'Tornado', flavor, mergedInto: null, hidden: false, fullName: null, photoVersion: null, ...patch });

describe('catalog card edits', () => {
  it('moves a merged card offers to its target, keeping the target cover and the lowest price', () => {
    const groups = [group('tornado_black', [offer(99, 'a')], '/black.jpg'), group('Тропик', [offer(79, 'b'), offer(99, 'a')], '/tropic.jpg'), group('mango')];
    const result = applyCardEdits(groups, [edit('Тропик', { mergedInto: { brand: 'Tornado', flavor: 'tornado_black' } })]);
    expect(result.map(item => item.flavor)).toEqual(['tornado_black', 'mango']);
    expect(result[0]).toMatchObject({ coverImageUrl: '/black.jpg', minPrice: 79 });
    expect(result[0]!.variants.map(item => item.url).sort()).toEqual(['a', 'b']);
  });

  it('renames a merged card when its target is not in the list, and follows chains', () => {
    const edits = [edit('a', { mergedInto: { brand: 'Tornado', flavor: 'b' } }), edit('b', { mergedInto: { brand: 'Tornado', flavor: 'c' } })];
    expect(mergeTarget(new Map(edits.map(item => [cardKey(item.brand, item.flavor), item])), 'Tornado', 'a')).toEqual({ brand: 'Tornado', flavor: 'c' });
    expect(applyCardEdits([group('a', [offer(50, 'x')], '/a.jpg')], edits)).toEqual([{ ...group('a', [offer(50, 'x')], '/a.jpg'), flavor: 'c' }]);
  });

  it('hides cards and lays the name and our own cover over the parser data', () => {
    const result = applyCardEdits([group('apple', [], '/apple.jpg'), group('juice')], [
      edit('juice', { hidden: true }), edit('apple', { fullName: 'Tornado Apple Storm', photoVersion: 123 }),
    ]);
    expect(result).toEqual([{ ...group('apple'), fullName: 'Tornado Apple Storm', coverImageUrl: '/api/catalog-card-photos/id-apple/123' }]);
    expect(applyCardEdits(result, [])).toBe(result);
  });

  it('checks the full name', () => {
    expect(parseCardFullName('  Tornado   Max  Black ')).toBe('Tornado Max Black');
    expect(parseCardFullName('')).toBe('');
    expect(() => parseCardFullName('x')).toThrow('Полное название');
  });
});
