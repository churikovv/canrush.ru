import { expect, it } from 'vitest';
import { pageWindow } from '../src/lib/pagination';

it('shows the ends, the neighbours of the current page and gaps only over two or more pages', () => {
  expect(pageWindow(1, 0)).toEqual([]);
  expect(pageWindow(1, 1)).toEqual([1]);
  expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
  expect(pageWindow(1, 10)).toEqual([1, 2, 'gap', 10]);
  expect(pageWindow(4, 10)).toEqual([1, 2, 3, 4, 5, 'gap', 10]);
  expect(pageWindow(6, 10)).toEqual([1, 'gap', 5, 6, 7, 'gap', 10]);
  expect(pageWindow(10, 10)).toEqual([1, 'gap', 9, 10]);
  expect(pageWindow(40, 10)).toEqual([1, 'gap', 9, 10]);
});
