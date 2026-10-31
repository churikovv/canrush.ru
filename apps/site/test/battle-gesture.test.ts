import { expect, it } from 'vitest';
import { releasedOnTable } from '../src/lib/battle-gesture';

it('plays a card released above the hand, however slowly', () => {
  expect(releasedOnTable(400, 650, 0)).toBe(true);
});

it('plays a card thrown upward even if it was released over the hand', () => {
  expect(releasedOnTable(700, 650, 1.2)).toBe(true);
});

it('returns a card put down over the hand or pulled down', () => {
  expect(releasedOnTable(700, 650, 0.1)).toBe(false);
  expect(releasedOnTable(700, 650, -1)).toBe(false);
});
