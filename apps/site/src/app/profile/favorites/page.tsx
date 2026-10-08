import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { BrandShell } from '@/components/brand-shell';
import { ProfileFavorites } from '@/components/profile-favorites';
import { ProfileNavigation } from '@/components/profile-navigation';
import { auth } from '@/lib/auth';
import { getFavoriteGroups } from '@/lib/catalog';
import { ensureOwnProfile } from '@/lib/profile';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Избранное',
  robots: { index: false, follow: false },
};

export default async function ProfileFavoritesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in');

  const profile = await ensureOwnProfile(session.user);
  const favorites = await getFavoriteGroups(profile.id);
  const ownerName = profile.name.trim() && !profile.name.includes('@') ? profile.name : profile.username;

  return (
    <BrandShell headerAction={<ProfileNavigation active="favorites" />} surfaceClassName="profile-surface">
      <ProfileFavorites groups={favorites} ownerName={ownerName} ownerUsername={profile.username} isOwn />
    </BrandShell>
  );
}
