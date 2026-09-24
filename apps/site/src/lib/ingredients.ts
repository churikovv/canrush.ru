import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { isPublishedIngredients, type PublishedIngredients } from '@canrush/shared';

export function selectIngredients(data: unknown, brand: string, flavor: string): PublishedIngredients | null {
  if (!data || typeof data !== 'object') return null;
  const snapshot = data as { version?: unknown; products?: unknown };
  if (snapshot.version !== 1 || !Array.isArray(snapshot.products)) return null;
  const matches = snapshot.products.filter(isPublishedIngredients).filter((p) => p.brand === brand && p.flavor === flavor);
  return matches.length === 1 ? matches[0] ?? null : null;
}

export async function getProductIngredients(brand: string, flavor: string): Promise<PublishedIngredients | null> {
  try {
    const raw = await readFile(path.join(process.cwd(), 'data/ingredients.json'), 'utf8');
    return selectIngredients(JSON.parse(raw), brand, flavor);
  } catch {
    // Composition is supplementary: missing or corrupt data must not break the product page.
    return null;
  }
}
