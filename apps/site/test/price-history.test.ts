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
