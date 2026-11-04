import '@/styles/shared.css';
import '@/styles/profile.css';
import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { ProfileView } from '@/components/profile-view';
import { isSiteAdminEmail } from '@/lib/admin';
import { auth } from '@/lib/auth';
import { DUEL_COOKIE, isDuelCode } from '@/lib/battle-duel-fields';
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
  // Sign-in always lands here: a guest who opened a battle challenge first goes back to it (the duel page clears the cookie).
  const duel = (await cookies()).get(DUEL_COOKIE)?.value;
  if (isDuelCode(duel)) redirect(`/gacha/battle/duel/${duel}`);

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
        viewerIsAdmin={isAdmin}
        wallPage={profilePageNumber((await searchParams).wallPage)}
        favoritesHref="/profile/favorites"
        tierListsHref="/profile/tierlists"
      />
    </BrandShell>
  );
}
