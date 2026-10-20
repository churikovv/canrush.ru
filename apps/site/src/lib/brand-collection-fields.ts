import { canonicalProductFlavor, isAssortmentFlavor, reviewedProductIdentity } from '@canrush/shared';
import { catalogGroupSlug, flavorName } from '@/lib/catalog-query';

/** Catalog drink the collection can contain (the same set the calendar and stores link to). */
export interface CollectionOption { brand: string; flavor: string; cover?: string }
/** How the member proved they tried a drink: a review or a can in the calendar. */
export type TriedSource = 'review' | 'calendar';
export interface TriedDrink { brand: string; flavor: string; source: TriedSource }
export interface CollectionItem { brand: string; flavor: string; name: string; href: string; cover?: string; tried: TriedSource[] }
export interface BrandCollection {
  brand: string; slug: string; items: CollectionItem[]; tried: number; total: number;
  /** Shares (25/50/75/100) already paid from the XP ledger; kept when the catalog grows, so hints skip them. */
  paid?: number[];
}
export interface CollectionSummary { brands: BrandCollection[]; tried: number; total: number; started: number; completed: number }

/** A brand with one drink is not a collection. */
export const MIN_COLLECTION_SIZE = 2;
/** Product lines kept as their own catalog brand but collected together with the parent brand. */
export const COLLECTION_BRAND_LINES: Readonly<Record<string, { brand: string; line: string }>> = {
  'Adrenaline Game Fuel': { brand: 'Adrenaline Rush', line: 'Game Fuel' },
};

const key = (brand: string, flavor: string) => JSON.stringify([brand, flavor]);

/** Reviews may keep an older identity of a product; collections count it as the current one. */
export function canonicalDrink(brand: string, flavor: string): { brand: string; flavor: string } {
  const identity = reviewedProductIdentity(brand, flavor);
  return { brand: identity.brand, flavor: canonicalProductFlavor(identity.brand, identity.flavor) };
}

export function brandSlug(brand: string): string {
  return encodeURIComponent(brand.toLocaleLowerCase('ru-RU').replace(/\s+/gu, '-'));
}

export function completion(collection: { tried: number; total: number }): number {
  return collection.total ? collection.tried / collection.total : 0;
}

/**
 * Groups catalog drinks by brand and marks the ones the member tried. Tried drinks outside the
 * catalog (removed editions) are ignored: the collection only shows what can still be found.
 * Started brands come first, closest to completion on top; the rest stay alphabetical.
 */
export function buildBrandCollections(options: readonly CollectionOption[], tried: readonly TriedDrink[]): CollectionSummary {
  const sources = new Map<string, Set<TriedSource>>();
  for (const drink of tried) {
    const { brand, flavor } = canonicalDrink(drink.brand, drink.flavor);
    const set = sources.get(key(brand, flavor)) ?? new Set<TriedSource>();
    set.add(drink.source);
    sources.set(key(brand, flavor), set);
  }
  const byBrand = new Map<string, Map<string, CollectionItem>>();
  for (const option of options) {
    if (isAssortmentFlavor(option.flavor)) continue;
    const line = COLLECTION_BRAND_LINES[option.brand];
    const brand = line?.brand ?? option.brand;
    const items = byBrand.get(brand) ?? new Map<string, CollectionItem>();
    if (items.has(key(option.brand, option.flavor))) continue;
    const found = sources.get(key(option.brand, option.flavor));
    items.set(key(option.brand, option.flavor), {
      brand: option.brand, flavor: option.flavor, name: line ? `${line.line} · ${flavorName(option.flavor)}` : flavorName(option.flavor),
      href: `/catalog/${catalogGroupSlug(option.brand, option.flavor)}`,
      ...(option.cover ? { cover: option.cover } : {}), tried: found ? (['review', 'calendar'] as const).filter(source => found.has(source)) : [],
    });
    byBrand.set(brand, items);
  }
  const brands = [...byBrand.entries()].filter(([, items]) => items.size >= MIN_COLLECTION_SIZE).map(([brand, map]) => {
    // Tried drinks first, so a collapsed card previews what the member already has.
    const items = [...map.values()].sort((a, b) => Number(b.tried.length > 0) - Number(a.tried.length > 0) || a.name.localeCompare(b.name, 'ru'));
    return { brand, slug: brandSlug(brand), items, tried: items.filter(item => item.tried.length).length, total: items.length };
  }).sort((a, b) => Number(b.tried > 0) - Number(a.tried > 0) || completion(b) - completion(a) || b.tried - a.tried || a.brand.localeCompare(b.brand, 'ru'));
  return {
    brands,
    tried: brands.reduce((sum, item) => sum + item.tried, 0),
    total: brands.reduce((sum, item) => sum + item.total, 0),
    started: brands.filter(item => item.tried > 0).length,
    completed: brands.filter(item => item.tried === item.total).length,
  };
}

