/** Unknown is an old aggregate, never a verified product identity. */
export function isResolvedFlavor(flavor: string): boolean {
  return Boolean(flavor) && flavor !== 'unknown' && !flavor.startsWith('unresolved:');
}

/** Verified aliases for retailer titles that omit part of a product name. */
export function canonicalProductFlavor(brand: string | undefined, flavor: string): string {
  if (brand === 'Volt Energy' && flavor === 'blueberry') return 'blend:blueberry+pomegranate';
  if (brand === 'Vulkan') {
    const aliases: Record<string, string> = {
      'blend:mango+passion_fruit': 'tropical',
      'blend:mango+passion_fruit+tropical': 'tropical',
      'blend:citrus+pineapple': 'citrus',
      'blend:berry+pomegranate+raspberry': 'berry',
    };
    return aliases[flavor] ?? flavor;
  }
  return brand === 'Burn' && (flavor === 'blend:mango+peach' || flavor === 'peach:sugarfree')
    ? 'blend:mango+peach:sugarfree' : flavor;
}

/** Known non-energy labels supplied incorrectly by the source. Extend after review. */
const EXCLUDED_ENERGY_BRANDS = new Set(['pepsi', 'пепси']);
export function isExcludedEnergyBrand(brand: string | undefined): boolean {
  return EXCLUDED_ENERGY_BRANDS.has((brand ?? '').trim().toLowerCase());
}

/** A flyer listing several Burn editions is not a single drink or a sugar-free variant. */
export function isMixedBurnOffer(brand: string | undefined, title: string): boolean {
  return brand === 'Burn' && title.split(';').length >= 3
    && /сочная\s+энергия/iu.test(title) && /оригинальн/iu.test(title);
}
