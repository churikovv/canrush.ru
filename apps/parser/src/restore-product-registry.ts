import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { CatalogGroup } from '@canrush/shared';
import { archiveProducts } from './product-registry.js';
import { cachedImage } from './images.js';
const data = path.resolve(import.meta.dirname, '../../../data');
const site = path.resolve(import.meta.dirname, '../../site/data');
async function files(directory: string): Promise<string[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const result: string[] = [];
    for (const entry of entries) {
      if (entry.name === 'raw' || entry.name.endsWith('.lock')) continue;
      const name = path.join(directory, entry.name);
      if (entry.isDirectory()) result.push(...await files(name));
      else if (entry.name.endsWith('.json') && entry.name !== 'product-registry.json') result.push(name);
    }
    return result;
  } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
}
let restored = 0;
for (const file of [...await files(data), ...await files(site)].sort()) {
  const snapshot = JSON.parse(await readFile(file, 'utf8')) as { groups?: CatalogGroup[] };
  if (!Array.isArray(snapshot.groups)) continue;
  const groups = await Promise.all(snapshot.groups.map(async group => ({ ...group, coverImageUrl: group.coverImageUrl && !group.coverImageUrl.startsWith('/') ? await cachedImage(group.coverImageUrl) ?? group.coverImageUrl : group.coverImageUrl })));
  await archiveProducts(groups);
  restored += groups.length;
}
console.log(`Registry updated from ${restored} historical product entries. No downloads requested.`);
