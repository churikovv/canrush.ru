import { experienceLevel } from '@/lib/experience-level';
import { getFavoriteGroups } from '@/lib/catalog';
import Image from 'next/image';
import { getProfileRatings, getProfileWall, getConnections } from '@/lib/profile-community';
import { getListings } from '@/lib/market';
import { getExperience } from '@/lib/profile-experience';
import { ProfileExperience } from '@/components/profile-experience';
import { ProfileConnections } from '@/components/profile-connections';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { BrandShell } from '@/components/brand-shell';
import { ProfileEditForm } from '@/components/profile-edit-form';
import { ProfileNavigation } from '@/components/profile-navigation';
import { auth } from '@/lib/auth';
import { ensureOwnProfile } from '@/lib/profile';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Редактирование профиля',
  robots: { index: false, follow: false },
};

export default async function ProfileEditPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in');

  const profile = await ensureOwnProfile(session.user);

  const [ratings, wall, listings, experience, friends, followers, following, favorites] = await Promise.all([
    getProfileRatings(profile.id), getProfileWall(profile.id), getListings(1, profile.id, false, profile.username), getExperience([profile.username]), getConnections(profile.id, 'friends'), getConnections(profile.id, 'followers'), getConnections(profile.id, 'following'), getFavoriteGroups(profile.id),
  ]);
  const layoutPreviews = {
    favorites: favorites.length ? <div className="layout-listing-previews">{favorites.slice(0, 3).map(item => <div key={`${item.brand}:${item.flavor}`}>{item.coverImageUrl && <Image src={item.coverImageUrl} width={80} height={80} alt="" />}<strong>{item.brand}</strong></div>)}</div> : <p>Пока нет избранных напитков.</p>,
    experience: <ProfileExperience username={profile.username} initial={experience[profile.username]} expanded />,
    ratings: <div><strong className="layout-score">{ratings.overall.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} / 10</strong><p>Средняя оценка · {ratings.count} отзывов</p></div>,
    listings: listings.items.length ? <div className="layout-listing-previews">{listings.items.slice(0, 2).map(item => <div key={item.id}>{item.photos[0] && <Image src={`/api/market-photos/${item.photos[0]}?size=thumbnail`} width={80} height={80} unoptimized alt="" />}<strong>{item.title}</strong></div>)}</div> : <p>Вы пока не создавали объявлений.</p>,
    wall: <div><p>{wall.comments[0]?.text ?? 'Здесь пока тихо. Оставьте первый комментарий.'}</p><span className="community-muted">Записей: {wall.count}</span></div>,
    social: <ProfileConnections username={profile.username} groups={{ friends, followers, following }} />,
    about: <p>{profile.telegramChannel ? `@${profile.telegramChannel}` : 'Канал не указан'}</p>,
  };
  return (
    <BrandShell headerAction={<ProfileNavigation active="profile" />} surfaceClassName="profile-surface">
      <ProfileEditForm level={experienceLevel(experience[profile.username]?.xp ?? 0).level} profile={profile} layoutPreviews={layoutPreviews} />
    </BrandShell>
  );
}
