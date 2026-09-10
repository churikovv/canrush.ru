import Image from 'next/image';
import Link from 'next/link';
import { SignOutButton } from '@/components/sign-out-button';
import type { ProfileData } from '@/lib/profile';

interface ProfileViewProps {
  profile: ProfileData;
  isOwn: boolean;
  favoritesHref: string;
  tierListsHref: string;
  adminHref?: string;
}

function memberSince(value: Date | string): string {
  const parts = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).formatToParts(
    new Date(value),
  );
  const month = parts.find((part) => part.type === 'month')?.value;
  const year = parts.find((part) => part.type === 'year')?.value;
  return month && year ? `${month} ${year}` : String(year ?? '');
}

function displayName(profile: ProfileData): string {
  const name = profile.name.trim();
  return name && !name.includes('@') ? name : profile.username;
}

interface ProfileInfoRowProps {
  icon: string;
  iconSize?: number;
  label: string;
  value: string | number;
  href?: string;
  external?: boolean;
}

function ProfileInfoRow({ icon, iconSize = 16, label, value, href, external }: ProfileInfoRowProps) {
  const content = (
    <>
      <span className="profile-info-label">
        <Image src={icon} width={iconSize} height={iconSize} alt="" />
        {label}
      </span>
      <span className={external && href ? 'profile-info-value profile-info-value-link' : 'profile-info-value'}>{value}</span>
    </>
  );

  return href ? (
    <Link
      className="profile-info-row profile-info-row-link"
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
    >
      {content}
    </Link>
  ) : (
    <div className="profile-info-row">{content}</div>
  );
}

export function ProfileHero({ profile }: { profile: ProfileData }) {
  return (
    <section className="profile-hero" aria-labelledby="profile-name">
      <div className="profile-banner">
        <Image
          src="/brand/profile-illustration.png"
          width={188}
          height={120}
          alt=""
          aria-hidden="true"
          priority
        />
      </div>
      <div className="profile-identity">
        <span className="profile-avatar" aria-hidden="true">
          <Image src="/brand/icons/profile-avatar.svg" width={24} height={24} alt="" />
        </span>
        <p className="profile-username">@{profile.username}</p>
        <h1 id="profile-name">{displayName(profile)}</h1>
        <p>Аккаунт с {memberSince(profile.createdAt)}</p>
      </div>
    </section>
  );
}

export function ProfileView({ profile, isOwn, favoritesHref, tierListsHref, adminHref }: ProfileViewProps) {
  const telegramHref = profile.telegramChannel ? `https://t.me/${profile.telegramChannel}` : undefined;

  return (
    <div className={`profile-layout${isOwn ? ' ym-hide-content' : ''}`}>
      <ProfileHero profile={profile} />

      {isOwn ? (
        <Link className="profile-edit-link" href="/profile/edit">
          Редактировать
          <Image src="/brand/icons/edit.svg" width={24} height={24} alt="" />
        </Link>
      ) : null}

      <section className="profile-information" aria-labelledby="profile-information-title">
        <h2 id="profile-information-title">Информация</h2>
        <div className="profile-information-list">
          <ProfileInfoRow
            icon="/brand/icons/stat-tierlists.svg"
            label="Тирлисты"
            value={profile.tierListCount}
            href={tierListsHref}
          />
          <ProfileInfoRow icon="/brand/icons/stat-reviews.svg" label="Отзывы" value={profile.reviewCount} />
          <ProfileInfoRow
            icon="/brand/icons/stat-favorites.svg"
            iconSize={12}
            label="Избранное"
            value={profile.favoriteCount}
            href={favoritesHref}
          />
          <ProfileInfoRow
            icon="/brand/icons/channel.svg"
            iconSize={12}
            label="Канал"
            value={profile.telegramChannel ? `@${profile.telegramChannel}` : 'Не указан'}
            href={telegramHref}
            external
          />
          {adminHref ? (
            <ProfileInfoRow
              icon="/brand/icons/admin.svg"
              label="Администрирование"
              value="Открыть"
              href={adminHref}
            />
          ) : null}
        </div>
      </section>

      {isOwn ? <SignOutButton /> : null}
    </div>
  );
}
