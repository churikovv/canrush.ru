import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { reviewedProductIdentity, canonicalProductFlavor, type CatalogGroup } from '@canrush/shared';
import { writeAtomic } from './atomic-file.js';
const registryPath = path.resolve(import.meta.dirname, '../../site/data/product-registry.json');
export function mergeProductRegistry(previous: CatalogGroup[], incoming: CatalogGroup[]): CatalogGroup[] {
  const result = new Map<string, CatalogGroup>();
  for (const original of [...previous, ...incoming]) {
    const identity = reviewedProductIdentity(original.brand, original.flavor);
    const group = { ...original, ...identity, flavor: canonicalProductFlavor(identity.brand, identity.flavor) };
    const key = JSON.stringify([group.brand, group.flavor]);
    const old = result.get(key);
    const coverImageUrl = old?.coverImageUrl?.startsWith('/images/') && !group.coverImageUrl?.startsWith('/images/') ? old.coverImageUrl : group.coverImageUrl || old?.coverImageUrl;
    result.set(key, { brand: group.brand, flavor: group.flavor, coverImageUrl, variants: [], minPrice: 0 });
  }
  return [...result.values()];
}
export async function archiveProducts(groups: CatalogGroup[], file = registryPath) {
  await mkdir(path.dirname(file), { recursive: true });
  const lock = `${file}.lock`;
  const deadline = Date.now() + 30_000;
  for (;;) {
    try { await mkdir(lock); break; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST' || Date.now() >= deadline) throw error;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  try {
    let previous: CatalogGroup[] = [];
    try { previous = (JSON.parse(await readFile(file, 'utf8')) as { groups: CatalogGroup[] }).groups; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    await writeAtomic(file, JSON.stringify({ groups: mergeProductRegistry(previous, groups) }));
  } finally { await rm(lock, { recursive: true, force: true }); }
}
