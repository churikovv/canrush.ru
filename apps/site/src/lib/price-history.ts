import { catalogRetailerName } from './catalog-query';
import { canonicalProductFlavor, type CatalogGroup } from '@canrush/shared';
import { preparePriceObservations } from './price-statistics';
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

/** One day of shelf prices: retailer → brand → prices per 100 ml (multipacks, stale and expired offers left out). */
export interface RetailerPriceDay { date: string; stores: Record<string, Record<string, number[]>> }

export function collectRetailerPriceDays(snapshots: { date: string; groups: CatalogGroup[] }[]): RetailerPriceDay[] {
  return snapshots.map(({ date, groups }) => {
    const stores: Record<string, Record<string, number[]>> = {};
    for (const row of preparePriceObservations(groups, `${date}T00:00:00Z`).observations) {
      ((stores[row.retailer] ??= {})[row.brand] ??= []).push(row.price * 100 / row.volumeMl);
    }
    return { date, stores };
  });
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
};

/** Daily median price per 100 ml in each store, for one brand or all of them — the series the price chart plots. */
export function retailerPriceSeries(days: RetailerPriceDay[], brand = ''): StorePriceSeries[] {
  const stores = new Map<string, PricePoint[]>();
  for (const day of days) for (const [retailer, brands] of Object.entries(day.stores)) {
    const values = brand ? brands[brand] ?? [] : Object.values(brands).flat();
    if (!values.length) continue;
    const points = stores.get(retailer) ?? [];
    points.push({ date: day.date, price: Math.round(median(values) * 100) / 100 });
    stores.set(retailer, points);
  }
  return [...stores].sort(([a], [b]) => a.localeCompare(b, 'ru')).map(([name, points]) => ({ name, points }));
}
