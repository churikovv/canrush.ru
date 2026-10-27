import { isExcludedEnergyBrand, isAssortmentFlavor } from '@canrush/shared';
import type { ReactNode } from 'react';
import Link from '@/components/navigation-progress';
import { Pinned } from '@/components/search-pinned';
import { CatalogControls } from '@/components/catalog-controls';
import { CatalogGrid } from '@/components/catalog-grid';
import { CatalogProductCard } from '@/components/catalog-product-card';
import { loadAllCatalogGroups, loadCatalogSnapshot } from '@/lib/catalog';
import { catalogDrinkGroups, countPendingCatalogDrinks } from '@/lib/catalog-drinks';
import {
  filterCatalogGroups,
  flavorName,
  isCatalogSort,
  type CatalogFilters,
} from '@/lib/catalog-query';
import { getReviewSummaries, getDiscussionCounts } from '@/lib/reviews';
import { logSearch } from '@/lib/search-log';

const PAGE_SIZE = 24;
const AUTO_LOAD_ROUNDS = 3;
const AUTO_LOAD_LIMIT = PAGE_SIZE * (AUTO_LOAD_ROUNDS + 1);

export type CatalogSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : (value?.[0] ?? '');
}

function catalogLimit(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return PAGE_SIZE;
  return Math.max(PAGE_SIZE, Math.floor(parsed / PAGE_SIZE) * PAGE_SIZE);
}

function loadMoreHref(filters: CatalogFilters, limit: number, basePath: string, keep: Record<string, string>): string {
  const params = new URLSearchParams(keep);
  if (filters.query) params.set('q', filters.query);
  if (filters.brand) params.set('brand', filters.brand);
  if (filters.flavor) params.set('flavor', filters.flavor);
  if (filters.sort !== 'stores') params.set('sort', filters.sort);
  params.set('limit', String(limit));
  return `${basePath}?${params.toString()}`;
}

/**
 * The whole catalog: controls, results with load-more and the archive while searching.
 * Rendered by /catalog and by /search, which passes its own path, the scope to keep and the scope switcher.
 */
