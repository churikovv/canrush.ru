import type { ReactNode } from 'react';
import { BusinessNotifications } from '@/components/business-shell-client';
import { DashboardShell } from '@/components/dashboard-shell';
import Link from '@/components/navigation-progress';
import { BUSINESS_KINDS, type BusinessKind, type BusinessStatus } from '@/lib/business-fields';
import { planInfo, type BusinessPlan } from '@/lib/business-plans';

export type BusinessSection = 'overview' | 'reviews' | 'insights' | 'search' | 'cards' | 'competitors' | 'brand' | 'drinks' | 'drink-edit' | 'drink-stores' | 'drink-price' | 'wholesale' | 'new-drink' | 'market' | 'new-listing' | 'orders' | 'settings' | 'plan';
export const businessHref = (section: BusinessSection, params: Record<string, string> = {}) =>
  `/business/cabinet?${new URLSearchParams({ ...(section !== 'overview' ? { section } : {}), ...params })}`.replace(/\?$/, '');

const ICONS = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z" />,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  can: <path d="M8 2h8l-1 4H9L8 2Zm1 4h6l1 3v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V9l1-3Zm-1 7h8" />,
  bag: <path d="M3 9h18l-1.5 11h-15L3 9Zm5 0V7a4 4 0 0 1 8 0v2" />,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>,
  site: <path d="M10 14 21 3m0 0h-6m6 0v6M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" />,
  help: <><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3v4ZM3 19a2 2 0 0 0 2 2h1v-6H3v4Z" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  chevron: <path d="m6 9 6 6 6-6" />,
  chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z" />,
  truck: <><path d="M2 6h12v10H2zM14 9h4l4 4v3h-8" /><circle cx="6.5" cy="17.5" r="1.8" /><circle cx="17.5" cy="17.5" r="1.8" /></>,
};
export type BusinessIconName = keyof typeof ICONS;
export function BusinessIcon({ name, size = 20 }: { name: BusinessIconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[name]}</svg>;
}

const NAV: { label: string; icon: BusinessIconName; section?: BusinessSection; items?: { label: string; section: BusinessSection }[] }[] = [
  { label: 'Обзор', icon: 'home', section: 'overview' },
  { label: 'Аналитика', icon: 'chart', items: [{ label: 'Отзывы', section: 'reviews' }, { label: 'Разбор нейросетью', section: 'insights' }, { label: 'Поиск', section: 'search' }, { label: 'Карточки', section: 'cards' }, { label: 'Конкуренты', section: 'competitors' }, { label: 'Бренд', section: 'brand' }] },
  { label: 'Каталог', icon: 'can', items: [{ label: 'Напитки', section: 'drinks' }, { label: 'Новый напиток', section: 'new-drink' }] },
  { label: 'Продажи', icon: 'bag', items: [{ label: 'Объявления', section: 'market' }, { label: 'Новое объявление', section: 'new-listing' }, { label: 'Заказы и чаты', section: 'orders' }] },
  { label: 'Закупки', icon: 'truck', items: [{ label: 'Оптовые цены', section: 'wholesale' }] },
];

/**
 * The cabinet on the shared dashboard frame (`DashboardShell`): ⌘K search over reviews, grouped sections, and the
 * company card with its kind and plan at the bottom, which opens settings, the plan, the site and help — its status is
 * in the page's banner. The top bar carries the chats and the bell before the section's actions.
 */
export function BusinessShell({ business, active, title, actions, toolbar, unread, unreadMessages, badges = {}, children }: {
  business: { name: string; kind: BusinessKind; status: BusinessStatus; logoId: string | null; plan?: BusinessPlan; planUntil?: Date | null };
  active: BusinessSection; title: string; actions?: ReactNode; toolbar?: ReactNode; unread: number; unreadMessages: number;
  /** Counters beside sections, like reviews waiting for an answer. */
  badges?: Partial<Record<BusinessSection, { count: number; label: string }>>; children: ReactNode;
}) {
  return <DashboardShell label="Бизнес" home={businessHref('overview')} menuLabel="Меню кабинета" title={title} actions={actions} toolbar={toolbar}
    search={{ action: '/business/cabinet', placeholder: 'Поиск…', label: 'Поиск по отзывам', hidden: { section: 'reviews' } }}
    nav={NAV.map(item => ({
      label: item.label, icon: <BusinessIcon name={item.icon} />,
      ...(item.section ? { href: businessHref(item.section), current: item.section === active } : {}),
      items: item.items?.map(leaf => ({ label: leaf.label, href: businessHref(leaf.section), current: leaf.section === active, badge: badges[leaf.section] })),
    }))}
    account={{
      name: business.name, label: `${business.name}: настройки и помощь`,
      caption: <>{BUSINESS_KINDS.find(item => item.value === business.kind)?.label} · {planInfo(business).title}</>,
      // eslint-disable-next-line @next/next/no-img-element -- the logo is served from the database
      logo: business.logoId ? <img src={`/api/business-logos/${business.logoId}`} alt="" width={40} height={40} /> : business.name.slice(0, 2).toUpperCase(),
      menu: <>
        <Link href={businessHref('settings')} aria-current={active === 'settings' ? 'page' : undefined}><BusinessIcon name="settings" size={18} />Настройки</Link>
        <Link href={businessHref('plan')} aria-current={active === 'plan' ? 'page' : undefined}><BusinessIcon name="chart" size={18} />Тариф и продвижение</Link>
        <Link href="/"><BusinessIcon name="site" size={18} />Сайт CanRush</Link>
        <a href="mailto:hello@canrush.ru"><BusinessIcon name="help" size={18} />Помощь и поддержка</a>
      </>,
    }}
    tools={<>
      <Link className="bc-icon-button" href={businessHref('orders')} aria-label={unreadMessages ? `Заказы и чаты: ${unreadMessages} новых сообщений` : 'Заказы и чаты'} title="Заказы и чаты">
        <BusinessIcon name="chat" />{unreadMessages > 0 && <span className="bc-dot" aria-hidden="true" />}
      </Link>
      <BusinessNotifications unread={unread} />
    </>}>
    {children}
  </DashboardShell>;
}

