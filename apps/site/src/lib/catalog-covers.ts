/** Reviewed covers ship with the app, independently of parser images and regional ordering. */
export function catalogCover(brand: string, flavor: string, fallback?: string): string | undefined {
  if (flavor !== 'original') return fallback;
  if (brand === 'Adrenaline Rush') return '/brand/products/adrenaline-rush-original.jpg';
  if (brand === 'Drive Me') return '/brand/products/drive-me-original.jpg';
  return fallback;
}
