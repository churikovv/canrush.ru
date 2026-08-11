import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ProductsConfig } from '@canrush/shared';

const CONFIG_PATH = path.resolve(import.meta.dirname, '../config/products.json');

/** Загружает apps/parser/config/products.json (категория, бренды, конфиг по источникам). */
export function loadProductsConfig(): ProductsConfig {
  const raw = readFileSync(CONFIG_PATH, 'utf-8');
  return JSON.parse(raw) as ProductsConfig;
}

export { CONFIG_PATH };
