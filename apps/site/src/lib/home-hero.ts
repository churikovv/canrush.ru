import type { CatalogGroup } from '@canrush/shared';
import { getPool } from '@/db/pool';
import { catalogGroupSlug, flavorName } from '@/lib/catalog-query';
import type { FeaturedReview, ReviewSummary } from '@/lib/reviews';

export interface HomeHeroDrink {
  key: string;
  href: string;
  brand: string;
  flavor: string;
  imageUrl: string;
  rating: number | null;
  reviewCount: number;
  /** Cheapest offer in the city and where it is. */
  minPrice: number | null;
  retailer: string | null;
  retailerCount: number;
}

export interface HomeHeroStats { drinks: number; retailers: number; reviews: number; tierLists: number }

export type HomeHeroSlide =
  | { kind: 'drink'; drink: HomeHeroDrink }
  | { kind: 'review'; drink: HomeHeroDrink; review: FeaturedReview };

export interface HomeHeroData {
  stats: HomeHeroStats;
  slides: HomeHeroSlide[];
  /** Retailers with the widest choice in the city, for the stores bento tile. */
  retailers: string[];
}

const DRINKS = 10;
const TOP_RETAILERS = 6;
/** A review card follows every few drinks, so the carousel shows what people say, not just cans. */
const REVIEW_EVERY = 3;

const key = (group: { brand: string; flavor: string }) => `${group.brand}\u0000${group.flavor}`;
const retailerName = (variant: CatalogGroup['variants'][number]) => variant.retailer ?? variant.source;

function drink(group: CatalogGroup & { coverImageUrl: string }, summaries: Map<string, ReviewSummary>): HomeHeroDrink {
  const summary = summaries.get(key(group));
  const cheapest = group.variants.reduce<CatalogGroup['variants'][number] | undefined>((best, variant) => !best || variant.price < best.price ? variant : best, undefined);
  return { key: key(group), href: `/catalog/${catalogGroupSlug(group.brand, group.flavor)}`, brand: group.brand, flavor: flavorName(group.flavor),
    imageUrl: group.coverImageUrl, rating: summary?.count ? summary.overall : null, reviewCount: summary?.count ?? 0,
    minPrice: cheapest?.price ?? null, retailer: cheapest ? retailerName(cheapest) : null, retailerCount: new Set(group.variants.map(retailerName)).size };
}

/**
 * Composes the home first screen from data the page already loads: catalog totals for the benefits list and
 * a carousel of drinks with photos (rating, cheapest price and retailer) mixed with quoted reviews.
 * `featured` goes first (drinks with a review worth quoting), then the rest of `ranked`.
 */
export function buildHomeHero({ groups, ranked, featured, summaries, reviews, counts }: {
  groups: CatalogGroup[];
  ranked: CatalogGroup[];
  featured: CatalogGroup[];
  summaries: Map<string, ReviewSummary>;
  reviews: Map<string, FeaturedReview>;
  counts: { reviews: number; tierLists: number };
}): HomeHeroData {
  const assortment = new Map<string, number>();
  for (const group of groups) for (const retailer of new Set(group.variants.map(retailerName))) assortment.set(retailer, (assortment.get(retailer) ?? 0) + 1);
  const withPhoto = [...new Set([...featured, ...ranked])]
    .filter((group): group is CatalogGroup & { coverImageUrl: string } => Boolean(group.coverImageUrl) && group.variants.length > 0)
    .slice(0, DRINKS)
    .map(group => drink(group, summaries));
  const quotes = withPhoto.flatMap(item => { const review = reviews.get(item.key); return review ? [{ drink: item, review }] : []; });
  const slides: HomeHeroSlide[] = [];
  withPhoto.forEach((item, index) => {
    slides.push({ kind: 'drink', drink: item });
    const quote = (index + 1) % REVIEW_EVERY === 0 ? quotes.shift() : undefined;
    if (quote) slides.push({ kind: 'review', ...quote });
  });
  const leftover = quotes[0];
  if (leftover && !slides.some(slide => slide.kind === 'review')) slides.push({ kind: 'review', ...leftover });
  const retailers = [...assortment].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ru')).slice(0, TOP_RETAILERS).map(([name]) => name);
  return { stats: { drinks: groups.length, retailers: assortment.size, ...counts }, slides, retailers };
}

/** Totals for the benefits list under the search form. */
export async function getHomeCounts(): Promise<{ reviews: number; tierLists: number }> {
  const { rows } = await getPool().query<{ reviews: number; tierLists: number }>(
    `select (select count(*) from "review")::int as reviews,
       (select count(*) from "tierList" where "status" = 'published')::int as "tierLists"`,
  );
  return rows[0] ?? { reviews: 0, tierLists: 0 };
}
