import { drinkCatalog } from '@/lib/wall-drinks';

/**
 * Catalog drinks for the drink picker of wall records and comments: loaded when the picker opens, not with every feed
 * page. The catalog is public, so it is cached for ten minutes.
 */
export async function GET() {
  const options = [...(await drinkCatalog()).values()].map(({ brand, flavor, label, cover, fullName }) => ({ brand, flavor, label, ...(cover ? { cover } : {}), ...(fullName ? { fullName } : {}) }));
  return Response.json(options, { headers: { 'Cache-Control': 'public, max-age=600' } });
}
