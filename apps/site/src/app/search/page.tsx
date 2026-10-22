import '@/styles/shared.css';
import '@/styles/catalog.css';
import '@/styles/market.css';
import '@/styles/search.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from '@/components/navigation-progress';
import { BrandShell } from '@/components/brand-shell';
import { CatalogBrowser } from '@/components/catalog-browser';
import { MarketBrowser } from '@/components/market-browser';
import { NavigationIcon } from '@/components/navigation-icon';
import { ProfileNavigation } from '@/components/profile-navigation';
import { StoreBrowser } from '@/components/store-browser';
import { auth } from '@/lib/auth';
import { seoMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { ...seoMetadata({ title: 'Поиск', description: 'Поиск энергетиков, магазинов и объявлений CanRush.', path: '/search' }), robots: { index: false } };

const SCOPES = [
  { key: 'catalog', label: 'Каталог', icon: 'can' },
  { key: 'stores', label: 'Магазины', icon: 'stores' },
  { key: 'market', label: 'Маркет', icon: 'market' },
] as const;
type Scope = typeof SCOPES[number]['key'];

/** The tab bar's «Поиск»: the full catalog, stores (list or map) and market listings behind one pinned switcher. */
export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const scope: Scope = SCOPES.find(item => item.key === params.type)?.key ?? 'catalog';
  const text = (name: string) => typeof params[name] === 'string' ? params[name] : undefined;
  const query = text('q')?.trim() ?? '';
  // Switching scope keeps only the search text: filters belong to one section.
  const scopeHref = (key: Scope) => `/search?${new URLSearchParams({ ...(key === 'catalog' ? {} : { type: key }), ...(query ? { q: query } : {}) })}`;
  const keep: Record<string, string> = scope === 'catalog' ? {} : { type: scope };
  const scopes = <nav className="search-scopes" aria-label="Где искать">
    {SCOPES.map(item => <Link key={item.key} href={scopeHref(item.key)} aria-current={item.key === scope ? 'page' : undefined} replace scroll={false}><NavigationIcon section={item.icon} />{item.label}</Link>)}
  </nav>;
  const browser = scope === 'catalog' ? <CatalogBrowser params={params} basePath="/search" scopes={scopes} />
    : scope === 'stores' ? <StoreBrowser params={{ q: text('q'), page: text('page'), brand: text('brand'), metro: text('metro') }} basePath="/search" keep={keep} scopes={scopes} />
    : <MarketBrowser query={{ q: text('q'), page: text('page'), brand: text('brand'), city: text('city'), delivery: text('delivery') }} viewerId={(await auth.api.getSession({ headers: await headers() }))?.user.id ?? null} basePath="/search" keep={keep} scopes={scopes} />;
  return <BrandShell headerAction={<ProfileNavigation active="search" />} surfaceClassName="catalog-surface">
    <div className="search-layout" data-scope={scope}>
      {/* The catalog has its own heading for screen readers. */}
      {scope !== 'catalog' && <h1 className="sr-only">Поиск</h1>}
      {browser}
    </div>
  </BrandShell>;
}
