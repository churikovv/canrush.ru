import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { BrandShell } from '@/components/brand-shell';
import { ProfileEditForm } from '@/components/profile-edit-form';
import { ProfileNavigation } from '@/components/profile-navigation';
import { ProfileHero } from '@/components/profile-view';
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

  return (
    <BrandShell headerAction={<ProfileNavigation active="profile" />} surfaceClassName="profile-surface">
      <div className="profile-layout profile-edit-layout ym-hide-content">
        <ProfileHero profile={profile} />
        <ProfileEditForm profile={profile} />
      </div>
    </BrandShell>
  );
}
