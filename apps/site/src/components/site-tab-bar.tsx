import Link from '@/components/navigation-progress';
import { NavigationIcon, type NavigationIconName, type NavigationSection } from '@/components/navigation-icon';
import { SiteTabBarLabel } from '@/components/site-tab-bar-label';
import { TapMotion } from '@/components/tap-motion';

interface Tab {
  section: NavigationSection;
  icon?: NavigationIconName;
  href: string;
  label: string;
  accessibleLabel?: string;
}

/** Search sits in the middle as a raised button; the last tab is the profile, or sign-in for guests. */
function tabs(signedIn: boolean): readonly Tab[] {
  return [
    { section: 'home', href: '/', label: 'Главная' },
    { section: 'calendar', href: '/calendar', label: 'Календарь', accessibleLabel: 'Календарь выпитого' },
    { section: 'search', href: '/search', label: 'Поиск', accessibleLabel: 'Поиск: каталог, магазины и маркет' },
    { section: 'community', href: '/community', label: 'Сообщество', accessibleLabel: 'Сообщество: тирлисты, лента и люди' },
    signedIn ? { section: 'profile', href: '/profile', label: 'Профиль' } : { section: 'profile', icon: 'sign-in', href: '/sign-in', label: 'Войти' },
  ];
}

/** Sections without a tab of their own light up the tab they live under. */
function tabSection(active?: NavigationSection): NavigationSection | undefined {
  switch (active) {
    case 'favorites': return 'profile';
    case 'catalog': case 'prices': case 'stores': case 'market': return 'search';
    case 'tierlists': case 'feed': return 'community';
    default: return active;
  }
}

export function SiteTabBar({ active, signedIn = false }: { active?: NavigationSection; signedIn?: boolean }) {
  return (
    <nav className="site-tab-bar" aria-label="Основная навигация" data-motion-scope="tab-bar">
      <TapMotion />
      {tabs(signedIn).map(({ section, icon, href, label, accessibleLabel }) => (
        <Link
          key={section}
          className="site-tab-bar-item"
          data-tab={section}
          data-motion={icon ?? section}
          href={href}
          aria-label={accessibleLabel}
          aria-current={tabSection(active) === section ? 'page' : undefined}
        >
          <NavigationIcon section={icon ?? section} />
          <SiteTabBarLabel>{label}</SiteTabBarLabel>
        </Link>
      ))}
    </nav>
  );
}
