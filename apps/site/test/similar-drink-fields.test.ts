import { describe, expect, it } from 'vitest';
import { rankSimilarDrinks, similarReasonText, SIMILAR_LIMIT, type SimilarCandidate } from '../src/lib/similar-drink-fields.js';
import { drinkKey, opinions, type TasteProfile } from '../src/lib/story-recommendations.js';

const drink = (brand: string, flavor: string, extra: Partial<SimilarCandidate> = {}): SimilarCandidate => ({ brand, flavor, inStock: true, ...extra });
const member = (likes: [string, string][], dislikes: [string, string][] = []) => opinions({
  favorites: [], drinks: [],
  reviews: [...likes.map(([brand, flavor]) => ({ brand, flavor, taste: 9, design: 8 })), ...dislikes.map(([brand, flavor]) => ({ brand, flavor, taste: 2, design: 5 }))],
} satisfies TasteProfile);
const names = (items: { brand: string; flavor: string }[]) => items.map(item => `${item.brand} ${item.flavor}`);

describe('«Похожее»', () => {
  const target = { brand: 'Burn', flavor: 'mango' };

  it('suggests what the fans of this drink like, and says so', () => {
    const fans = [member([['Burn', 'mango'], ['Volt', 'original']]), member([['Burn', 'mango'], ['Volt', 'original']])];
    const ranked = rankSimilarDrinks(target, [drink('Gorilla', 'original'), drink('Volt', 'original')], fans);
    expect(ranked[0]).toMatchObject({ brand: 'Volt', flavor: 'original', reason: { kind: 'fans', fans: 2 } });
    expect(similarReasonText(ranked[0]!.reason!)).toBe('Нравится тем, кому нравится этот');
  });

  it('leaves out what the fans of this drink dislike', () => {
    const fans = [1, 2, 3].map(() => member([['Burn', 'mango']], [['Gorilla', 'original']]));
    expect(names(rankSimilarDrinks(target, [drink('Gorilla', 'original'), drink('Tornado', 'mango')], fans))).toEqual(['Tornado mango']);
  });

  it('puts a single flavour before a mix that only shares part of it', () => {
    const ranked = rankSimilarDrinks(target, [drink('Black Rocket', 'blend:apricot+mango'), drink('Tornado', 'mango')], []);
    expect(names(ranked)).toEqual(['Tornado mango', 'Black Rocket blend:apricot+mango']);
    expect(ranked.map(item => similarReasonText(item.reason!))).toEqual(['Тоже с манго', 'Тоже с манго']);
  });

  it('names another version of the same flavour', () => {
    const [version] = rankSimilarDrinks(target, [drink('Burn', 'mango:sugarfree')], []);
    expect(similarReasonText(version!.reason!)).toBe('Этот же вкус без сахара');
    const [sweet] = rankSimilarDrinks({ brand: 'Gorilla', flavor: 'sugarfree' }, [drink('Gorilla', 'original')], []);
    expect(similarReasonText(sweet!.reason!)).toBe('Этот же вкус с сахаром');
  });

  it('shows what the viewer has not tried before what they know', () => {
    const tried = new Set([drinkKey({ brand: 'Tornado', flavor: 'mango' })]);
    expect(names(rankSimilarDrinks(target, [drink('Tornado', 'mango'), drink('Gorilla', 'mango')], [], { tried }))).toEqual(['Gorilla mango', 'Tornado mango']);
  });

  it('never suggests the drink itself, keeps three of a brand at most and stops at the limit', () => {
    const candidates = [drink('Burn', 'mango'), ...['a', 'b', 'c', 'd', 'e'].map(name => drink('Burn', `mango_${name}`)), ...Array.from({ length: 20 }, (_, index) => drink(`Brand ${index}`, 'mango'))];
    const ranked = rankSimilarDrinks(target, candidates, []);
    expect(ranked).toHaveLength(SIMILAR_LIMIT);
    expect(names(ranked)).not.toContain('Burn mango');
    expect(ranked.filter(item => item.brand === 'Burn').length).toBeLessThanOrEqual(3);
  });

  it('ignores drinks with nothing in common', () => {
    expect(rankSimilarDrinks(target, [drink('Gorilla', 'cherry', { inStock: false })], [])).toEqual([]);
  });
});
