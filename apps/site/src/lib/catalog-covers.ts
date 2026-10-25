/** Reviewed covers ship with the app, independently of parser images and regional ordering. */
export function catalogCover(brand: string, flavor: string, fallback?: string): string | undefined {
  // Retailers attach the plain Zero Sugar can to this edition.
  if (brand === 'Monster' && flavor === 'monster_vr46:sugarfree') return '/brand/products/monster-vr46-zero.jpg';
  // A marketplace offer of plain Monster Zero Sugar ships an Ultra White photo, which reads as a duplicate.
  if (brand === 'Monster' && flavor === 'sugarfree') return '/brand/products/monster-zero-sugar.jpg';
  // Retailers only have a blurred, low-resolution photo of this can.
  if (brand === 'Scandalist' && flavor === 'scandalist_adder_terror') return '/brand/products/scandalist-adder-terror.jpg';
  // Retailers show another Tornado can for Iceberry; members asked for the real black-and-blue one.
  if (brand === 'Tornado' && flavor === 'tornado_iceberry') return '/brand/products/tornado-iceberry.jpg';
  if (flavor !== 'original') return fallback;
  if (brand === 'Adrenaline Rush') return '/brand/products/adrenaline-rush-original.jpg';
  if (brand === 'Drive Me') return '/brand/products/drive-me-original.jpg';
  // One retailer uploaded a blurred photo, and it is the first offer of the group.
  if (brand === 'Tornado') return '/brand/products/tornado-original.jpg';
  return fallback;
}
