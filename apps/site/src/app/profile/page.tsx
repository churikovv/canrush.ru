import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { ProfileView } from '@/components/profile-view';
import { isSiteAdminEmail } from '@/lib/admin';
import { auth } from '@/lib/auth';
import { profilePageNumber } from '@/lib/profile-achievements';
import { ensureOwnProfile } from '@/lib/profile';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Профиль',
  robots: { index: false, follow: false },
};

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ wallPage?: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in');

  const [profile, isAdmin] = await Promise.all([
    ensureOwnProfile(session.user),
    isSiteAdminEmail(session.user.email),
  ]);

  return (
    <BrandShell headerAction={<ProfileNavigation active="profile" />} surfaceClassName="profile-surface">
      <ProfileView
        profile={profile}
        isOwn
        viewerId={session.user.id}
        wallPage={profilePageNumber((await searchParams).wallPage)}
        favoritesHref="/profile/favorites"
        tierListsHref="/profile/tierlists"
        adminHref={isAdmin ? '/admin' : undefined}
      />
    </BrandShell>
  );
}
