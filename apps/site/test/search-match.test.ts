import { expect, it } from 'vitest';
import { searchMatches } from '../src/lib/search-match';
it('matches Russian and English typos and transpositions', () => {
  for (const [text, query] of [['Monster', 'monsetr'], ['Горилла', 'горила'], ['Пятёрочка', 'пятерчка'], ['Клубника', 'клубнка'], ['Red Bull', 'redbull']]) expect(searchMatches(text!, query!)).toBe(true);
  expect(searchMatches('Манго', 'молоко')).toBe(false);
  expect(searchMatches('Burn', 'bu')).toBe(true);
  expect(searchMatches('Burn', 'by')).toBe(false);
});
