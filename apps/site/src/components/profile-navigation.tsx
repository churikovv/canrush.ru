import Link from 'next/link';
import { NavigationIcon, type NavigationSection } from '@/components/navigation-icon';
import { SiteTabBar } from '@/components/site-tab-bar';

interface ProfileNavigationProps {
  active?: NavigationSection;
}

export function ProfileNavigation({ active }: ProfileNavigationProps) {
  return (
    <>
      <nav className="profile-navigation" aria-label="Основная навигация">
        <Link
          className="profile-navigation-item"
          href="/profile/favorites"
          aria-label="Избранное"
          aria-current={active === 'favorites' ? 'page' : undefined}
        >
          <NavigationIcon section="favorites" />
          <span className="profile-navigation-label">Избранное</span>
        </Link>
        <Link
          className="profile-navigation-item"
          href="/catalog"
          aria-label="Каталог"
          aria-current={active === 'catalog' ? 'page' : undefined}
        >
          <NavigationIcon section="catalog" />
          <span className="profile-navigation-label">Каталог</span>
        </Link>
        <Link
          className="profile-navigation-item"
          href="/prices"
          aria-label="Цены по магазинам"
          title="Цены по магазинам"
          aria-current={active === 'prices' ? 'page' : undefined}
        >
          <NavigationIcon section="prices" />
          <span className="profile-navigation-label">Цены</span>
        </Link>
        <Link
          className="profile-navigation-item"
          href="/tierlists"
          aria-label="Тирлисты"
          aria-current={active === 'tierlists' ? 'page' : undefined}
        >
          <NavigationIcon section="tierlists" />
          <span className="profile-navigation-label">Тирлисты</span>
        </Link>
        <Link
          className="profile-navigation-item"
          href="/profile"
          aria-label="Профиль"
          aria-current={active === 'profile' ? 'page' : undefined}
        >
          <NavigationIcon section="profile" />
          <span className="profile-navigation-label">Профиль</span>
        </Link>
      </nav>
      <SiteTabBar active={active} />
    </>
  );
}
