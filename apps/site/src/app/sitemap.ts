import type { MetadataRoute } from 'next';
import type { CatalogGroup } from '@canrush/shared';
import { loadCatalogGroups } from '@/lib/catalog';
import { catalogGroupSlug } from '@/lib/catalog-query';
import { SITE_URL } from '@/lib/seo';
import { getPublishedTierListSitemapEntries } from '@/lib/tier-lists';

export const dynamic = 'force-dynamic';

function productUpdatedAt(group: CatalogGroup): Date | undefined {
  const timestamps = group.variants
    .map((variant) => Date.parse(variant.fetchedAt))
    .filter(Number.isFinite);
  if (timestamps.length === 0) return undefined;
  return new Date(Math.max(...timestamps));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [groups, tierLists] = await Promise.all([
    loadCatalogGroups(),
    getPublishedTierListSitemapEntries().catch(() => []),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/prices`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${SITE_URL}/catalog`, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/tierlists`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/terms`, changeFrequency: 'yearly', priority: 0.2 },
  ];
  const products: MetadataRoute.Sitemap = groups.map((group) => ({
    url: `${SITE_URL}/catalog/${catalogGroupSlug(group.brand, group.flavor)}`,
    lastModified: productUpdatedAt(group),
    changeFrequency: 'daily',
    priority: 0.7,
  }));
  const publicTierLists: MetadataRoute.Sitemap = tierLists.map((list) => ({
    url: `${SITE_URL}/tierlists/${list.slug}`,
    lastModified: list.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.5,
  }));

  return [...staticPages, ...products, ...publicTierLists];
}