/** Segmented tabs of the toolbar, like «Employee list / Directory / ORG Chart». */
export function BusinessSegments({ items, label }: { items: { href: string; label: string; current: boolean; count?: number }[]; label: string }) {
  return <nav className="bc-segments" aria-label={label}>{items.map(item => <Link key={item.href + item.label} href={item.href} aria-current={item.current ? 'page' : undefined}>
    {item.label}{item.count !== undefined && <small>{item.count}</small>}
  </Link>)}</nav>;
}

/** A toolbar dropdown (Filter, Sort): a `details` with links; the frame closes it on a click outside. */
export function BusinessDropdown({ icon, label, items }: { icon: ReactNode; label: string; items: { href: string; label: string; current: boolean }[] }) {
  return <details className="bc-dropdown">
    <summary className="bc-tool-button">{icon}<span>{label}</span></summary>
    <div className="bc-dropdown-menu">{items.map(item => <Link key={item.href} href={item.href} aria-current={item.current ? 'true' : undefined}>{item.label}</Link>)}</div>
  </details>;
}

/** Table footer: page size, numbered pages with ellipses, and «1–20 из 194». */
export function BusinessPagination({ page, size, total, href, sizes = [10, 20, 50] }: { page: number; size: number; total: number; href: (page: number, size: number) => string; sizes?: number[] }) {
  const pages = Math.max(1, Math.ceil(total / size));
  const shown = [...new Set([1, 2, 3, page - 1, page, page + 1, pages].filter(item => item >= 1 && item <= pages))].sort((a, b) => a - b);
  const from = total ? (page - 1) * size + 1 : 0, to = Math.min(total, page * size);
  return <div className="bc-pagination">
    <details className="bc-dropdown is-up">
      <summary className="bc-tool-button">{size} записей <BusinessIcon name="chevron" size={16} /></summary>
      <div className="bc-dropdown-menu">{sizes.map(item => <Link key={item} href={href(1, item)} aria-current={item === size ? 'true' : undefined}>{item} записей</Link>)}</div>
    </details>
    <nav className="bc-pages" aria-label="Страницы">
      {page > 1 ? <Link className="bc-page" href={href(page - 1, size)} aria-label="Предыдущая">‹</Link> : <span className="bc-page is-disabled" aria-hidden="true">‹</span>}
      {shown.map((item, index) => <span key={item} className="bc-page-group">
        {index > 0 && item - shown[index - 1]! > 1 && <span className="bc-page is-gap">…</span>}
        <Link className="bc-page" href={href(item, size)} aria-current={item === page ? 'page' : undefined}>{item}</Link>
      </span>)}
      {page < pages ? <Link className="bc-page" href={href(page + 1, size)} aria-label="Следующая">›</Link> : <span className="bc-page is-disabled" aria-hidden="true">›</span>}
    </nav>
    <span className="bc-range"><b>{from}–{to}</b> из {total}</span>
  </div>;
}

export type SortDir = 'asc' | 'desc';

/**
 * A sortable column header: a click sorts by this column, a second click flips the direction. Phones show tables as
 * cards without a header, so they keep the section's default order.
 */
export function SortHeader({ label, column, by, dir, href }: { label: string; column: string; by?: string; dir: SortDir; href: (by: string, dir: SortDir) => string }) {
  const active = by === column;
  const next: SortDir = active && dir === 'desc' ? 'asc' : 'desc';
  return <Link className="bc-th-sort" href={href(column, next)} data-active={active || undefined} aria-label={`${label}: сортировать ${next === 'desc' ? 'по убыванию' : 'по возрастанию'}`}>
    {label}<svg width="10" height="14" viewBox="0 0 10 14" aria-hidden="true"><path d="M5 1 1 5h8L5 1Z" fill={active && dir === 'asc' ? 'currentColor' : 'none'} stroke="currentColor" /><path d="m5 13-4-4h8l-4 4Z" fill={active && dir === 'desc' ? 'currentColor' : 'none'} stroke="currentColor" /></svg>
  </Link>;
}
