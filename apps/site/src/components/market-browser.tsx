import { logSearch } from '@/lib/search-log';
import { MarketCompanyLogo } from '@/components/market-company-logo';
import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { MarketFilters } from '@/components/market-filters';
import { Pinned } from '@/components/search-pinned';
import { getListings, getMarketFilterOptions } from '@/lib/market';
import { DELIVERY, formatPrice } from '@/lib/market-fields';

export type MarketSearchParams = { q?: string; page?: string; mine?: string; archive?: string; seller?: string; brand?: string; city?: string; delivery?: string };

/**
 * Listings with search, filters and paging. /market adds its heading and tabs; /search passes its own path,
 * the scope to keep and the scope switcher.
 */
export async function MarketBrowser({ query, viewerId, basePath = '/market', keep = {}, scopes }: { query: MarketSearchParams; viewerId: string | null; basePath?: string; keep?: Record<string, string>; scopes?: ReactNode }) {
  const page = Math.min(10000, Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1));
  const seller = typeof query.seller === 'string' ? query.seller.trim().slice(0, 64) : '';
  const mine = !seller && query.mine === '1' && Boolean(viewerId);
  const filters = { q: typeof query.q === 'string' ? query.q.trim().slice(0,200) : '', brand: typeof query.brand === 'string' ? query.brand.trim().slice(0,100) : '', city: typeof query.city === 'string' ? query.city.trim().slice(0,100) : '', delivery: typeof query.delivery === 'string' && Object.hasOwn(DELIVERY,query.delivery) ? query.delivery : '' };
  const [{ items, hasMore }, filterOptions] = await Promise.all([getListings(page, mine ? viewerId ?? undefined : undefined, false, seller || undefined, filters), getMarketFilterOptions()]);
  const scope: Record<string,string> = { ...keep, ...(seller ? {seller} : mine ? {mine:'1'} : {}) };
  const suffix = Object.keys(scope).length ? `&${new URLSearchParams(scope)}` : '';
  const filterSuffix = '&' + new URLSearchParams(filters).toString();
  const filtered = Boolean(filters.q || filters.brand || filters.city || filters.delivery);
  if (filters.q && page === 1 && !mine && !seller) await logSearch(filters.q, 'market', items.length, items.map(listing => listing.brand).filter((brand): brand is string => Boolean(brand)));
  return <>
    <Pinned scopes={scopes}><MarketFilters key={JSON.stringify([filters,scope])} brands={filterOptions.brands} cities={filterOptions.cities} initial={filters} scope={scope} basePath={basePath} addHref={basePath === '/market' ? undefined : '/market/new'}/></Pinned>
    {items.length ? <div className="market-grid">{items.map(listing => <article className="market-card" key={listing.id}>
      {/* The list shows what tells listings apart; stock, delivery and ordering are on the listing page. */}
      <Link href={`/market/${listing.id}`} className="market-card-link">
        {listing.photos[0] && <div className="market-card-image"><Image src={`/api/market-photos/${listing.photos[0]}`} alt={listing.title} width={480} height={480} unoptimized />{listing.photos.length > 1 && <span>{listing.photos.length} фото</span>}</div>}
        <div className="market-card-copy"><strong className="market-card-price">{formatPrice(listing.price)}<small> / шт.</small></strong><h2>{listing.title}</h2>{listing.businessName && <p className="market-card-company"><MarketCompanyLogo name={listing.businessName} logoId={listing.businessLogoId} size={20} />{listing.businessName}<span className="sr-only">, компания</span></p>}<p className="market-city">{listing.city}</p>{listing.description && <p className="market-card-description">{listing.description}</p>}</div>
      </Link>
    </article>)}</div> : <section className="market-empty"><h2>{filtered ? 'Ничего не найдено' : mine ? 'Ваши объявления появятся здесь' : 'Пока нет объявлений'}</h2><p>{filtered ? 'Измените поисковый запрос, бренд, город или способ доставки.' : 'Предложите свою коллекцию или редкий вкус другим участникам.'}</p><div className="market-empty-actions">{filtered && <Link className="community-button community-button-secondary" href="/market">Сбросить фильтры</Link>}<Link className="community-button" href="/market/new">Создать объявление</Link></div></section>}
    <nav className="market-pagination" aria-label="Страницы объявлений">{page > 1 && <Link href={`${basePath}?page=${page - 1}${suffix}${filterSuffix}`}>Назад</Link>}{hasMore && <Link href={`${basePath}?page=${page + 1}${suffix}${filterSuffix}`}>Следующая страница</Link>}</nav>
    <p className="market-note">CanRush не принимает оплату и не оформляет доставку. Обсуждайте условия с продавцом и проверяйте товар перед покупкой.</p>
  </>;
}
