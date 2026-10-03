import type { TierListProduct } from './tier-list-types';

export type TierProductSort = 'popular' | 'rating' | 'stores' | 'price';
export function compareTierProducts(a: TierListProduct, b: TierListProduct, sort: TierProductSort): number {
  let difference = 0;
  if (sort === 'popular') difference = b.reviewCount - a.reviewCount;
  if (sort === 'rating') difference = (b.score ?? -1) - (a.score ?? -1) || b.reviewCount - a.reviewCount;
  if (sort === 'stores') difference = b.retailerCount - a.retailerCount;
  if (sort === 'price') {
    const left = a.price && a.price > 0 ? a.price : Infinity;
    const right = b.price && b.price > 0 ? b.price : Infinity;
    difference = left === right ? 0 : left - right;
  }
  return difference || a.brand.localeCompare(b.brand, 'ru-RU') || a.flavorLabel.localeCompare(b.flavorLabel, 'ru-RU');
}
