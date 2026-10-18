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

/**
 * Archived identities keep the cover their last offer had. When that run failed to download it,
 * the cover stays a CDN link that later expires and is skipped by local-only previews, and the
 * product never comes back to retry. Downloads run outside the lock; results merge like any
 * archive write, where a local cover wins over a remote one.
 */
export async function localizeRegistryCovers(
  download: (url: string) => Promise<string | undefined>,
  options: { file?: string; pause?: () => Promise<void> } = {},
): Promise<{ repaired: number; failed: number }> {
  const file = options.file ?? registryPath;
  let groups: CatalogGroup[];
  try { groups = (JSON.parse(await readFile(file, 'utf8')) as { groups: CatalogGroup[] }).groups; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { repaired: 0, failed: 0 }; throw error; }
  const remote = groups.filter(group => group.coverImageUrl?.startsWith('https://'));
  const repaired: CatalogGroup[] = [];
  for (const [index, group] of remote.entries()) {
    const local = await download(group.coverImageUrl!);
    if (local) repaired.push({ brand: group.brand, flavor: group.flavor, coverImageUrl: local, variants: [], minPrice: 0 });
    if (index < remote.length - 1) await options.pause?.();
  }
  if (repaired.length) await archiveProducts(repaired, file);
  return { repaired: repaired.length, failed: remote.length - repaired.length };
}
