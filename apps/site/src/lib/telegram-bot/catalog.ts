import { isResolvedFlavor, type CatalogGroup, type CityId } from '@canrush/shared';
import { activeOffers, readAllCatalogGroups, readCityCatalog } from '@/lib/catalog-files';
import { catalogOffers, catalogRetailerName, matchesCatalogQuery } from '@/lib/catalog-query';
import { getReviewSummaries } from '@/lib/reviews';

export interface BotProduct {
  brand: string;
  flavor: string;
  coverImageUrl?: string;
  /** Cheapest current offer in the member's city, if the drink is on sale there. */
  cheapest?: { price: number; retailer: string; volumeMl?: number };
  rating?: { overall: number; count: number };
}

export interface BotPromo {
  brand: string;
  flavor: string;
  retailer: string;
  volumeMl?: number;
  price: number;
  oldPrice?: number;
  promoEndsAt: string;
}

const key = (brand: string, flavor: string) => `${brand}\u0000${flavor}`;

async function cityGroups(cityId: CityId, now = Date.now()): Promise<CatalogGroup[]> {
  const data = await readCityCatalog(cityId);
  return activeOffers(data?.groups ?? [], now).filter(group => isResolvedFlavor(group.flavor));
}

/** Drinks matching a free-text query: local offers first, then the rest of the catalog without prices. */
export async function searchProducts(cityId: CityId, query: string, limit: number): Promise<BotProduct[]> {
  const local = (await cityGroups(cityId)).filter(group => matchesCatalogQuery(group, query));
  const seen = new Set(local.map(group => key(group.brand, group.flavor)));
  const archive = local.length >= limit ? [] : (await readAllCatalogGroups())
    .filter(group => isResolvedFlavor(group.flavor) && !seen.has(key(group.brand, group.flavor)) && matchesCatalogQuery(group, query));
  const groups = [...local, ...archive].slice(0, 40);
  const ratings = await getReviewSummaries(groups.map(({ brand, flavor }) => ({ brand, flavor })));
  return groups
    .map((group): BotProduct => {
      const offer = catalogOffers(group)[0];
      const rating = ratings.get(key(group.brand, group.flavor));
      return {
        brand: group.brand,
        flavor: group.flavor,
        coverImageUrl: group.coverImageUrl,
        ...(offer ? { cheapest: { price: offer.price, retailer: catalogRetailerName(offer), volumeMl: offer.volumeMl } } : {}),
        ...(rating && rating.count > 0 ? { rating: { overall: rating.overall, count: rating.count } } : {}),
      };
    })
    .sort((a, b) => Number(Boolean(b.cheapest)) - Number(Boolean(a.cheapest)) || (b.rating?.count ?? 0) - (a.rating?.count ?? 0))
    .slice(0, limit);
}

/** Active promotional offers in a city, cheapest per drink, retailer and volume. */
export async function cityPromos(cityId: CityId, now = Date.now()): Promise<BotPromo[]> {
  const promos: BotPromo[] = [];
  for (const group of await cityGroups(cityId, now)) {
    for (const offer of catalogOffers({ ...group, variants: group.variants.filter(variant => variant.promoEndsAt) })) {
      if (!offer.promoEndsAt) continue;
      promos.push({
        brand: group.brand,
        flavor: group.flavor,
        retailer: catalogRetailerName(offer),
        ...(offer.volumeMl ? { volumeMl: offer.volumeMl } : {}),
        price: offer.price,
        ...(offer.oldPrice && offer.oldPrice > offer.price ? { oldPrice: offer.oldPrice } : {}),
        promoEndsAt: offer.promoEndsAt,
      });
    }
  }
  return promos;
}

export function promoKey(promo: BotPromo): string {
  return JSON.stringify([promo.brand, promo.flavor, promo.retailer, promo.volumeMl ?? null, promo.promoEndsAt.slice(0, 10)]);
}

/** Best deals of the week: biggest discount first, then the lowest price; one line per drink. */
export function bestPromos(promos: BotPromo[], limit: number): BotPromo[] {
  const discount = (promo: BotPromo) => (promo.oldPrice ? 1 - promo.price / promo.oldPrice : 0);
  const byDrink = new Map<string, BotPromo>();
  for (const promo of [...promos].sort((a, b) => discount(b) - discount(a) || a.price - b.price)) {
    const drink = key(promo.brand, promo.flavor);
    if (!byDrink.has(drink)) byDrink.set(drink, promo);
  }
  return [...byDrink.values()].slice(0, limit);
}
