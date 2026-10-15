import { reviewedProductIdentity } from './reviewed-product-aliases.js';
/** Unknown is an old aggregate, never a verified product identity. */
export function isResolvedFlavor(flavor: string): boolean {
  return Boolean(flavor) && flavor !== 'unknown' && !flavor.startsWith('unresolved:');
}

/** Verified aliases for retailer titles that omit part of a product name. */
export function canonicalProductFlavor(brand: string | undefined, flavor: string): string {
  const reviewedIdentity = reviewedProductIdentity(brand ?? '', flavor);
  brand = reviewedIdentity.brand; flavor = reviewedIdentity.flavor;
  if (brand === 'Monster') {
    const reviewed: Record<string, string> = {
      mango: 'monster_mango_loco',
      'unresolved:263797c983e786005750a4f6': 'monster_bad_apple',
      'unresolved:5728c1f5c98f51d6e2c5ccd2': 'monster_ultra_rosa',
      'unresolved:a5c012183b7ff4462e51f4fc': 'monster_ultra_watermelon',
    };
    if (reviewed[flavor]) return reviewed[flavor]!;
  }
  if (brand === 'Monster' && flavor.endsWith(':sugarfree')) {
    const edition = flavor.slice(0, -':sugarfree'.length);
    // These editions are inherently zero-sugar; VR46, Original and juice lines are not.
    if (edition.startsWith('monster_ultra_') || edition === 'monster_absolute_zero' || edition === 'monster_full_throttle') return edition;
  }
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
const EXCLUDED_ENERGY_BRANDS = new Set(['pepsi', 'пепси', 'dr. pepper', 'dr pepper', 'доктор пеппер']);
export function isExcludedEnergyBrand(brand: string | undefined): boolean {
  return EXCLUDED_ENERGY_BRANDS.has((brand ?? '').trim().toLowerCase());
}

/** A flyer listing several Burn editions is not a single drink or a sugar-free variant. */
export function isMixedBurnOffer(brand: string | undefined, title: string): boolean {
  return brand === 'Burn' && title.split(';').length >= 3
    && /сочная\s+энергия/iu.test(title) && /оригинальн/iu.test(title);
}

/** A flyer "в ассортименте" stands for several drinks, so it never becomes a product card. */
export function isAssortmentOffer(flavor: string | undefined, title: string): boolean {
  return !flavor && /(?:^|[^a-zа-яё])в\s+ассортименте(?=$|[^a-zа-яё])/iu.test(title);
}

/** Source flyers offer an assortment, not one identifiable drink. Keep old URLs only. */
export function isAssortmentFlavor(flavor: string): boolean {
  return new Set([
    'unresolved:60396be429e67ccda809b2ce', 'unresolved:2c1c23f860fbc7a92b360cc5',
    'unresolved:0cfddc502558b3d4acf37b8c', 'unresolved:6f98614815925e033e75dbb9',
    'unresolved:7f516352068e02893726783f', 'unresolved:e0f63668e506c70a2c34e3a1',
    'unresolved:5905a894223acba9c92f77a6', 'unresolved:f6f432c378e1fba5092c3918',
    'unresolved:f8afa2cd1aacb8228b4920b0', 'unresolved:31499aa17539fa00766c03c7',
    'unresolved:5f313765398cc24a9275d081',
  ]).has(flavor);
}
