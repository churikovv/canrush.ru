import registry from './product-slugs.json';
import { canonicalProductFlavor } from '@canrush/shared';

const slugs: Record<string, string> = registry;
const identities = new Map(Object.entries(slugs).map(([key, slug]) => [slug, JSON.parse(key) as [string, string]]));
const letters: Record<string, string> = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya' };

function readable(value: string) {
  return [...value.toLowerCase()].map(char => letters[char] ?? char).join('')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Frozen registry slugs never depend on stock, city, ordering or display translations. */
export function productSlug(brand: string, flavor: string): string {
  flavor = canonicalProductFlavor(brand, flavor);
  const key = JSON.stringify([brand, flavor]);
  if (slugs[key]) return slugs[key];
  // New identities work before the next registry update. Stable 64-bit suffix
  // disambiguates transliteration and punctuation without embedding mutable data.
  let hash = 14695981039346656037n;
  for (const char of new TextEncoder().encode(key)) hash = BigInt.asUintN(64, (hash ^ BigInt(char)) * 1099511628211n);
  const name = readable(brand + '-' + flavor.replace(/^blend:/, '').replace(/sugarfree/g, 'zero')).slice(0, 120);
  return `${name || 'drink'}-${hash.toString(36)}`;
}

export function registeredProductIdentity(slug: string): { brand: string; flavor: string } | null {
  const identity = identities.get(slug);
  return identity ? { brand: identity[0], flavor: identity[1] } : null;
}
