import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { BrandShell } from '@/components/brand-shell';
import { ProfileFavorites } from '@/components/profile-favorites';
import { ProfileNavigation } from '@/components/profile-navigation';
import { auth } from '@/lib/auth';
import { getFavoriteGroups } from '@/lib/catalog';
import { getProfileByUsername } from '@/lib/profile';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Избранное',
  robots: { index: false, follow: false },
};

export default async function PublicFavoritesPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const [profile, session] = await Promise.all([
    getProfileByUsername(username),
    auth.api.getSession({ headers: await headers() }),
  ]);
  if (!profile) notFound();

  const favorites = await getFavoriteGroups(profile.id);
  const ownerName = profile.name.trim() && !profile.name.includes('@') ? profile.name : profile.username;

  return (
    <BrandShell headerAction={<ProfileNavigation active="favorites" />} surfaceClassName="profile-surface">
      <ProfileFavorites groups={favorites} ownerName={ownerName} isOwn={session?.user.id === profile.id} />
    </BrandShell>
  );
}
