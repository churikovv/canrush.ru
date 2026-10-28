import { WHOLESALE_SOURCE_NAMES, type CatalogGroup, type WholesaleFile, type WholesaleOffer } from '@canrush/shared';
import { readCatalogFile } from '@/lib/catalog-files';
import { catalogGroupSlug, flavorName } from '@/lib/catalog-query';

/** One line of «Оптовые цены»: the supplier's offer, the catalog card it is, and the cheapest shop price to compare. */
export interface WholesaleRow extends WholesaleOffer {
  title: string;
  slug: string | null;
  cover: string | null;
  /** Cheapest shop price of the same drink and volume across cities, roubles; null when shops do not have it. */
  retail: number | null;
  /** How much a shop price is above the wholesale one, percent. */
  markup: number | null;
  /** Read from the title; shop prices are compared only for cans — a PET bottle of the same drink is another product. */
  packaging: 'can' | 'pet' | 'glass';
  /** Offers of the same drink, volume and packaging from other sources, and whether this one is the cheapest of them. */
  others: number;
  cheapest: boolean;
}

export const packagingOf = (name: string): WholesaleRow['packaging'] =>
  /(?:^|[\s,.(])(?:пэт|pet|бут(?:ылка)?)(?=[\s,.)]|$)/iu.test(name) ? 'pet' : /(?:^|[\s,.(])(?:стекло|с\/б|ст\/б)(?=[\s,.)]|$)/iu.test(name) ? 'glass' : 'can';

/** The parser's wholesale snapshot (`data/wholesale.json`), re-read when the parser replaces it. */
export async function readWholesale(): Promise<WholesaleFile | null> {
  return (await readCatalogFile('wholesale.json')) as unknown as WholesaleFile | null;
}

/** A shop offer of the same can: volumes within a few millilitres (449 and 450 are one can). */
const sameCan = (a: number | undefined, b: number | undefined) => a !== undefined && b !== undefined && Math.abs(a - b) <= 10;

export function wholesaleRows(offers: WholesaleOffer[], groups: CatalogGroup[]): WholesaleRow[] {
  const byIdentity = new Map(groups.map(group => [JSON.stringify([group.brand, group.flavor]), group]));
  const rows = offers.map(offer => {
    const group = offer.brand && offer.flavor ? byIdentity.get(JSON.stringify([offer.brand, offer.flavor])) : undefined;
    const packaging = packagingOf(offer.name);
    const shop = packaging !== 'can' ? [] : group?.variants.filter(variant => variant.price > 0 && sameCan(variant.volumeMl, offer.volumeMl)).map(variant => variant.price) ?? [];
    const retail = shop.length ? Math.min(...shop) : null;
    return {
      ...offer,
      title: group ? `${group.brand} · ${flavorName(group.flavor)}` : offer.name.replace(/^(?:напиток|энергетический напиток)\s+(?:энергетический|тонизирующий|витаминизированный)?\s*/iu, ''),
      slug: group ? catalogGroupSlug(group.brand, group.flavor) : null,
      cover: group?.coverImageUrl ?? null,
      retail,
      markup: retail !== null ? Math.round((retail / offer.price - 1) * 100) : null,
      packaging,
      others: 0,
      cheapest: false,
    };
  });
  // The same can at several sources: count the others and mark the cheapest, so the table shows where to buy.
  const same = new Map<string, WholesaleRow[]>();
  // Out of stock offers show the range but are not «where to buy» — they take no part in the comparison.
  for (const row of rows) if (row.brand && row.flavor && row.volumeMl && row.inStock !== false) {
    const key = JSON.stringify([row.brand, row.flavor, Math.round(row.volumeMl / 10), row.packaging]);
    same.set(key, [...(same.get(key) ?? []), row]);
  }
  for (const group of same.values()) {
    const sources = new Set(group.map(row => row.source));
    if (sources.size < 2) continue;
    const low = Math.min(...group.map(row => row.price));
    for (const row of group) { row.others = group.filter(other => other.source !== row.source).length; row.cheapest = row.price === low; }
  }
  return rows;
}

export const wholesaleSourceName = (source: WholesaleOffer['source']) => WHOLESALE_SOURCE_NAMES[source];
