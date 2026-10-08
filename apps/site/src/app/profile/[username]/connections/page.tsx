import { ProfileBackButton } from '@/components/profile-back-button';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { notFound } from 'next/navigation';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { getProfileByUsername } from '@/lib/profile';
import { COMMUNITY_PAGE_SIZE, getConnections, type ConnectionKind } from '@/lib/profile-community';
import { profilePageNumber } from '@/lib/profile-achievements';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Подписки и друзья', robots: { index: false, follow: false } };
const labels = { friends: 'Друзья', followers: 'Подписчики', following: 'Подписки' };

export default async function ConnectionsPage({ params, searchParams }: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ type?: string; page?: string }>;
}) {
  const { username } = await params;
  const query = await searchParams;
  const profile = await getProfileByUsername(username);
  if (!profile) notFound();
  const kind: ConnectionKind = query.type === 'followers' || query.type === 'following' ? query.type : 'friends';
  const page = profilePageNumber(query.page);
  const data = await getConnections(profile.id, kind, page);
  const base = `/profile/${profile.username}`;
  const pages = Math.ceil(data.count / COMMUNITY_PAGE_SIZE);
  return <BrandShell headerAction={<ProfileNavigation active="profile" />} surfaceClassName="profile-surface">
    <div className="community-profile community-directory">
      <ProfileBackButton href={base} />
      <h1>{labels[kind]} <span className="community-muted">{data.count}</span></h1>
      <nav className="community-tabs" aria-label="Связи пользователя">{Object.entries(labels).map(([key, label]) => <Link href={`${base}/connections?type=${key}`} key={key} aria-current={key === kind ? 'page' : undefined}>{label}</Link>)}</nav>
      {data.users.length ? <div className="community-user-list">{data.users.map(user => <Link href={`/profile/${user.username}`} key={user.username}><span className="community-user-avatar" aria-hidden="true">{user.avatarId ? <Image src={`/api/profile-images/${user.avatarId}`} width={44} height={44} unoptimized alt="" /> : user.username.slice(0, 1).toUpperCase()}</span><span><strong>{user.name && !user.name.includes('@') ? user.name : user.username}</strong><span>@{user.username}</span></span><span aria-hidden="true">→</span></Link>)}</div> : <p className="community-empty">{kind === 'friends' ? 'Друзья появятся после взаимной подписки.' : 'В этом списке пока никого нет.'}</p>}
      {pages > 1 && <nav className="community-pagination" aria-label="Страницы пользователей">{page > 1 ? <Link href={`${base}/connections?type=${kind}&page=${page - 1}`}>← Назад</Link> : <span />}<span>{page} / {pages}</span>{page < pages ? <Link href={`${base}/connections?type=${kind}&page=${page + 1}`}>Далее →</Link> : <span />}</nav>}
    </div>
  </BrandShell>;
}
