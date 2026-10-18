import Link from '@/components/navigation-progress';
import { NavigationIcon, type NavigationSection } from '@/components/navigation-icon';
import { SiteTabBarLabel } from '@/components/site-tab-bar-label';
import { TapMotion } from '@/components/tap-motion';

interface Tab {
  section: NavigationSection;
  href: string;
  label: string;
  accessibleLabel?: string;
}

const TABS: readonly Tab[] = [
  { section: 'catalog', href: '/catalog', label: 'Каталог' },
  { section: 'prices', href: '/prices', label: 'Магазины', accessibleLabel: 'Магазины и цены' },
  { section: 'tierlists', href: '/tierlists', label: 'Тирлисты' },
  { section: 'feed', href: '/feed', label: 'Лента' },
  { section: 'market', href: '/market', label: 'Маркет' },
  { section: 'profile', href: '/profile', label: 'Профиль' },
];

/** Subsections light up their tab: favorites live in the profile, store pages under «Магазины». */
function tabSection(active?: NavigationSection): NavigationSection | undefined {
  return active === 'favorites' ? 'profile' : active === 'stores' ? 'prices' : active;
}

export function SiteTabBar({ active }: { active?: NavigationSection }) {
  return (
    <nav className="site-tab-bar" aria-label="Основная навигация" data-motion-scope="tab-bar">
      <TapMotion />
      {TABS.map(({ section, href, label, accessibleLabel }) => (
        <Link
          key={section}
          className="site-tab-bar-item"
          data-motion={section}
          href={href}
          aria-label={accessibleLabel}
          aria-current={tabSection(active) === section ? 'page' : undefined}
        >
          <NavigationIcon section={section} />
          <SiteTabBarLabel>{label}</SiteTabBarLabel>
        </Link>
      ))}
    </nav>
  );
}
