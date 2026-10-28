import type { ReactNode } from 'react';
import { DashboardFrame } from '@/components/dashboard-frame';
import Link from '@/components/navigation-progress';

export type DashboardLeaf = { label: string; href: string; current?: boolean; icon?: ReactNode; badge?: { count: number; label: string } };
export type DashboardNavItem = { label: string; icon: ReactNode; href?: string; current?: boolean; items?: DashboardLeaf[] };

const chevron = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>;

/**
 * The frame shared by the business cabinet and the admin panel — one dashboard instead of two: an app without the
 * site's header, a full-height sidebar (the CanRush mark with the app's label, an optional search, grouped sections
 * that fold, and a card at the bottom that opens a menu above itself), a top bar with the title, an optional subtitle,
 * icon tools and actions, an optional toolbar row and the section. On phones the sidebar is a drawer (`DashboardFrame`).
 */
export function DashboardShell({ label, home, search, nav, account, title, subtitle, tools, actions, toolbar, className, menuLabel, children }: {
  /** The pill beside the mark: «Бизнес», «Админ». */
  label: string; home: string;
  search?: { action: string; placeholder: string; label: string; hidden?: Record<string, string> };
  nav: DashboardNavItem[];
  /** The card at the bottom: what it shows and the menu it opens. */
  account: { name: string; caption: ReactNode; logo: ReactNode; label: string; menu: ReactNode };
  title: string; subtitle?: ReactNode; tools?: ReactNode; actions?: ReactNode; toolbar?: ReactNode;
  className?: string; menuLabel?: string; children: ReactNode;
}) {
  const leaf = (item: DashboardLeaf) => <Link key={item.href + item.label} href={item.href} aria-current={item.current ? 'page' : undefined}>
    {item.icon}{item.label}
    {item.badge && item.badge.count > 0 && <span className="bc-nav-badge" aria-label={item.badge.label}>{item.badge.count > 99 ? '99+' : item.badge.count}</span>}
  </Link>;
  // A folded group still shows what waits inside it: the total of its sections' badges (hidden while open).
  const groupBadge = (items: DashboardLeaf[]) => {
    const count = items.reduce((sum, item) => sum + (item.badge?.count ?? 0), 0);
    return count > 0 && <span className="bc-nav-badge bc-nav-group-badge" aria-label={`ждут: ${count}`}>{count > 99 ? '99+' : count}</span>;
  };
  const sidebar = <aside className="bc-sidebar" aria-label={menuLabel ?? 'Разделы'}>
    <Link className="bc-brand" href={home}><span className="bc-brand-mark" aria-hidden="true" /><strong>CanRush</strong><small>{label}</small></Link>
    {search && <form className="bc-search" action={search.action} role="search">
      {Object.entries(search.hidden ?? {}).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <input name="q" type="search" placeholder={search.placeholder} aria-label={search.label} maxLength={80} />
      <span className="bc-kbd" aria-hidden="true"><kbd>⌘</kbd><kbd>K</kbd></span>
    </form>}
    <nav className="bc-nav">{nav.map(item => item.items
      ? <details key={item.label} className="bc-nav-group" open>
        <summary>{item.icon}<span>{item.label}</span>{groupBadge(item.items)}<span className="bc-caret">{chevron}</span></summary>
        <div className="bc-nav-items">{item.items.map(leaf)}</div>
      </details>
      : <Link key={item.label} className="bc-nav-top" href={item.href!} aria-current={item.current ? 'page' : undefined}>{item.icon}<span>{item.label}</span></Link>)}
    </nav>
    <details className="bc-dropdown bc-workspace-menu">
      <summary className="bc-workspace" aria-label={account.label}>
        <span className="bc-workspace-logo" aria-hidden="true">{account.logo}</span>
        <span className="bc-workspace-text"><strong>{account.name}</strong><small>{account.caption}</small></span>
        <span className="bc-workspace-chevron">{chevron}</span>
      </summary>
      <div className="bc-dropdown-menu bc-workspace-items">{account.menu}</div>
    </details>
  </aside>;
  return <DashboardFrame sidebar={sidebar} className={className} menuLabel={menuLabel}>
    <header className="bc-topbar">
      <div className="bc-topbar-title"><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
      {(tools || actions) && <div className="bc-topbar-actions">
        {tools}
        {tools && actions && <span className="bc-topbar-divider" aria-hidden="true" />}
        {actions}
      </div>}
    </header>
    {toolbar && <div className="bc-toolbar">{toolbar}</div>}
    <div className="bc-content">{children}</div>
  </DashboardFrame>;
}
