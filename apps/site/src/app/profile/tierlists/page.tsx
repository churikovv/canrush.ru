import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { ProfileTierLists } from '@/components/profile-tier-lists';
import { auth } from '@/lib/auth';
import { loadAllCatalogGroups } from '@/lib/catalog';
import { ensureOwnProfile } from '@/lib/profile';
import { getTierListsForOwner, tierListProductsForPlacements } from '@/lib/tier-lists';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Мои тирлисты',
  robots: { index: false, follow: false },
};

export default async function OwnTierListsPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in');

  const [profile, query] = await Promise.all([ensureOwnProfile(session.user), searchParams]);
  const [lists, groups] = await Promise.all([getTierListsForOwner(profile.id), loadAllCatalogGroups()]);
  const products = tierListProductsForPlacements(groups, lists.flatMap((list) => list.preview));
  const ownerName = profile.name.trim() && !profile.name.includes('@') ? profile.name : profile.username;

  return (
    <BrandShell headerAction={<ProfileNavigation active="profile" />} surfaceClassName="profile-surface">
      <ProfileTierLists
        lists={lists}
        products={products}
        ownerName={ownerName}
        isOwn
        notice={query.deleted === '1' ? 'Тирлист удалён.' : undefined}
      />
    </BrandShell>
  );
}
