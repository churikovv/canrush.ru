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
        <Link className="profile-navigation-item" href="/market" aria-label="Маркет" aria-current={active === 'market' ? 'page' : undefined}>
          <NavigationIcon section="market" /><span className="profile-navigation-label">Маркет</span>
        </Link>
        <Link className="profile-navigation-item" href="/messages" aria-label="Заказы" aria-current={active === 'messages' ? 'page' : undefined}>
          <NavigationIcon section="messages" /><span className="profile-navigation-label">Заказы</span>
        </Link>
        <Link
          className="profile-navigation-item"
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
