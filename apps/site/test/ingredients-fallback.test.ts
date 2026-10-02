import { expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ readFile: vi.fn() }));
vi.mock('node:fs/promises', () => ({ readFile: mocks.readFile }));
import { getProductIngredients } from '../src/lib/ingredients';
import bundled from '../src/content/ingredients.json';
it('loads bundled compositions when the runtime file is absent', async () => {
  mocks.readFile.mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }));
  expect(bundled.products).toHaveLength(46);
  for (const record of bundled.products) {
    expect(await getProductIngredients(record.brand, record.flavor)).toEqual(record);
  }
});
it('preserves explicit runtime removals and does not mask corrupt files', async () => {
  const record = bundled.products[0]!;
  mocks.readFile.mockResolvedValue(JSON.stringify({ version: 1, products: [] }));
  expect(await getProductIngredients(record.brand, record.flavor)).toBeNull();
  mocks.readFile.mockResolvedValue('{broken');
  expect(await getProductIngredients(record.brand, record.flavor)).toBeNull();
});