export function flavors(count: number): string {
  const mod10 = count % 10, mod100 = count % 100;
  const word = mod10 === 1 && mod100 !== 11 ? 'вкус' : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'вкуса' : 'вкусов';
  return `${count} ${word}`;
}

/** Share of a brand to collect and the XP it pays; every milestone pays once per brand. */
export const COLLECTION_MILESTONES = [[25, 15], [50, 25], [75, 40], [100, 75]] as const;
export interface CollectionMilestone { percent: number; points: number; needed: number }
export interface CollectionAward { key: string; points: number }

/**
 * Milestones of one brand with the number of drinks each needs. Small brands reach several
 * shares with the same drink: only the highest of them counts, so one can never pays twice.
 */
export function brandMilestones(total: number): CollectionMilestone[] {
  const steps = COLLECTION_MILESTONES.map(([percent, points]) => ({ percent, points, needed: Math.max(1, Math.ceil(total * percent / 100)) }));
  return steps.filter((step, index) => steps[index + 1]?.needed !== step.needed);
}

/** Ledger rows for every reached milestone. Keys hold the share, not the count, so catalog growth never re-pays. */
export function collectionAwards(summary: CollectionSummary): CollectionAward[] {
  return summary.brands.flatMap(collection => brandMilestones(collection.total)
    .filter(step => collection.tried >= step.needed)
    .map(step => ({ key: `${collection.brand}:${step.percent}`, points: step.points })));
}

/** The next milestone that would still pay: a share paid before the catalog grew (say 100% of 3 flavors, now 3 of 4) is skipped. */
export function nextMilestone(collection: { tried: number; total: number; paid?: readonly number[] }): CollectionMilestone | undefined {
  return brandMilestones(collection.total).find(step => collection.tried < step.needed && !collection.paid?.includes(step.percent));
}

/** XP a brand has paid so far: the ledger's shares when known, otherwise every milestone already reached. */
export function earnedCollectionXp(collection: { tried: number; total: number; paid?: readonly number[] }): number {
  if (collection.paid) return COLLECTION_MILESTONES.filter(([percent]) => collection.paid!.includes(percent)).reduce((sum, [, points]) => sum + points, 0);
  return brandMilestones(collection.total).filter(step => collection.tried >= step.needed).reduce((sum, step) => sum + step.points, 0);
}

/** Shares paid per brand from ledger keys `<brand>:<percent>` (a brand name may itself contain a colon). */
export function paidShares(keys: readonly string[]): Map<string, number[]> {
  const paid = new Map<string, number[]>();
  for (const key of keys) {
    const at = key.lastIndexOf(':');
    const percent = Number(key.slice(at + 1));
    if (at < 1 || !COLLECTION_MILESTONES.some(([value]) => value === percent)) continue;
    const brand = key.slice(0, at);
    paid.set(brand, [...(paid.get(brand) ?? []), percent]);
  }
  return paid;
}
