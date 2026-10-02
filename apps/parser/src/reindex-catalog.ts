import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { CITIES, type Product } from '@canrush/shared';
import { loadProductsConfig } from './config.js';
import { normalizeProduct } from './normalize.js';
import { DATA_DIR, filterSuspiciousVariants, groupByFlavor, saveSiteCatalog } from './storage.js';
import { loadSnapshot, saveSnapshot } from './regions.js';
import { writeAtomic } from './atomic-file.js';
/** Repair identities from saved raw names, without downloading offers or images. */
export async function reindexCatalog() {
  const config = loadProductsConfig();
  const normalize = (products: Product[]) => products.map(product => {
    const normalized = normalizeProduct(product.source, { ...product, flavor: product.source === 'edadeal' ? undefined : product.flavor }, config.brands, product.fetchedAt, config.brandAliases, config.flavors, config.flavorAliases);
    return { ...product, ...normalized, volumeMl: normalized.volumeMl ?? product.volumeMl };
  });
  for (const city of CITIES) {
    const snapshot = await loadSnapshot(city.id); if (!snapshot) continue;
    const products = normalize(snapshot.products);
    await saveSnapshot({ ...snapshot, products, groups: filterSuspiciousVariants(groupByFlavor(products)) });
    console.log(`[reindex] ${city.name}: ${products.length} предложений`);
  }
  try {
    const filename = path.join(DATA_DIR, 'latest.json');
    const data = JSON.parse(await readFile(filename, 'utf8')) as { products: Product[]; generatedAt: string };
    const products = normalize(data.products);
    const groups = filterSuspiciousVariants(groupByFlavor(products));
    await writeAtomic(filename, JSON.stringify({ ...data, products, groups }));
    await saveSiteCatalog(groups, data.generatedAt);
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
}
