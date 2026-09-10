import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandShell } from '@/components/brand-shell';
import { CatalogControls } from '@/components/catalog-controls';
import { CatalogGrid } from '@/components/catalog-grid';
import { CatalogProductCard } from '@/components/catalog-product-card';
import { ProfileNavigation } from '@/components/profile-navigation';
import { loadCatalogGroups } from '@/lib/catalog';
import {
  filterCatalogGroups,
  flavorName,
  isCatalogSort,
  type CatalogFilters,
} from '@/lib/catalog-query';
import { getReviewSummaries } from '@/lib/reviews';
import { seoMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = seoMetadata({
  title: 'Каталог энергетиков',
  description: 'Сравнивайте актуальные цены на энергетические напитки в магазинах России, выбирайте бренды и вкусы, читайте отзывы покупателей.',
  path: '/catalog',
});

const PAGE_SIZE = 24;
const AUTO_LOAD_ROUNDS = 3;
const AUTO_LOAD_LIMIT = PAGE_SIZE * (AUTO_LOAD_ROUNDS + 1);

type CatalogSearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : (value?.[0] ?? '');
}

function catalogLimit(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return PAGE_SIZE;
  return Math.max(PAGE_SIZE, Math.floor(parsed / PAGE_SIZE) * PAGE_SIZE);
}

function loadMoreHref(filters: CatalogFilters, limit: number): string {
  const params = new URLSearchParams();
  if (filters.query) params.set('q', filters.query);
  if (filters.brand) params.set('brand', filters.brand);
  if (filters.flavor) params.set('flavor', filters.flavor);
  if (filters.sort !== 'stores') params.set('sort', filters.sort);
  params.set('limit', String(limit));
  return `/catalog?${params.toString()}`;
}

export default async function CatalogPage({ searchParams }: { searchParams: CatalogSearchParams }) {
  const [groups, params] = await Promise.all([loadCatalogGroups(), searchParams]);
  const brands = [...new Set(groups.map((group) => group.brand))].sort((a, b) => a.localeCompare(b, 'ru-RU'));
  const flavorValues = [...new Set(groups.map((group) => group.flavor))];
  const flavors = flavorValues
    .map((value) => ({ value, label: flavorName(value) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ru-RU'));
  const requestedSort = first(params.sort);
  const filters: CatalogFilters = {
    query: first(params.q).slice(0, 80),
    brand: brands.includes(first(params.brand)) ? first(params.brand) : '',
    flavor: flavorValues.includes(first(params.flavor)) ? first(params.flavor) : '',
    sort: isCatalogSort(requestedSort) ? requestedSort : 'stores',
  };
  const limit = catalogLimit(first(params.limit));
  const filtered = filterCatalogGroups(groups, filters);
  const visible = filtered.slice(0, limit);
  const nextHref = visible.length < filtered.length ? loadMoreHref(filters, limit + PAGE_SIZE) : undefined;
  const reviewSummaries = await getReviewSummaries(
    visible.map((group) => ({ brand: group.brand, flavor: group.flavor })),
  );

  return (
    <BrandShell headerAction={<ProfileNavigation active="catalog" />} surfaceClassName="catalog-surface">
      <div className="catalog-layout">
        <h1 className="sr-only">Каталог энергетических напитков</h1>
        <CatalogControls
          brands={brands}
          flavors={flavors}
          query={filters.query}
          brand={filters.brand}
          flavor={filters.flavor}
          sort={filters.sort}
        />

        <p className="sr-only" aria-live="polite">
          Найдено товаров: {filtered.length}
        </p>

        {visible.length > 0 ? (
          <CatalogGrid
            nextHref={nextHref}
            autoLoad={limit < AUTO_LOAD_LIMIT}
            visibleCount={visible.length}
            totalCount={filtered.length}
          >
            {visible.map((group, index) => (
              <CatalogProductCard
                key={`${group.brand}:${group.flavor}`}
                group={group}
                eager={index < 8}
                summary={reviewSummaries.get(`${group.brand}\u0000${group.flavor}`)}
              />
            ))}
          </CatalogGrid>
        ) : (
          <div id="catalog-results" className="catalog-empty">
            <h2>{groups.length === 0 ? 'Каталог обновляется' : 'Ничего не найдено'}</h2>
            <p>
              {groups.length === 0
                ? 'Данные появятся после следующего запуска парсера.'
                : 'Измените запрос или сбросьте фильтры.'}
            </p>
            {groups.length > 0 ? <Link href="/catalog">Сбросить фильтры</Link> : null}
          </div>
        )}
      </div>
    </BrandShell>
  );
}
