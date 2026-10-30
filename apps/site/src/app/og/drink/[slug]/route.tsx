import { canonicalProductFlavor, reviewedProductIdentity } from '@canrush/shared';
import { loadAllCatalogGroups } from '@/lib/catalog';
import { catalogGroupSlug, decodeCatalogGroupSlug, flavorName } from '@/lib/catalog-query';
import { pluralRu } from '@/lib/drink-calendar-fields';
import { defaultOgCard, drinkOgCard, ogResponse } from '@/lib/og-image';
import { getReviewSummary } from '@/lib/reviews';

export const dynamic = 'force-dynamic';

/** The card by its address, without a city: a crawler has no cookie and a preview is the same for everybody. */
async function drinkBySlug(slug: string) {
  const groups = await loadAllCatalogGroups();
  const decoded = decodeCatalogGroupSlug(slug);
  if (!decoded) return groups.find(group => catalogGroupSlug(group.brand, group.flavor) === slug) ?? null;
  const { brand, flavor } = reviewedProductIdentity(decoded.brand, decoded.flavor);
  const canonical = canonicalProductFlavor(brand, flavor);
  return groups.find(group => group.brand === brand && group.flavor === canonical) ?? null;
}

/** A drink's link preview: can, brand, flavor and the members' rating. An unknown address gets the site's picture. */
export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const group = await drinkBySlug(slug);
  if (!group) return ogResponse('default', defaultOgCard);
  return ogResponse(`drink:${group.brand}\u0000${group.flavor}`, async () => {
    const summary = await getReviewSummary(group.brand, group.flavor);
    const reviews = `${summary.count} ${pluralRu(summary.count, 'отзыв', 'отзыва', 'отзывов')}`;
    return drinkOgCard({
      brand: group.brand,
      flavor: flavorName(group.flavor),
      cover: group.coverImageUrl,
      rating: summary.count ? { value: `${summary.overall.toFixed(1)}/10`, reviews } : null,
    });
  });
}
