/** A source excerpt explicitly selected for a catalog group, not a lab-verified recipe. */
export interface PublishedIngredients {
  brand: string;
  flavor: string;
  productTitle: string;
  volumeMl: number;
  market: 'RU' | 'BY';
  ingredients: string;
  sourceName: string;
  sourceUrl: string;
  fetchedAt: string;
  status: 'source_reported' | 'unverified';
  /** Explains the specific uncertainty before showing preliminary source text. */
  reviewNote?: string;
}

export function isPublishedIngredients(value: unknown): value is PublishedIngredients {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  for (const key of ['brand', 'flavor', 'productTitle', 'ingredients', 'sourceName', 'sourceUrl', 'fetchedAt']) {
    if (typeof row[key] !== 'string' || !row[key].trim()) return false;
  }
  if ((row.ingredients as string).length > 2500 || (row.ingredients as string).length < 35) return false;
  if (!['source_reported', 'unverified'].includes(row.status as string) || !['RU', 'BY'].includes(row.market as string)) return false;
  if (row.reviewNote !== undefined && (typeof row.reviewNote !== 'string' || !row.reviewNote.trim() || row.reviewNote.length > 500)) return false;
  if (row.status === 'unverified' && typeof row.reviewNote !== 'string') return false;
  if (!Number.isInteger(row.volumeMl) || (row.volumeMl as number) <= 0 || (row.volumeMl as number) > 5000) return false;
  if (!Number.isFinite(Date.parse(row.fetchedAt as string))) return false;
  try {
    const url = new URL(row.sourceUrl as string);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
}
