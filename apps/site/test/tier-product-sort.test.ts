import { expect, it } from 'vitest';
import { compareTierProducts, type TierProductSort } from '../src/lib/tier-product-sort';
import type { TierListProduct } from '../src/lib/tier-list-types';
const products: TierListProduct[] = [
  { id: 'none', brand: 'A', flavor: 'original', flavorLabel: 'Original', retailerCount: 0, reviewCount: 0 },
  { id: 'popular', brand: 'B', flavor: 'original', flavorLabel: 'Original', retailerCount: 2, reviewCount: 20, score: 7, price: 80 },
  { id: 'rated', brand: 'C', flavor: 'original', flavorLabel: 'Original', retailerCount: 8, reviewCount: 3, score: 10, price: 120 },
];
it('sorts by actual counts, ratings, availability and prices, with missing values last', () => {
  for (const [sort, expected] of Object.entries({ popular: ['popular', 'rated', 'none'], rating: ['rated', 'popular', 'none'], stores: ['rated', 'popular', 'none'], price: ['popular', 'rated', 'none'] })) {
    expect([...products].sort((a,b) => compareTierProducts(a,b,sort as TierProductSort)).map(p=>p.id)).toEqual(expected);
  }
});
