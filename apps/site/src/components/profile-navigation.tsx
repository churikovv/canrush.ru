import Image from 'next/image';
import Link from 'next/link';

type ProfileNavigationActive = 'catalog' | 'favorites' | 'tierlists' | 'prices' | 'profile';

interface ProfileNavigationProps {
  active?: ProfileNavigationActive;
}

const ICONS = {
  favorites: '/brand/icons/heart.svg',
  search: '/brand/icons/search.svg',
  tierlists: '/brand/icons/tierlists.svg',
  profile: '/brand/icons/profile.svg',
} as const;

export function ProfileNavigation({ active }: ProfileNavigationProps) {
  return (
    <nav className="profile-navigation" aria-label="Основная навигация">
      <Link
        className="profile-navigation-item"
        href="/profile/favorites"
        aria-label="Избранное"
        aria-current={active === 'favorites' ? 'page' : undefined}
      >
        <Image src={ICONS.favorites} width={24} height={24} alt="" />
        <span className="profile-navigation-label">Избранное</span>
      </Link>
      <Link
        className="profile-navigation-item"
        href="/catalog"
        aria-label="Каталог"
        aria-current={active === 'catalog' ? 'page' : undefined}
      >
        <Image src={ICONS.search} width={24} height={24} alt="" />
        <span className="profile-navigation-label">Каталог</span>
      </Link>
      <Link
        className="profile-navigation-item"
        href="/prices"
        aria-label="Цены по магазинам"
        title="Цены по магазинам"
        aria-current={active === 'prices' ? 'page' : undefined}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 19V12M12 19V5M19 19V9" stroke="var(--color-brand, #006eff)" strokeWidth="4" strokeLinecap="round" />
        </svg>
        <span className="profile-navigation-label">Цены</span>
      </Link>
      <Link
        className="profile-navigation-item"
        href="/tierlists"
        aria-label="Тирлисты"
        aria-current={active === 'tierlists' ? 'page' : undefined}
      >
        <Image src={ICONS.tierlists} width={24} height={24} alt="" />
        <span className="profile-navigation-label">Тирлисты</span>
      </Link>
      <Link
        className="profile-navigation-item"
        href="/profile"
        aria-label="Профиль"
        aria-current={active === 'profile' ? 'page' : undefined}
      >
        <Image src={ICONS.profile} width={24} height={24} alt="" />
        <span className="profile-navigation-label">Профиль</span>
      </Link>
    </nav>
  );
}
