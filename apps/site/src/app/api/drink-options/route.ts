import { gzipSync } from 'node:zlib';
import { drinkCatalog } from '@/lib/wall-drinks';

export const runtime = 'nodejs';

// The same list for everyone: it is built and gzipped once per catalog read, not per request.
let built: { source: unknown; json: string; gzip: Buffer } | null = null;

/**
 * Catalog drinks for the drink picker of wall records and comments: loaded when the picker opens, not with every feed
 * page. The catalog is public, so it is cached for ten minutes. A route handler's answer is not compressed on the way
 * (pages are), and the list is over a thousand drinks, so it is gzipped here: about 270 KB becomes a few dozen.
 */
export async function GET(request: Request) {
  const catalog = await drinkCatalog();
  if (built?.source !== catalog) {
    const json = JSON.stringify([...catalog.values()].map(({ brand, flavor, label, cover, fullName }) => ({ brand, flavor, label, ...(cover ? { cover } : {}), ...(fullName ? { fullName } : {}) })));
    built = { source: catalog, json, gzip: gzipSync(json) };
  }
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=600', Vary: 'Accept-Encoding' };
  return /\bgzip\b/.test(request.headers.get('accept-encoding') ?? '')
    ? new Response(new Uint8Array(built.gzip), { headers: { ...headers, 'Content-Encoding': 'gzip' } })
    : new Response(built.json, { headers });
}
