import type { ReactNode } from 'react';
import Link from '@/components/navigation-progress';
import { Pinned } from '@/components/search-pinned';
import { StoreDirectory } from '@/components/store-directory';
import { StoreFilters } from '@/components/store-filters';
import { getStoreFilterOptions, listStores } from '@/lib/stores';
import { METRO, NEAREST_METRO_KM, stationDistanceKm } from '@/lib/store-fields';
import { withCatalogLinks } from '@/lib/store-catalog';
import { selectedCity } from '@/lib/location';

export type StoreSearchParams = { q?: string; page?: string; mine?: string; brand?: string; metro?: string };

/**
 * Store search with the list/map switch and paging. /market/stores passes the member for «Мои магазины»;
 * /search passes its own path, the scope to keep and the scope switcher.
 */
export async function StoreBrowser({ params, ownerId, basePath = '/market/stores', keep = {}, scopes }: { params: StoreSearchParams; ownerId?: string; basePath?: string; keep?: Record<string, string>; scopes?: ReactNode }) {
  const city = await selectedCity();
  const mine = Boolean(ownerId);
  const q = typeof params.q === 'string' ? params.q.trim().slice(0, 100) : '';
  const page = Math.min(10000, Math.max(1, parseInt(params.page ?? '1', 10) || 1));
  const brand = typeof params.brand === 'string' ? params.brand.trim().slice(0, 100) : '';
  // Metro is filtered by station name (a transfer station has one id per line): a store matches by its chosen station
  // or by being within walking distance, as the store card lists nearby stations. Cities without metro get no field.
  const stations = METRO[city.id] ?? [];
  const metro = typeof params.metro === 'string' && stations.some(station => station.name === params.metro) ? params.metro : '';
  const [{ items: rows, hasMore }, options] = await Promise.all([
    listStores(city.id, q, page, ownerId, false, { brand, metro: metro ? (named => ({ ids: named.map(station => station.id), lat: named.map(station => station.lat), lng: named.map(station => station.lng), km: NEAREST_METRO_KM }))(stations.filter(station => station.name === metro)) : undefined }),
    getStoreFilterOptions(city.id),
  ]);
  const stationNames = [...new Set(stations.filter(station => options.metro.includes(station.id) || options.points.some(point => stationDistanceKm(point.lat, point.lng, station) <= NEAREST_METRO_KM)).map(station => station.name))].sort((a, b) => a.localeCompare(b, 'ru'));
  const filtered = Boolean(q || brand || metro);
  const items = await withCatalogLinks(rows.map(s => ({ id: s.id, photos: s.photos, ownerId: mine ? s.ownerId : '', name: s.name, city: s.city, address: s.address, latitude: s.latitude, longitude: s.longitude, locationSource: s.locationSource, metro: s.metro, description: s.description, catalog: s.catalog, status: s.status, moderationNote: mine ? s.moderationNote : '', updatedAt: s.updatedAt, reviewedAt: null })));
  const scope = { ...keep, ...(mine ? { mine: '1' } : {}) };
  const href = (n: number) => `${basePath}?${new URLSearchParams({ ...scope, q, ...(brand ? { brand } : {}), ...(metro ? { metro } : {}), page: String(n) })}`;
  return <>
    <Pinned scopes={scopes}><StoreFilters key={JSON.stringify([q, brand, metro, scope])} brands={options.brands} stations={stationNames} initial={{ q, brand, metro }} scope={scope} basePath={basePath} addHref={basePath === '/market/stores' ? undefined : `/market/stores/new?city=${city.id}`} /></Pinned>
    {items.length ? <StoreDirectory key={`${city.id}:${q}:${brand}:${metro}:${page}:${mine}`} stores={items} center={[city.lat, city.lng]} own={mine} apiKey={process.env.YANDEX_MAPS_API_KEY ?? ''} />
      : <section className="market-empty"><h2>{filtered ? 'Магазины не найдены' : 'Здесь пока нет магазинов'}</h2><p>{mine ? 'Ваши заявки в выбранном городе появятся здесь.' : 'Добавьте знакомый магазин — после проверки он появится на карте.'}</p><div className="market-empty-actions">{filtered && <Link className="community-button community-button-secondary" href={`${basePath}?${new URLSearchParams(scope)}`}>Сбросить фильтры</Link>}<Link className="community-button" href={`/market/stores/new?city=${city.id}`}>Добавить магазин</Link></div></section>}
    <nav className="market-pagination" aria-label="Страницы магазинов">{page > 1 && <Link href={href(page - 1)}>Назад</Link>}{hasMore && <Link href={href(page + 1)}>Следующая страница</Link>}</nav>
  </>;
}
