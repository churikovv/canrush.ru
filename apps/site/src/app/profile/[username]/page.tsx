import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { ProfileView } from '@/components/profile-view';
import { auth } from '@/lib/auth';
import { isSiteAdminEmail } from '@/lib/admin';
import { profilePageNumber } from '@/lib/profile-achievements';
import { getProfileByUsername } from '@/lib/profile';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Профиль',
  robots: { index: false, follow: false },
};

export default async function PublicProfilePage({ params, searchParams }: { params: Promise<{ username: string }>; searchParams: Promise<{ wallPage?: string }> }) {
  const { username } = await params;
  const [profile, session] = await Promise.all([
    getProfileByUsername(username),
    auth.api.getSession({ headers: await headers() }),
  ]);
  if (!profile) notFound();

  const isOwn = session?.user.id === profile.id;
  const viewerIsAdmin = session ? await isSiteAdminEmail(session.user.email) : false;
  const favoritesHref = isOwn ? '/profile/favorites' : `/profile/${profile.username}/favorites`;
  const tierListsHref = isOwn ? '/profile/tierlists' : `/profile/${profile.username}/tierlists`;

  return (
    <BrandShell headerAction={<ProfileNavigation active="profile" />} surfaceClassName="profile-surface">
      <ProfileView profile={profile} isOwn={isOwn} viewerId={session?.user.id} viewerIsAdmin={viewerIsAdmin} wallPage={profilePageNumber((await searchParams).wallPage)} favoritesHref={favoritesHref} tierListsHref={tierListsHref} />
    </BrandShell>
  );
}
