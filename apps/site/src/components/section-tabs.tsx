import Link from '@/components/navigation-progress';

interface SectionTab { key: string; href: string; label: string; private?: boolean }

function SectionTabs({ tabs, active, signedIn, label }: { tabs: readonly SectionTab[]; active?: string; signedIn: boolean; label: string }) {
  return <nav className="market-filters" aria-label={label}>
    {tabs.filter(tab => signedIn || !tab.private).map(tab => <Link key={tab.key} href={tab.href} aria-current={tab.key === active ? 'page' : undefined}>{tab.label}</Link>)}
  </nav>;
}

const MARKET_TABS = [
  { key: 'all', href: '/market', label: 'Все объявления' },
  { key: 'mine', href: '/market?mine=1', label: 'Мои объявления', private: true },
  { key: 'orders', href: '/messages', label: 'Заказы', private: true },
] as const;

const STORE_TABS = [
  { key: 'prices', href: '/prices', label: 'Цены' },
  { key: 'stores', href: '/market/stores', label: 'Магазины' },
  { key: 'mine', href: '/market/stores?mine=1', label: 'Мои магазины', private: true },
] as const;

export function MarketTabs({ active, signedIn }: { active?: typeof MARKET_TABS[number]['key']; signedIn: boolean }) {
  return <SectionTabs tabs={MARKET_TABS} active={active} signedIn={signedIn} label="Маркет" />;
}

export function StoreTabs({ active, signedIn }: { active: typeof STORE_TABS[number]['key']; signedIn: boolean }) {
  return <SectionTabs tabs={STORE_TABS} active={active} signedIn={signedIn} label="Магазины" />;
}

const FEED_TABS = [
  { key: 'all', label: 'Все записи' },
  { key: 'following', label: 'Подписки', private: true },
] as const;

/** `basePath`/`keep` point the tabs at /community when the feed is shown there. */
export function FeedTabs({ active, signedIn, basePath = '/feed', keep = {} }: { active: typeof FEED_TABS[number]['key']; signedIn: boolean; basePath?: string; keep?: Record<string, string> }) {
  const href = (scope?: string) => { const search = new URLSearchParams({ ...keep, ...(scope ? { scope } : {}) }).toString(); return search ? `${basePath}?${search}` : basePath; };
  return <SectionTabs tabs={FEED_TABS.map(tab => ({ ...tab, href: href(tab.key === 'all' ? undefined : tab.key) }))} active={active} signedIn={signedIn} label="Лента" />;
}
