import type { ReactNode } from 'react';
import Link from '@/components/navigation-progress';
import { adminHref, type AdminTab } from '@/lib/admin-tabs';

export type AdminSection = AdminTab | 'stores';

const ICONS: Record<AdminSection, ReactNode> = {
  analytics: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  campaigns: <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Zm13-3a5 5 0 0 1 0 8m3-11a9 9 0 0 1 0 14" />,
  users: <path d="M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 9v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />,
  tierlists: <path d="m12 2 10 5-10 5L2 7l10-5Zm-10 10 10 5 10-5M2 17l10 5 10-5" />,
  reviews: <path d="m12 2.5 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.3l6.5-.9z" />,
  comments: <path d="M20 16a3 3 0 0 1-3 3H9l-5 3V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10Z" />,
  wall: <path d="M4 4h16v16H4zM4 10h16M10 10v10" />,
  market: <path d="M3 9h18l-1.5 11h-15L3 9Zm5 0V7a4 4 0 0 1 8 0v2" />,
  stores: <path d="M3 9 5 3h14l2 6M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0V9Zm2 5v7h14v-7" />,
  reports: <path d="M4 22V4m0 0h13l-2 4 2 4H4" />,
  admins: <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Zm-3 10 2 2 4-4" />,
};

const GROUPS: { title: string; items: { key: AdminSection; label: string }[] }[] = [
  { title: 'Обзор', items: [{ key: 'analytics', label: 'Аналитика' }, { key: 'campaigns', label: 'Кампании' }] },
  { title: 'Контент', items: [{ key: 'tierlists', label: 'Тирлисты' }, { key: 'reviews', label: 'Отзывы' }, { key: 'comments', label: 'Комментарии' }, { key: 'wall', label: 'Стена' }] },
  { title: 'Маркет', items: [{ key: 'market', label: 'Объявления' }, { key: 'stores', label: 'Магазины' }] },
  { title: 'Модерация', items: [{ key: 'reports', label: 'Жалобы' }, { key: 'users', label: 'Участники' }, { key: 'admins', label: 'Администраторы' }] },
];

export function AdminIcon({ section }: { section: AdminSection }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[section]}</svg>;
}

/** SaaS-style admin frame: grouped sidebar (a scrolling chip row on phones), top bar and the section body. */
export function AdminShell({ active, email, title, subtitle, actions, children }: { active: AdminSection; email: string; title: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) {
  return <div className="admin-app ym-hide-content ym-disable-clickmap">
    <aside className="admin-sidebar" aria-label="Разделы администрирования">
      <div className="admin-sidebar-brand"><span className="admin-sidebar-logo" aria-hidden="true">C</span><span><strong>CanRush</strong><small>Админ-панель</small></span></div>
      <nav className="admin-sidebar-nav">
        {GROUPS.map(group => <div className="admin-sidebar-group" key={group.title}>
          <p>{group.title}</p>
          {group.items.map(item => <Link key={item.key} href={item.key === 'stores' ? '/admin/stores' : adminHref(item.key)} aria-current={item.key === active ? 'page' : undefined}><AdminIcon section={item.key} /><span>{item.label}</span></Link>)}
        </div>)}
      </nav>
      <div className="admin-sidebar-account"><span className="admin-sidebar-avatar" aria-hidden="true">{email.slice(0, 1).toUpperCase()}</span><span><strong>{email}</strong><Link href="/profile">Вернуться в профиль</Link></span></div>
    </aside>
    <div className="admin-main">
      <header className="admin-topbar"><div><p className="admin-breadcrumb">Админ-панель / {title}</p><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{actions && <div className="admin-topbar-actions">{actions}</div>}</header>
      <div className="admin-content">{children}</div>
    </div>
  </div>;
}
