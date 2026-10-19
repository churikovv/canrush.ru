import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { Pinned } from '@/components/search-pinned';
import { StoreDirectory } from '@/components/store-directory';
import { listStores } from '@/lib/stores';
import { withCatalogLinks } from '@/lib/store-catalog';
import { selectedCity } from '@/lib/location';

export type StoreSearchParams = { q?: string; page?: string; mine?: string };

/**
 * Store search with the list/map switch and paging. /market/stores passes the member for «Мои магазины»;
 * /search passes its own path, the scope to keep and the scope switcher.
 */
export async function StoreBrowser({ params, ownerId, basePath = '/market/stores', keep = {}, scopes }: { params: StoreSearchParams; ownerId?: string; basePath?: string; keep?: Record<string, string>; scopes?: ReactNode }) {
  const city = await selectedCity();
  const mine = Boolean(ownerId);
  const q = typeof params.q === 'string' ? params.q.trim().slice(0, 100) : '';
  const page = Math.min(10000, Math.max(1, parseInt(params.page ?? '1', 10) || 1));
  const { items: rows, hasMore } = await listStores(city.id, q, page, ownerId);
  const items = await withCatalogLinks(rows.map(s => ({ id: s.id, photos: s.photos, ownerId: mine ? s.ownerId : '', name: s.name, city: s.city, address: s.address, latitude: s.latitude, longitude: s.longitude, locationSource: s.locationSource, metro: s.metro, description: s.description, catalog: s.catalog, status: s.status, moderationNote: mine ? s.moderationNote : '', updatedAt: s.updatedAt, reviewedAt: null })));
  const href = (n: number) => `${basePath}?${new URLSearchParams({ ...keep, q, page: String(n), ...(mine ? { mine: '1' } : {}) })}`;
  return <>
    <Pinned scopes={scopes}><form className="market-search-form" action={basePath}>
      {Object.entries(keep).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      <div className="catalog-search-field"><button className="market-search-submit" type="submit" aria-label="Найти магазины"><Image src="/brand/icons/catalog-search.svg" width={24} height={24} alt="" /></button><input name="q" type="search" aria-label="Поиск магазинов" maxLength={100} defaultValue={q} placeholder="Название, адрес или напиток" /></div>
      {mine && <input type="hidden" name="mine" value="1" />}
    </form></Pinned>
    {items.length ? <StoreDirectory key={`${city.id}:${q}:${page}:${mine}`} stores={items} center={[city.lat, city.lng]} own={mine} apiKey={process.env.YANDEX_MAPS_API_KEY ?? ''} />
      : <section className="market-empty"><h2>{q ? 'Магазины не найдены' : 'Здесь пока нет магазинов'}</h2><p>{mine ? 'Ваши заявки в выбранном городе появятся здесь.' : 'Добавьте знакомый магазин — после проверки он появится на карте.'}</p><div className="market-empty-actions"><Link className="community-button" href={`/market/stores/new?city=${city.id}`}>Добавить магазин</Link></div></section>}
    <nav className="market-pagination" aria-label="Страницы магазинов">{page > 1 && <Link href={href(page - 1)}>Назад</Link>}{hasMore && <Link href={href(page + 1)}>Следующая страница</Link>}</nav>
  </>;
}
