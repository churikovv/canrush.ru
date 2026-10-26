import { getSessionCookie } from 'better-auth/cookies';
import { PushRegistration } from '@/components/push-registration';
import { headers } from 'next/headers';
import { HeaderMenu } from '@/components/header-menu';
import { HeaderProfile } from '@/components/header-profile';
import type { NavigationSection } from '@/components/navigation-icon';
import { SiteTabBar } from '@/components/site-tab-bar';

interface ProfileNavigationProps {
  active?: NavigationSection;
  /** Defaults to the presence of the session cookie: cheap, and a stale cookie only leads to the sign-in page. */
  signedIn?: boolean;
}

/**
 * Desktop header groups; the mobile tab bar has its own five tabs with search in the middle. The member's own profile is
 * the avatar in the header's right corner on every screen (`HeaderProfile`), after the bell and the settings.
 */
const COMMUNITY = [
  { section: 'tierlists', href: '/tierlists', label: 'Тирлисты', hint: 'Рейтинги вкусов' },
  { section: 'market', href: '/market', label: 'Объявления', hint: 'Маркет банок от участников' },
  { section: 'feed', href: '/feed', label: 'Лента', hint: 'Записи всех стен' },
  { section: 'news', href: '/news', label: 'Новости', hint: 'Статьи участников' },
  { section: 'dating', href: '/community?type=dating', label: 'Дейтинг', hint: 'Свайпай напитки' },
  { section: 'people', href: '/community?type=people', label: 'Люди', hint: 'Участники и их вкусы' },
  { section: 'leaderboard', href: '/leaderboard', label: 'Рейтинг', hint: 'Топ месяца и лучшие участники' },
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
      </nav>
      <HeaderProfile active={active === 'profile' || active === 'favorites'} signedIn={member} />
      <SiteTabBar active={active} />
      <PushRegistration signedIn={member} />
    </>
  );
}
