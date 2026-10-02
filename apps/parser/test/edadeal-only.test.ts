import { expect, it } from 'vitest';
import { adapters } from '../src/adapters/index.js';
import { loadProductsConfig } from '../src/config.js';
import { runParser } from '../src/run.js';
it('registers and configures only Edadeal, and rejects removed sources before fetching', async () => {
  expect(Object.keys(adapters)).toEqual(['edadeal']);
  expect(Object.keys(loadProductsConfig().sources)).toEqual(['edadeal']);
  await expect(runParser({ sources: ['ozon'] })).rejects.toThrow('только источник edadeal');
});
