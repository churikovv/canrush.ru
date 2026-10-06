import Link from 'next/link';
import { NavigationIcon, type NavigationSection } from '@/components/navigation-icon';
import { SiteTabBarLabel } from '@/components/site-tab-bar-label';

interface Tab {
  section: NavigationSection;
  href: string;
  label: string;
  accessibleLabel?: string;
}

const TABS: readonly Tab[] = [
  { section: 'catalog', href: '/catalog', label: 'Каталог' },
  { section: 'prices', href: '/prices', label: 'Цены', accessibleLabel: 'Цены по магазинам' },
  { section: 'tierlists', href: '/tierlists', label: 'Тирлисты' },
  { section: 'market', href: '/market', label: 'Маркет' },
  { section: 'messages', href: '/messages', label: 'Сообщения' },
  { section: 'profile', href: '/profile', label: 'Профиль' },
];

export function SiteTabBar({ active }: { active?: NavigationSection }) {
  return (
    <nav className="site-tab-bar" aria-label="Основная навигация">
      {TABS.map(({ section, href, label, accessibleLabel }) => (
        <Link
          key={section}
          className="site-tab-bar-item"
          href={href}
          aria-label={accessibleLabel}
          aria-current={(active === 'favorites' ? 'profile' : active) === section ? 'page' : undefined}
        >
          <NavigationIcon section={section} />
          <SiteTabBarLabel>{label}</SiteTabBarLabel>
        </Link>
      ))}
    </nav>
  );
}
