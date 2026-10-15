import Link from '@/components/navigation-progress';
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
          data-motion="catalog"
          href="/catalog"
          aria-label="Каталог"
          aria-current={active === 'catalog' ? 'page' : undefined}
        >
          <NavigationIcon section="catalog" />
          <span className="profile-navigation-label">Каталог</span>
        </Link>
        <Link
          className="profile-navigation-item"
          data-motion="prices"
          href="/prices"
          aria-label="Магазины и цены"
          title="Магазины и цены"
          aria-current={active === 'prices' ? 'page' : undefined}
        >
          <NavigationIcon section="prices" />
          <span className="profile-navigation-label">Магазины</span>
        </Link>
        <Link
          className="profile-navigation-item"
          data-motion="tierlists"
          href="/tierlists"
          aria-label="Тирлисты"
          aria-current={active === 'tierlists' ? 'page' : undefined}
        >
          <NavigationIcon section="tierlists" />
          <span className="profile-navigation-label">Тирлисты</span>
        </Link>
        <Link className="profile-navigation-item" data-motion="feed" href="/feed" aria-label="Лента" aria-current={active === 'feed' ? 'page' : undefined}>
          <NavigationIcon section="feed" /><span className="profile-navigation-label">Лента</span>
        </Link>
        <Link className="profile-navigation-item" data-motion="market" href="/market" aria-label="Маркет" aria-current={active === 'market' ? 'page' : undefined}>
          <NavigationIcon section="market" /><span className="profile-navigation-label">Маркет</span>
        </Link>
        <Link
          className="profile-navigation-item"
          data-motion="profile"
          href="/profile"
          aria-label="Профиль"
          aria-current={(active === 'profile' || active === 'favorites') ? 'page' : undefined}
        >
          <NavigationIcon section="profile" />
          <span className="profile-navigation-label">Профиль</span>
        </Link>
      </nav>
      <SiteTabBar active={active} />
    </>
  );
}
