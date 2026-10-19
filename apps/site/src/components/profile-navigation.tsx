import { getSessionCookie } from 'better-auth/cookies';
import { headers } from 'next/headers';
import Link from '@/components/navigation-progress';
import { HeaderMenu } from '@/components/header-menu';
import { NavigationIcon, type NavigationSection } from '@/components/navigation-icon';
import { SiteTabBar } from '@/components/site-tab-bar';

interface ProfileNavigationProps {
  active?: NavigationSection;
  /** Defaults to the presence of the session cookie: cheap, and a stale cookie only leads to the sign-in page. */
  signedIn?: boolean;
}

/** Desktop header groups; the mobile tab bar has its own five tabs with search in the middle. */
const COMMUNITY = [
  { section: 'tierlists', href: '/tierlists', label: 'Тирлисты', hint: 'Рейтинги вкусов' },
  { section: 'market', href: '/market', label: 'Объявления', hint: 'Маркет банок от участников' },
  { section: 'feed', href: '/feed', label: 'Лента', hint: 'Записи всех стен' },
] as const;
const STORES = [
  { section: 'catalog', href: '/catalog', label: 'Каталог', hint: 'Все энергетики и отзывы' },
  { section: 'prices', href: '/prices', label: 'Цены', hint: 'Цены по магазинам' },
  { section: 'stores', href: '/market/stores', label: 'Найти', hint: 'Магазины на карте' },
] as const;

export async function ProfileNavigation({ active, signedIn }: ProfileNavigationProps) {
  const member = signedIn ?? Boolean(getSessionCookie(await headers()));
  const items = (group: typeof COMMUNITY | typeof STORES) => group.map(item => ({ ...item, current: item.section === active }));
  return (
    <>
      <nav className="profile-navigation" aria-label="Основная навигация">
        <HeaderMenu label="Сообщество" icon="community" current={active === 'community' || COMMUNITY.some(item => item.section === active)} items={items(COMMUNITY)} />
        <HeaderMenu label="Магазины" icon="prices" current={STORES.some(item => item.section === active)} items={items(STORES)} />
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
      <SiteTabBar active={active} signedIn={member} />
    </>
  );
}
