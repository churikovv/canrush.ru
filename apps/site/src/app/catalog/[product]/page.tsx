import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { BrandShell } from '@/components/brand-shell';
import { CatalogProductDetail } from '@/components/catalog-product-detail';
import type { ProductTab } from '@/components/catalog-product-tabs';
import { ProfileNavigation } from '@/components/profile-navigation';
import { getProductIngredients } from '@/lib/ingredients';
import { auth } from '@/lib/auth';
import { getCatalogGroup, isFavorite } from '@/lib/catalog';
import { catalogRetailerCount, decodeCatalogGroupSlug, flavorName } from '@/lib/catalog-query';
import { getReviewSummary, getReviewsForProduct, getUserReview } from '@/lib/reviews';
import { seoMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

type ProductParams = Promise<{ product: string }>;
type ProductSearchParams = Promise<{ tab?: string }>;

async function productFromParams(params: ProductParams) {
  const { product } = await params;
  const decoded = decodeCatalogGroupSlug(product);
  if (!decoded) return null;
  return getCatalogGroup(decoded.brand, decoded.flavor);
}

function resolveTab(value: string | undefined): ProductTab {
  return value === 'reviews' ? 'reviews' : 'prices';
}

export async function generateMetadata({ params }: { params: ProductParams }): Promise<Metadata> {
  const [{ product }, group] = await Promise.all([params, productFromParams(params)]);
  if (!group) return { title: 'Энергетик не найден', robots: { index: false, follow: false } };
  const flavor = flavorName(group.flavor);
  const retailerCount = catalogRetailerCount(group);
  return seoMetadata({
    title: `${group.brand}, ${flavor} — цены и отзывы`,
    description: `Сравните цены на энергетик ${group.brand}, вкус ${flavor}, в ${retailerCount} магазинах. Предложения, оценки и отзывы на CanRush.`,
    path: `/catalog/${product}`,
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
  const activeTab = resolveTab(tab);

  const [group, session] = await Promise.all([
    productFromParams(params),
    auth.api.getSession({ headers: await headers() }),
  ]);
  if (!group) notFound();

  const [favorite, reviews, summary, userReview, ingredients] = await Promise.all([
    session ? isFavorite(session.user.id, group.brand, group.flavor) : Promise.resolve(false),
    getReviewsForProduct(group.brand, group.flavor, session?.user.id ?? null),
    getReviewSummary(group.brand, group.flavor),
    session ? getUserReview(session.user.id, group.brand, group.flavor) : Promise.resolve(null),
    getProductIngredients(group.brand, group.flavor),
  ]);

  return (
    <BrandShell headerAction={<ProfileNavigation active="catalog" />} surfaceClassName="catalog-detail-surface">
      <CatalogProductDetail
        group={group}
        ingredients={ingredients}
        favorite={favorite}
        authenticated={Boolean(session)}
        reviews={reviews}
        summary={summary}
        userReview={userReview}
        activeTab={activeTab}
      />
    </BrandShell>
  );
}
