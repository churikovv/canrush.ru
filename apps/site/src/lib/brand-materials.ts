import type { CatalogGroup } from '@canrush/shared';
import { getPool } from '@/db/pool';
import { listBrandDrinks, listBusinessDrinks } from './business';
import type { BadgeTheme, MaterialTarget } from './brand-materials-fields';
import { loadAllCatalogGroups } from './catalog';
import { catalogGroupSlug, flavorName } from './catalog-query';
import { isCountedCatalogDrink } from './home-metrics';
import { ratingBadgeSvg } from './rating-badge';
import { getReviewSummary } from './reviews';

/** The catalog's spelling of a brand, whatever case the address uses; null for a brand the catalog doesn't have. */
export async function catalogBrand(name: string): Promise<string | null> {
  const wanted = name.trim().toLowerCase();
  if (!wanted) return null;
  return (await loadAllCatalogGroups()).find(group => isCountedCatalogDrink(group) && group.brand.toLowerCase() === wanted)?.brand ?? null;
}

export const drinkTarget = (group: Pick<CatalogGroup, 'brand' | 'flavor'>): MaterialTarget =>
  ({ kind: 'drink', brand: group.brand, flavor: group.flavor, slug: catalogGroupSlug(group.brand, group.flavor), name: `${group.brand} · ${flavorName(group.flavor)}` });
export const brandTarget = (brand: string): MaterialTarget => ({ kind: 'brand', brand, name: brand });

/** The members' average (taste and design together, out of 10) and the number of reviews, as the drink page counts them. */
export async function targetRating(target: MaterialTarget): Promise<{ reviews: number; score: number }> {
  if (target.kind === 'drink') {
    const summary = await getReviewSummary(target.brand, target.flavor);
    return { reviews: summary.count, score: summary.overall };
  }
  const { rows } = await getPool().query<{ reviews: number; score: number | null }>(
    `select count(*)::int as reviews, avg((taste + design) / 2.0)::float8 as score from review where lower(brand) = lower($1)`, [target.brand]);
  return { reviews: rows[0]?.reviews ?? 0, score: rows[0]?.score ?? 0 };
}

/**
 * What a company can print and embed: each brand of its approved drinks as a whole, then the brand's catalog drinks,
 * the most reviewed first (as «Бренд» in the cabinet lists them).
 */
export async function companyTargets(businessId: string): Promise<MaterialTarget[]> {
  const brands = [...new Set((await listBusinessDrinks(businessId)).filter(drink => drink.status === 'approved').map(drink => drink.brand))];
  if (!brands.length) return [];
  const drinks = await listBrandDrinks(businessId, brands);
  return brands.flatMap(brand => [brandTarget(brand), ...drinks.filter(drink => drink.brand === brand).map(drinkTarget)]);
}

/** Up to three can covers for the poster: the drink's own, or the brand's most reviewed drinks. */
export async function targetCovers(target: MaterialTarget, businessId: string): Promise<string[]> {
  if (target.kind === 'drink') {
    const group = (await loadAllCatalogGroups()).find(item => item.brand === target.brand && item.flavor === target.flavor);
    return group?.coverImageUrl ? [group.coverImageUrl] : [];
  }
  return (await listBrandDrinks(businessId, [target.brand])).flatMap(drink => drink.cover ? [drink.cover] : []).slice(0, 3);
}

const BADGE_CACHE = new Map<string, { svg: string; at: number }>();
const BADGE_TTL_MS = 10 * 60 * 1000;
const BADGE_CACHE_SIZE = 500;

/**
 * The badge picture for another site: `image/svg+xml`, cached for an hour by the browser and ten minutes in this process
 * (a brand's page shows it to every visitor), `Cross-Origin-Resource-Policy: cross-origin` so other sites may show it.
 * An unknown drink or brand answers 404.
 */
export async function badgeResponse(target: MaterialTarget | null, theme: BadgeTheme): Promise<Response> {
  if (!target) return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  const key = `${target.kind}\u0000${target.brand}\u0000${target.kind === 'drink' ? target.flavor : ''}\u0000${theme}`;
  let entry = BADGE_CACHE.get(key);
  if (!entry || Date.now() - entry.at > BADGE_TTL_MS) {
    const rating = await targetRating(target);
    entry = { svg: ratingBadgeSvg({ name: target.name, ...rating, theme }), at: Date.now() };
    BADGE_CACHE.delete(key);
    BADGE_CACHE.set(key, entry);
    if (BADGE_CACHE.size > BADGE_CACHE_SIZE) BADGE_CACHE.delete(BADGE_CACHE.keys().next().value!);
  }
  return new Response(entry.svg, { headers: {
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    'Cross-Origin-Resource-Policy': 'cross-origin',
  } });
}
