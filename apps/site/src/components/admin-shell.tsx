import type { ReactNode } from 'react';
import Link from '@/components/navigation-progress';
import { DashboardShell } from '@/components/dashboard-shell';
import { adminHref, type AdminTab } from '@/lib/admin-tabs';
import { SITE_ROLE_LABELS, type SiteRole } from '@/lib/admin-roles';
import type { AdminQueues } from '@/lib/admin-queues';

export type AdminSection = AdminTab | 'stores' | 'drinks' | 'contest' | 'articles' | 'business' | 'support' | 'push' | 'errors';
/** Sections a moderator does not see: administrators, contests, campaigns, push broadcasts and site errors. */
export const ADMIN_ONLY_SECTIONS: ReadonlySet<AdminSection> = new Set(['campaigns', 'push', 'contest', 'admins', 'errors']);

/** Sections plus the icons of the analytics cards that lead to public pages (reviews, tier lists, wall posts). */
export type AdminIconName = AdminSection | 'reviews' | 'tierlists' | 'wall' | 'comments' | 'settings' | 'site';
const ICONS: Record<AdminIconName, ReactNode> = {
  analytics: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  contest: <path d="M20 12v9H4v-9M2 7h20v5H2zM12 22V7m0 0H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7Zm0 0h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7Z" />,
  campaigns: <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Zm13-3a5 5 0 0 1 0 8m3-11a9 9 0 0 1 0 14" />,
  push: <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8Zm-4.3 12a2 2 0 0 1-3.4 0" />,
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
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3m0 14v3M4.9 4.9 7 7m10 10 2.1 2.1M2 12h3m14 0h3M4.9 19.1 7 17m10-10 2.1-2.1" /></>,
  site: <path d="M10 14 21 3m0 0h-6m6 0v6M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" />,
  support: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z" /><path d="M8 9h8M8 13h5" /></>,
  admins: <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Zm-3 10 2 2 4-4" />,
  errors: <path d="M12 3 2 20h20L12 3Zm0 7v4m0 3v.01" />,
};

/**
 * Sidebar by category, like a console: «Аналитика» on its own, then folding groups with their icon. Reviews, comments,
 * wall posts and tier lists have no section: staff delete them in place from the «⋯» menu (staff-moderation.ts).
 */
const OVERVIEW = { key: 'analytics', label: 'Аналитика' } as const;
const GROUPS: { title: string; icon: AdminIconName; items: { key: AdminSection; label: string }[] }[] = [
  { title: 'Модерация', icon: 'reports', items: [{ key: 'support', label: 'Поддержка' }, { key: 'reports', label: 'Жалобы' }, { key: 'users', label: 'Участники' }, { key: 'market', label: 'Объявления' }] },
  { title: 'Каталог', icon: 'drinks', items: [{ key: 'drinks', label: 'Напитки' }, { key: 'stores', label: 'Магазины' }, { key: 'articles', label: 'Статьи' }, { key: 'business', label: 'Компании' }] },
  { title: 'Продвижение', icon: 'campaigns', items: [{ key: 'campaigns', label: 'Кампании' }, { key: 'push', label: 'Push-рассылки' }, { key: 'contest', label: 'Конкурс' }] },
  { title: 'Команда', icon: 'admins', items: [{ key: 'admins', label: 'Администраторы' }] },
  { title: 'Система', icon: 'errors', items: [{ key: 'errors', label: 'Ошибки' }] },
];
const sectionHref = (key: AdminSection) => key === 'push' ? '/admin/push' : key === 'errors' ? '/admin/errors' : key === 'support' ? '/admin/support' : key === 'stores' ? '/admin/stores' : key === 'drinks' ? '/admin/drinks' : key === 'contest' ? '/admin/contest' : key === 'articles' ? '/admin/articles' : key === 'business' ? '/admin/business' : adminHref(key);

export function AdminIcon({ section, size = 18 }: { section: AdminIconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[section]}</svg>;
}

/**
 * The admin panel on the dashboard frame it shares with the business cabinet (`DashboardShell`): the CanRush mark
 * with «Админ», a search over members, the grouped sections a role may open, and the account card at the bottom
 * (role, the way back to settings and to the site). On phones the sidebar is the same drawer.
 */
/** How each queue reads to a screen reader beside its badge. */
const QUEUE_LABELS: Record<keyof AdminQueues, string> = {
  support: 'ждут ответа', reports: 'открытых жалоб', drinks: 'на проверке', stores: 'на проверке', articles: 'на проверке', business: 'ждут решения',
};

export function AdminShell({ active, email, role = 'admin', title, subtitle, actions, queues, children }: {
  active: AdminSection; email: string; role?: SiteRole; title: string; subtitle?: string; actions?: ReactNode;
  /** What waits in each section (`getAdminQueues`): badges beside the sections, and on a folded group its total. */
  queues?: Partial<AdminQueues>; children: ReactNode;
}) {
  const badge = (key: AdminSection) => {
    const count = queues?.[key as keyof AdminQueues] ?? 0;
    return count > 0 ? { count, label: `${QUEUE_LABELS[key as keyof AdminQueues]}: ${count}` } : undefined;
  };
  const groups = GROUPS.map(group => ({ ...group, items: group.items.filter(item => role === 'admin' || !ADMIN_ONLY_SECTIONS.has(item.key)) })).filter(group => group.items.length);
  return <DashboardShell className="admin-root ym-hide-content ym-disable-clickmap" label="Админ" home={sectionHref(OVERVIEW.key)} menuLabel="Разделы администрирования"
    title={title} subtitle={subtitle} actions={actions}
    search={{ action: '/admin', placeholder: 'Найти участника…', label: 'Поиск участников', hidden: { tab: 'users' } }}
    nav={[
      { label: OVERVIEW.label, icon: <AdminIcon section={OVERVIEW.key} size={20} />, href: sectionHref(OVERVIEW.key), current: active === OVERVIEW.key },
      ...groups.map(group => ({ label: group.title, icon: <AdminIcon section={group.icon} size={20} />, items: group.items.map(item => ({ label: item.label, href: sectionHref(item.key), current: item.key === active,
        badge: badge(item.key) })) })),
    ]}
    account={{
      name: email, label: `${email}: настройки`, caption: SITE_ROLE_LABELS[role], logo: email.slice(0, 1).toUpperCase(),
      menu: <>
        <Link href="/profile/settings"><AdminIcon section="settings" />Настройки профиля</Link>
        <Link href="/"><AdminIcon section="site" />Сайт CanRush</Link>
      </>,
    }}>
    {children}
  </DashboardShell>;
}
