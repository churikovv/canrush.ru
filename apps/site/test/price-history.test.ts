import { expect,it } from 'vitest';
import type { CatalogGroup,FlavorVariant } from '@canrush/shared';
import { collectPriceHistory } from '../src/lib/price-history';
const offer=(price:number,volumeMl=500,extra:Partial<FlavorVariant>={}):FlavorVariant=>({source:'edadeal',retailer:'Магазин',price,volumeMl,url:'https://example.com',fetchedAt:'2026-10-13',...extra});
const group=(variants:FlavorVariant[]):CatalogGroup=>({brand:'Monster',flavor:'mango',variants,minPrice:1});
it('keeps volumes and days separate, selects minimum and sorts dates',()=>{
 const result=collectPriceHistory([{date:'2026-10-13',groups:[group([offer(100),offer(90),offer(60,250)])]},{date:'2026-10-12',groups:[group([offer(110)])]}],'Monster','mango');
 expect(result).toEqual([{volume:250,stores:[{name:'Магазин',points:[{date:'2026-10-13',price:60}]}]},{volume:500,stores:[{name:'Магазин',points:[{date:'2026-10-12',price:110},{date:'2026-10-13',price:90}]}]}]);
});
it('does not invent history from stale, expired or invalid prices or different products',()=>{
 expect(collectPriceHistory([{date:'2026-10-13',groups:[group([offer(1,500,{stale:true}),offer(2,500,{promoEndsAt:'2026-10-12T23:59:00Z'}),offer(NaN),offer(-1)]),{...group([offer(50)]),brand:'Burn'}]}],'Monster','mango')).toEqual([]);
});

it('keeps different retailers as separate series',()=>{
 const data=collectPriceHistory([{date:'2026-10-13',groups:[group([offer(100),offer(80,500,{retailer:'Другой магазин'})])]}],'Monster','mango');
 expect(data[0]?.stores).toHaveLength(2);
 expect(data[0]?.stores.find(s=>s.name==='Магазин')?.points[0]?.price).toBe(100);
 expect(data[0]?.stores.find(s=>s.name==='Другой магазин')?.points[0]?.price).toBe(80);
});

it('turns shelf snapshots into daily per-store medians per 100 ml, for one brand or all', async () => {
  const { collectRetailerPriceDays, retailerPriceSeries } = await import('../src/lib/price-history');
  const offer = (retailer: string, price: number, volumeMl = 500, extra = {}) => ({ source: 'edadeal' as const, retailer, price, volumeMl, url: 'https://edadeal.ru/moskva/search?text=x', fetchedAt: '2026-10-01', ...extra });
  const days = collectRetailerPriceDays([
    { date: '2026-10-01', groups: [
      { brand: 'Burn', flavor: 'original', minPrice: 100, variants: [offer('Магнит', 100), offer('Пятёрочка', 150)] },
      { brand: 'Tornado', flavor: 'original', minPrice: 50, variants: [offer('Магнит', 50, 500), offer('Магнит', 999, 500, { stale: true })] },
    ] },
    { date: '2026-10-02', groups: [{ brand: 'Burn', flavor: 'original', minPrice: 90, variants: [offer('Магнит', 90, 450)] }] },
  ]);
  expect(retailerPriceSeries(days, 'Burn')).toEqual([
    { name: 'Магнит', points: [{ date: '2026-10-01', price: 20 }, { date: '2026-10-02', price: 20 }] },
    { name: 'Пятёрочка', points: [{ date: '2026-10-01', price: 30 }] },
  ]);
  // All brands: Magnit had Burn 20 and Tornado 10 per 100 ml on the first day; the stale offer is ignored.
  expect(retailerPriceSeries(days).find(store => store.name === 'Магнит')?.points[0]).toEqual({ date: '2026-10-01', price: 15 });
  expect(retailerPriceSeries(days, 'Nope')).toEqual([]);
});