export async function CatalogBrowser({ params, basePath = '/catalog', keep = {}, scopes }: { params: CatalogSearchParams; basePath?: string; keep?: Record<string, string>; scopes?: ReactNode }) {
  const snapshot = await loadCatalogSnapshot();
  const { groups, city } = snapshot;
  const searching = Boolean(first(params.q).trim());
  const currentKeys = new Set(groups.map(group => JSON.stringify([group.brand, group.flavor])));
  // Drinks members added stay listed after the shop offers until shops have them; the archive waits for a search.
  // The badge on «На модерации»; the catalog still renders if the database is slow or down.
  const pendingCount = await countPendingCatalogDrinks().catch(() => 0);
  const added = (await catalogDrinkGroups().catch(() => [])).filter(group => !currentKeys.has(JSON.stringify([group.brand, group.flavor])));
  const addedKeys = new Set(added.map(group => JSON.stringify([group.brand, group.flavor])));
  const allGroups = searching ? await loadAllCatalogGroups() : [...groups, ...added];
  const archived = allGroups.filter(group => !currentKeys.has(JSON.stringify([group.brand, group.flavor])) && !addedKeys.has(JSON.stringify([group.brand, group.flavor])) && !isExcludedEnergyBrand(group.brand) && !/^(?:unknown|unresolved)(?::|$)/.test(group.flavor) && !(group.brand === 'Volt Energy' && group.flavor === 'mango') && !isAssortmentFlavor(group.flavor)).map(group => ({ ...group, variants: [], minPrice: 0 }));
  const brands = [...new Set(allGroups.map((group) => group.brand))].sort((a, b) => a.localeCompare(b, 'ru-RU'));
  const flavorValues = [...new Set(allGroups.map((group) => group.flavor))];
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
  const ratingSummaries = filters.sort === 'rating' ? await getReviewSummaries(allGroups) : undefined;
  const discussions = filters.sort === 'comments' ? await getDiscussionCounts() : undefined;
  const filtered = filterCatalogGroups(groups, filters, ratingSummaries, discussions);
  const addedFiltered = filterCatalogGroups(added, filters, ratingSummaries, discussions);
  const archivedFiltered = searching ? filterCatalogGroups(archived, filters, ratingSummaries, discussions) : [];
  const totalCount = filtered.length + addedFiltered.length + archivedFiltered.length;
  // A search, not «Показать ещё» on it: the brands of every result count as shown (business «Поиск»).
  if (searching && !first(params.limit)) await logSearch(filters.query, 'catalog', totalCount, [...filtered, ...addedFiltered, ...archivedFiltered].map(group => group.brand));
  const visible = filtered.slice(0, limit);
  const visibleAdded = addedFiltered.slice(0, Math.max(0, limit - filtered.length));
  const visibleArchive = archivedFiltered.slice(0, Math.max(0, limit - filtered.length - addedFiltered.length));
  const nextHref = limit < totalCount ? loadMoreHref(filters, limit + PAGE_SIZE, basePath, keep) : undefined;
  const reviewSummaries = ratingSummaries ?? await getReviewSummaries(
    [...visible, ...visibleAdded, ...visibleArchive].map((group) => ({ brand: group.brand, flavor: group.flavor })),
  );

  return (
    <div className="catalog-layout">
      <h1 className="sr-only">Каталог энергетических напитков · {city.name}</h1>
      <p className="catalog-city-caption">{city.name}{snapshot.status === 'stale' ? ' · Последние доступные цены' : ' · Предложения магазинов'}</p>
      <Pinned scopes={scopes}><CatalogControls
        brands={brands}
        flavors={flavors}
        query={filters.query}
        brand={filters.brand}
        flavor={filters.flavor}
        sort={filters.sort}
        basePath={basePath}
        keep={keep}
        addHref="/catalog/new"
        pending={{ href: '/catalog/pending', count: pendingCount }}
      /></Pinned>

      <p className="sr-only" aria-live="polite">
        Найдено товаров: {totalCount}
      </p>

      {totalCount > 0 ? (
        <CatalogGrid
          nextHref={nextHref}
          autoLoad={limit < AUTO_LOAD_LIMIT}
          visibleCount={visible.length + visibleAdded.length + visibleArchive.length}
          totalCount={totalCount}
        >
          {visible.map((group, index) => (
            <CatalogProductCard
              key={`${group.brand}:${group.flavor}`}
              group={group}
              eager={index < 8}
              summary={reviewSummaries.get(`${group.brand}\u0000${group.flavor}`)}
            />
          ))}
          {visibleAdded.length > 0 && <div className="catalog-archive-heading"><h2>Добавлены участниками</h2><p>Проверены модераторами. Цены появятся, когда напиток найдут в магазинах.</p></div>}
          {visibleAdded.map(group => <CatalogProductCard key={`added:${group.brand}:${group.flavor}`} group={group} eager={false} summary={reviewSummaries.get(`${group.brand}\u0000${group.flavor}`)} />)}
          {visibleArchive.length > 0 && <div className="catalog-archive-heading"><h2>Архивные напитки</h2><p>Сейчас нет предложений в выбранном городе.</p></div>}
          {visibleArchive.map(group => <CatalogProductCard key={`archive:${group.brand}:${group.flavor}`} group={group} eager={false} summary={reviewSummaries.get(`${group.brand}\u0000${group.flavor}`)} />)}
        </CatalogGrid>
      ) : (
        <div id="catalog-results" className="catalog-empty">
          <h2>{groups.length === 0 ? `Нет предложений: ${city.name}` : 'Ничего не найдено'}</h2>
          <p>
            {groups.length === 0
              ? 'Для этого города пока нет актуальных предложений. Можно выбрать другой город в хедере.'
              : 'Измените запрос или сбросьте фильтры.'}
          </p>
          {groups.length > 0 ? <Link href={Object.keys(keep).length ? `${basePath}?${new URLSearchParams(keep)}` : basePath}>Сбросить фильтры</Link> : null}
        </div>
      )}
    </div>
  );
}
