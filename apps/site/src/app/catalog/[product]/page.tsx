import '@/styles/shared.css';
// Avatar frames of review authors (AvatarFrame) are styled there.
import '@/styles/profile.css';
import '@/styles/catalog.css';
import { getPriceHistory } from '@/lib/price-history-files';
import { selectedCity } from '@/lib/location';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound, permanentRedirect } from 'next/navigation';
import { logCatalogView } from '@/lib/catalog-events';
import { brandIngredients, getBrandProfile } from '@/lib/brand-drink-edits';
import { getBrandStores } from '@/lib/brand-drink-stores';
import { getBrandPrices } from '@/lib/brand-drink-prices';
import { BrandShell } from '@/components/brand-shell';
import { CatalogProductDetail } from '@/components/catalog-product-detail';
import { ProfileNavigation } from '@/components/profile-navigation';
import { getSwipeCounts } from '@/lib/drink-swipes';
import { catalogDrinkIngredients, getCatalogDrink, renamedCatalogDrink } from '@/lib/catalog-drinks';
import { getDrinkSummary } from '@/lib/review-digest';
import { getDrinkRadar } from '@/lib/score-profile';
import { getProductIngredients } from '@/lib/ingredients';
import { auth } from '@/lib/auth';
import { getCatalogGroup, isFavorite, loadAllCatalogGroups } from '@/lib/catalog';
import { catalogGroupSlug, catalogRetailerCount, decodeCatalogGroupSlug, flavorName } from '@/lib/catalog-query';
import { getReviewSummary, getReviewsForProduct, getUserReview } from '@/lib/reviews';
import { seoMetadata } from '@/lib/seo';
import { isExcludedEnergyBrand } from '@canrush/shared';

export const dynamic = 'force-dynamic';

type ProductParams = Promise<{ product: string }>;
type ProductSearchParams = Promise<{ tab?: string }>;

async function productFromParams(params: ProductParams) {
  const { product } = await params;
  const decoded = decodeCatalogGroupSlug(product);
  if (!decoded) {
    const group = (await loadAllCatalogGroups()).find(item => catalogGroupSlug(item.brand, item.flavor) === product);
    return group ? getCatalogGroup(group.brand, group.flavor) : null;
  }
  return getCatalogGroup(decoded.brand, decoded.flavor);
}

export async function generateMetadata({ params }: { params: ProductParams }): Promise<Metadata> {
  const group = await productFromParams(params);
  if (!group) return { title: 'Энергетик не найден', robots: { index: false, follow: false } };
  const flavor = flavorName(group.flavor);
  const retailerCount = catalogRetailerCount(group);
  return seoMetadata({
    title: `${group.brand}, ${flavor} — цены и отзывы`,
    description: `Сравните цены на энергетик ${group.brand}, вкус ${flavor}, в ${retailerCount} магазинах. Предложения, оценки и отзывы на CanRush.`,
    path: `/catalog/${catalogGroupSlug(group.brand, group.flavor)}`,
  });
}

export default async function CatalogProductPage({
  params,
  searchParams,
}: {
  params: ProductParams;
  searchParams: ProductSearchParams;
}) {
  const { tab } = await searchParams;
  const decoded = decodeCatalogGroupSlug((await params).product);
  if (decoded && catalogGroupSlug(decoded.brand, decoded.flavor) !== (await params).product) {
    permanentRedirect(`/catalog/${catalogGroupSlug(decoded.brand, decoded.flavor)}${tab === 'reviews' ? '?tab=reviews' : ''}`);
  }

  const [group, session] = await Promise.all([
    productFromParams(params),
    auth.api.getSession({ headers: await headers() }),
  ]);
  if (!group) {
    // A member drink an admin renamed: its old address leads to the new card.
    const renamed = await renamedCatalogDrink((await params).product);
    if (renamed) permanentRedirect(`/catalog/${catalogGroupSlug(renamed.brand, renamed.flavor)}${tab === 'reviews' ? '?tab=reviews' : ''}`);
    notFound();
  }
  // Not an energy drink (an excluded brand): gone from the catalog; its page stays only while reviews hang on it.
  if (isExcludedEnergyBrand(group.brand) && !(await getReviewSummary(group.brand, group.flavor)).count) notFound();
  await logCatalogView(group.brand, group.flavor);

  const [favorite, reviews, summary, userReview, fileIngredients, swipes, added, brand, brandStores, ceilings] = await Promise.all([
    session ? isFavorite(session.user.id, group.brand, group.flavor) : Promise.resolve(false),
    getReviewsForProduct(group.brand, group.flavor, session?.user.id ?? null),
    getReviewSummary(group.brand, group.flavor),
    session ? getUserReview(session.user.id, group.brand, group.flavor) : Promise.resolve(null),
    getProductIngredients(group.brand, group.flavor),
    getSwipeCounts(group.brand, group.flavor),
    getCatalogDrink(group.brand, group.flavor),
    getBrandProfile(group.brand, group.flavor).catch(() => null),
    getBrandStores(group.brand, group.flavor).catch(() => []),
    getBrandPrices(group.brand, group.flavor).catch(() => []),
  ]);
  // The brand's own composition (an approved edit) comes first; a member's drink has no file, its label text stands in.
  const ingredients = (brand && brandIngredients(brand, group.brand, group.flavor, fileIngredients?.volumeMl ?? added?.volumes[0])) ?? fileIngredients ?? (added ? catalogDrinkIngredients(added) : null);

  // One page now: the description and prices, with the reviews in a sheet over it (radar only when there are reviews).
  const [priceHistory, reviewDigest, radar] = await Promise.all([
    getPriceHistory((await selectedCity()).id, group.brand, group.flavor),
    getDrinkSummary(group.brand, group.flavor).catch(() => null),
    summary.count > 0 ? getDrinkRadar(group.brand, group.flavor).catch(() => null) : null,
  ]);

  return (
    <BrandShell headerAction={<ProfileNavigation active="catalog" />} surfaceClassName="catalog-detail-surface">
      <CatalogProductDetail
        group={group}
        priceHistory={priceHistory}
        ingredients={ingredients}
        favorite={favorite}
        authenticated={Boolean(session)}
        reviews={reviews}
        summary={summary}
        userReview={userReview}
        reviewsOpen={tab === 'reviews'}
        swipes={swipes}
        reviewDigest={reviewDigest}
        radar={radar}
        addedBy={added && group.variants.length === 0 ? added : undefined}
        fullName={brand?.fullName || added?.fullName || undefined}
        brand={brand ? { business: brand.business, description: brand.description } : null}
        brandStores={brandStores}
        ceilings={ceilings}
      />
    </BrandShell>
  );
}
