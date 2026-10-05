/** Unknown is an old aggregate, never a verified product identity. */
export function isResolvedFlavor(flavor: string): boolean {
  return Boolean(flavor) && flavor !== 'unknown' && !flavor.startsWith('unresolved:');
}

/** Verified Burn Zero Sugar Peach Mango aliases: retailer titles omit mango or zero. */
export function canonicalProductFlavor(brand: string | undefined, flavor: string): string {
  return brand === 'Burn' && (flavor === 'blend:mango+peach' || flavor === 'peach:sugarfree')
    ? 'blend:mango+peach:sugarfree' : flavor;
}
