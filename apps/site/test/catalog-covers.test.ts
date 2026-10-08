import { expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { catalogCover } from '../src/lib/catalog-covers';
import { mergeCatalogAliases } from '../src/lib/catalog-files';
it('pins reviewed original covers across changing parser snapshots without changing offers',()=>{
 for(const brand of ['Adrenaline Rush','Drive Me']) {
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
