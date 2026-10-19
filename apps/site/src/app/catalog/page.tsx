import '@/styles/shared.css';
import '@/styles/catalog.css';
import type { Metadata } from 'next';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { CatalogBrowser, type CatalogSearchParams } from '@/components/catalog-browser';
import { seoMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = seoMetadata({
  title: 'Каталог энергетиков',
  description: 'Сравнивайте актуальные цены на энергетические напитки в магазинах России, выбирайте бренды и вкусы, читайте отзывы покупателей.',
  path: '/catalog',
});

export default async function CatalogPage({ searchParams }: { searchParams: Promise<CatalogSearchParams> }) {
  return (
    <BrandShell headerAction={<ProfileNavigation active="catalog" />} surfaceClassName="catalog-surface">
      <CatalogBrowser params={await searchParams} />
    </BrandShell>
  );
}
