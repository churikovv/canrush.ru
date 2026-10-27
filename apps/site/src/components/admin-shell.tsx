import type { ReactNode } from 'react';
import Link from '@/components/navigation-progress';
import { AdminSidebarGroup } from '@/components/admin-sidebar-group';
import { adminHref, type AdminTab } from '@/lib/admin-tabs';
import { SITE_ROLE_LABELS, type SiteRole } from '@/lib/admin-roles';

export type AdminSection = AdminTab | 'stores' | 'drinks' | 'contest' | 'articles' | 'business';
/** Sections a moderator does not see: administrators, contests and campaigns. */
export const ADMIN_ONLY_SECTIONS: ReadonlySet<AdminSection> = new Set(['campaigns', 'contest', 'admins']);

/** Sections plus the icons of the analytics cards that lead to public pages (reviews, tier lists, wall posts). */
export type AdminIconName = AdminSection | 'reviews' | 'tierlists' | 'wall' | 'comments';
const ICONS: Record<AdminIconName, ReactNode> = {
  analytics: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  contest: <path d="M20 12v9H4v-9M2 7h20v5H2zM12 22V7m0 0H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7Zm0 0h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7Z" />,
  campaigns: <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Zm13-3a5 5 0 0 1 0 8m3-11a9 9 0 0 1 0 14" />,
  users: <path d="M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 9v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />,
  tierlists: <path d="m12 2 10 5-10 5L2 7l10-5Zm-10 10 10 5 10-5M2 17l10 5 10-5" />,
  reviews: <path d="m12 2.5 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.3l6.5-.9z" />,
  wall: <path d="M4 4h16v16H4zM4 10h16M10 10v10" />,
  comments: <path d="M20 16a3 3 0 0 1-3 3H9l-5 3V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10Z" />,
  market: <path d="M3 9h18l-1.5 11h-15L3 9Zm5 0V7a4 4 0 0 1 8 0v2" />,
  stores: <path d="M3 9 5 3h14l2 6M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0V9Zm2 5v7h14v-7" />,
  articles: <path d="M5 3h11l3 3v15H5V3Zm3 6h8M8 13h8M8 17h5" />,
  business: <path d="M9.5 3h5A2.5 2.5 0 0 1 17 5.5V7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3V5.5A2.5 2.5 0 0 1 9.5 3ZM2 13h20M12 12v2" />,
  drinks: <path d="M8 2h8l-1 4H9L8 2Zm1 4h6l1 3v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V9l1-3Zm-1 7h8" />,
  reports: <path d="M4 22V4m0 0h13l-2 4 2 4H4" />,
  admins: <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Zm-3 10 2 2 4-4" />,
};

/**
 * Sidebar by category, like a console: «Аналитика» on its own, then collapsible groups. Reviews, comments, wall posts
 * and tier lists have no section: staff delete them in place from the «⋯» menu (staff-moderation.ts).
 */
const OVERVIEW = { key: 'analytics', label: 'Аналитика' } as const;
const GROUPS: { title: string; items: { key: AdminSection; label: string }[] }[] = [
  { title: 'Модерация', items: [{ key: 'reports', label: 'Жалобы' }, { key: 'users', label: 'Участники' }, { key: 'market', label: 'Объявления' }] },
  { title: 'Каталог', items: [{ key: 'drinks', label: 'Напитки' }, { key: 'stores', label: 'Магазины' }, { key: 'articles', label: 'Статьи' }, { key: 'business', label: 'Компании' }] },
  { title: 'Продвижение', items: [{ key: 'campaigns', label: 'Кампании' }, { key: 'contest', label: 'Конкурс' }] },
  { title: 'Команда', items: [{ key: 'admins', label: 'Администраторы' }] },
];
const sectionHref = (key: AdminSection) => key === 'stores' ? '/admin/stores' : key === 'drinks' ? '/admin/drinks' : key === 'contest' ? '/admin/contest' : key === 'articles' ? '/admin/articles' : key === 'business' ? '/admin/business' : adminHref(key);

export function AdminIcon({ section }: { section: AdminIconName }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[section]}</svg>;
}

/** SaaS-style admin frame: grouped sidebar (a scrolling chip row on phones), top bar and the section body. */
export function AdminShell({ active, email, role = 'admin', title, subtitle, actions, children }: { active: AdminSection; email: string; role?: SiteRole; title: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) {
  const groups = GROUPS.map(group => ({ ...group, items: group.items.filter(item => role === 'admin' || !ADMIN_ONLY_SECTIONS.has(item.key)) })).filter(group => group.items.length);
  return <div className="admin-app ym-hide-content ym-disable-clickmap">
    <aside className="admin-sidebar" aria-label="Разделы администрирования">
      <div className="admin-sidebar-brand"><span className="admin-sidebar-logo" aria-hidden="true">C</span><span><strong>CanRush</strong><small>Админ-панель</small></span></div>
      <nav className="admin-sidebar-nav">
        <div className="admin-sidebar-group"><Link href={sectionHref(OVERVIEW.key)} aria-current={active === OVERVIEW.key ? 'page' : undefined}><AdminIcon section={OVERVIEW.key} /><span>{OVERVIEW.label}</span></Link></div>
        {groups.map(group => <AdminSidebarGroup key={group.title} title={group.title}>
          {group.items.map(item => <Link key={item.key} href={sectionHref(item.key)} aria-current={item.key === active ? 'page' : undefined}><AdminIcon section={item.key} /><span>{item.label}</span></Link>)}
        </AdminSidebarGroup>)}
      </nav>
      <div className="admin-sidebar-account"><span className="admin-sidebar-avatar" aria-hidden="true">{email.slice(0, 1).toUpperCase()}</span><span><strong>{email}</strong><small className="admin-sidebar-role">{SITE_ROLE_LABELS[role]}</small><Link href="/profile/settings">Вернуться в настройки</Link></span></div>
    </aside>
    <div className="admin-main">
      <header className="admin-topbar"><div><p className="admin-breadcrumb">Админ-панель / {title}</p><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{actions && <div className="admin-topbar-actions">{actions}</div>}</header>
      <div className="admin-content">{children}</div>
    </div>
  </div>;
}
