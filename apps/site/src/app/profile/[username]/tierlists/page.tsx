import '@/styles/shared.css';
import '@/styles/profile.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getTierCardViewer } from '@/lib/tier-discussions';
import { notFound } from 'next/navigation';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { ProfileTierLists } from '@/components/profile-tier-lists';
import { auth } from '@/lib/auth';
import { loadAllCatalogGroups } from '@/lib/catalog';
import { getProfileByUsername } from '@/lib/profile';
import { getPublishedTierListsForUser, tierListProductsForPlacements } from '@/lib/tier-lists';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Тирлисты пользователя',
};

export default async function PublicTierListsPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const [profile, session, groups] = await Promise.all([
    getProfileByUsername(username),
    auth.api.getSession({ headers: await headers() }),
    loadAllCatalogGroups(),
  ]);
  if (!profile) notFound();

  const lists = await getPublishedTierListsForUser(profile.id);
  const products = tierListProductsForPlacements(groups, lists.flatMap((list) => list.preview));
  const ownerName = profile.name.trim() && !profile.name.includes('@') ? profile.name : profile.username;
  const viewer = await getTierCardViewer(lists.map((list) => list.id), session?.user.id ?? null);
  return (
    <BrandShell headerAction={<ProfileNavigation active="profile" />} surfaceClassName="profile-surface">
      <ProfileTierLists profileHref={`/profile/${profile.username}`} lists={lists} products={products} ownerName={ownerName} isOwn={false} viewer={viewer} />
    </BrandShell>
  );
}
