'use server';
import { selectedCity } from '@/lib/location';
import { getRetailerPriceHistory } from '@/lib/price-history-files';
import type { StorePriceSeries } from '@/lib/price-history';
import { retailerAssets } from '@/components/retailer-badge';
import type { RetailerAsset } from '@/components/retailer-badge-view';

/** Store price history for the price chart; the city comes from the visitor's cookie, like the table. */
export async function retailerPriceHistoryAction(brand: unknown): Promise<{ stores: StorePriceSeries[]; badges: Record<string, RetailerAsset | null> }> {
  const name = typeof brand === 'string' ? brand.trim().slice(0, 100) : '';
  const stores = await getRetailerPriceHistory((await selectedCity()).id, name);
  // Stores seen only in older snapshots are missing from today's table, so their badges come along.
  return { stores, badges: await retailerAssets(stores.map(store => store.name)) };
}
