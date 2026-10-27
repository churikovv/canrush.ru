import { BRAND_SEARCH_ALIASES } from '@/lib/search-aliases';

export type SearchScope = 'catalog' | 'stores' | 'market';

/** One spelling per search: lower case, single spaces, NFKC (full-width digits and the like), at most 80 characters. */
export function normalizeSearchQuery(query: string): string {
  return query.normalize('NFKC').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim().slice(0, 80);
}

/**
 * How a brand can be written in a search: its name and its search aliases (`BRAND_SEARCH_ALIASES`), normalised like
 * the stored queries. Used to count searches that name the brand, whatever came back.
 */
export function brandSearchNames(brand: string): string[] {
  return [...new Set([brand, ...(BRAND_SEARCH_ALIASES[brand] ?? [])].map(normalizeSearchQuery).filter(name => name.length >= 2))];
}
