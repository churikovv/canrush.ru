import { catalogRetailerName } from './catalog-query';
import { canonicalProductFlavor, type CatalogGroup } from '@canrush/shared';
export interface PricePoint { date: string; price: number }
export interface StorePriceSeries { name: string; points: PricePoint[] }
export interface PriceSeries { volume: number | null; stores: StorePriceSeries[] }
export function collectPriceHistory(snapshots: {date:string;groups:CatalogGroup[]}[],brand:string,flavor:string): PriceSeries[] {
 const series=new Map<number|null,Map<string,Map<string,number>>>();
 for(const snapshot of snapshots)for(const group of snapshot.groups){
  if(group.brand!==brand||canonicalProductFlavor(brand,group.flavor)!==canonicalProductFlavor(brand,flavor))continue;
  for(const offer of group.variants){
   if(offer.stale||!Number.isFinite(offer.price)||offer.price<=0|| (offer.promoEndsAt&&offer.promoEndsAt.slice(0,10)<snapshot.date))continue;
   const volume=offer.volumeMl??null;
   const stores=series.get(volume)??new Map<string,Map<string,number>>();
   const name=catalogRetailerName(offer);const days=stores.get(name)??new Map<string,number>();
   days.set(snapshot.date,Math.min(days.get(snapshot.date)??Infinity,offer.price));stores.set(name,days);series.set(volume,stores);
  }
 }
 return [...series].sort(([a],[b])=>(a??Infinity)-(b??Infinity)).map(([volume,stores])=>({volume,stores:[...stores].sort(([a],[b])=>a.localeCompare(b,'ru')).map(([name,days])=>({name,points:[...days].sort(([a],[b])=>a.localeCompare(b)).map(([date,price])=>({date,price}))}))}));
}
