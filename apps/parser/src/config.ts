import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ENERGY_DRINK_BRAND_ALIASES, type BrandAliases, type ProductsConfig } from '@canrush/shared';

const CONFIG_PATH = path.resolve(import.meta.dirname, '../config/products.json');

/** Загружает apps/parser/config/products.json (категория, бренды, конфиг по источникам). */
export function loadProductsConfig(): ProductsConfig {
  const raw = readFileSync(CONFIG_PATH, 'utf-8');
  const config = JSON.parse(raw) as ProductsConfig;
  const brandAliases: BrandAliases = { ...ENERGY_DRINK_BRAND_ALIASES };
  for (const [brand, aliases] of Object.entries(config.brandAliases ?? {})) {
    brandAliases[brand] = [...new Set([...(brandAliases[brand] ?? []), ...aliases])];
  }
  return { ...config, brandAliases };
}

export { CONFIG_PATH };
