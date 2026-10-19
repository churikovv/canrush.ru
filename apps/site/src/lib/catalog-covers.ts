/** Reviewed covers ship with the app, independently of parser images and regional ordering. */
export function catalogCover(brand: string, flavor: string, fallback?: string): string | undefined {
  // Retailers attach the plain Zero Sugar can to this edition.
  if (brand === 'Monster' && flavor === 'monster_vr46:sugarfree') return '/brand/products/monster-vr46-zero.jpg';
  // A marketplace offer of plain Monster Zero Sugar ships an Ultra White photo, which reads as a duplicate.
  if (brand === 'Monster' && flavor === 'sugarfree') return '/brand/products/monster-zero-sugar.jpg';
  if (flavor !== 'original') return fallback;
  if (brand === 'Adrenaline Rush') return '/brand/products/adrenaline-rush-original.jpg';
  if (brand === 'Drive Me') return '/brand/products/drive-me-original.jpg';
  // One retailer uploaded a blurred photo, and it is the first offer of the group.
  if (brand === 'Tornado') return '/brand/products/tornado-original.jpg';
  return fallback;
}
