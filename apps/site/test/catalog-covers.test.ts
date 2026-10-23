import { expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { catalogCover } from '../src/lib/catalog-covers';
import { mergeCatalogAliases } from '../src/lib/catalog-files';
it('pins reviewed original covers across changing parser snapshots without changing offers',()=>{
 for(const brand of ['Adrenaline Rush','Drive Me','Tornado']) {
  const group={brand,flavor:'original',coverImageUrl:'/images/products/random.jpg',variants:[],minPrice:0};
  const result=mergeCatalogAliases([group])[0]!;
  expect(result.coverImageUrl).toBe(catalogCover(brand,'original'));
  expect(existsSync(`public${result.coverImageUrl}`)).toBe(true);
  expect(result.variants).toEqual([]);
  expect(catalogCover(brand,'original','new-parser-photo.jpg')).toBe(result.coverImageUrl);
 }
});
it('leaves other flavors and brands untouched',()=>{
 expect(catalogCover('Adrenaline Rush','sugarfree','zero.jpg')).toBe('zero.jpg');
 expect(catalogCover('Drive Me','berry','berry.jpg')).toBe('berry.jpg');
 expect(catalogCover('Burn','original','burn.jpg')).toBe('burn.jpg');
});

it('replaces the plain Zero Sugar photo retailers attach to Monster VR46 Zero', () => {
  expect(catalogCover('Monster', 'monster_vr46:sugarfree', '/images/products/3a006c5024a80ca0.jpg')).toBe('/brand/products/monster-vr46-zero.jpg');
  expect(catalogCover('Monster', 'monster_vr46', '/images/products/x.jpg')).toBe('/images/products/x.jpg');
  expect(catalogCover('Monster', 'sugarfree', '/images/products/ultra-white.jpg')).toBe('/brand/products/monster-zero-sugar.jpg');
  for (const file of ['monster-vr46-zero.jpg', 'monster-zero-sugar.jpg']) expect(existsSync(`public/brand/products/${file}`)).toBe(true);
});

it('pins the sharp Scandalist Adder Terror cover over the blurred retailer photo', () => {
  expect(catalogCover('Scandalist', 'scandalist_adder_terror', '/images/products/eff81b529f94cb32.jpg')).toBe('/brand/products/scandalist-adder-terror.jpg');
  expect(catalogCover('Scandalist', 'scandalist_geneve', '/images/products/c62c243c5e45c780.jpg')).toBe('/images/products/c62c243c5e45c780.jpg');
  expect(existsSync('public/brand/products/scandalist-adder-terror.jpg')).toBe(true);
});
