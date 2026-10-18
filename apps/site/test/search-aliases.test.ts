import { expect, it } from 'vitest';
import type { CatalogGroup } from '@canrush/shared';
import { matchesCatalogQuery } from '../src/lib/catalog-query';
import { brandSearchTerms, transliterate } from '../src/lib/search-aliases';

const group = (brand: string, flavor = 'original'): CatalogGroup => ({ brand, flavor, variants: [], minPrice: 0 });

it('finds brands by their Russian spelling and by transliteration', () => {
  for (const [brand, query] of [
    ['Ashkudi', 'ашкуди'], ['Tassay', 'тассай'], ['Juster', 'джастер'], ['Genesis', 'генезис'], ['Quantum', 'квантум'],
    ['By Баста', 'баста'], ['By Баста', 'basta'], ['Wk Up', 'вейк ап'], ['HQD Energy', 'хкд'], ['Байкал', 'baikal'],
    ['Восторг', 'vostorg'], ['Scandalist', 'скандалист'], ['Neft', 'нефть'], ['Alligator', 'алигатор'], ['100 Kwt', 'квт'],
    ['Adrenaline Rush', 'адреналин'], ['Red Bull', 'ред булл'], ['Bizon', 'бизон'],
  ] as const) expect(matchesCatalogQuery(group(brand), query), `${brand} ← ${query}`).toBe(true);
});

it('finds flavors typed in Latin letters and keeps unrelated brands out', () => {
  expect(matchesCatalogQuery(group('Burn', 'orange'), 'apelsin')).toBe(true);
  expect(matchesCatalogQuery(group('Burn'), 'ашкуди')).toBe(false);
  expect(matchesCatalogQuery(group('Tassay'), 'баста')).toBe(false);
});

it('transliterates both ways and lists each spelling once', () => {
  expect(transliterate('Ashkudi')).toBe('ашкуди');
  expect(transliterate('Байкал')).toBe('baykal');
  const terms = brandSearchTerms('Tassay');
  expect(terms).toEqual([...new Set(terms)]);
  expect(terms).toContain('Тассай');
});
