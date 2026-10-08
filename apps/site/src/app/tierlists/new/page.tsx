import { getReviewSummaries } from '@/lib/reviews';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { TierListEditor } from '@/components/tier-list-editor';
import { auth } from '@/lib/auth';
import { loadTierPickerGroups } from '@/lib/catalog';
import { ensureOwnProfile } from '@/lib/profile';
import { catalogGroupsToTierProducts } from '@/lib/tier-lists';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Новый тирлист',
  robots: { index: false, follow: false },
};

export default async function NewTierListPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in');
  const profile = await ensureOwnProfile(session.user);

  const groups = await loadTierPickerGroups();
  const products = catalogGroupsToTierProducts(groups, await getReviewSummaries(groups)).sort(
    (left, right) => right.retailerCount - left.retailerCount || left.brand.localeCompare(right.brand, 'ru-RU'),
  );

  return (
    <BrandShell headerAction={<ProfileNavigation active="tierlists" />} surfaceClassName="tierlists-surface">
      <div className="tier-editor-layout">
        <header className="tier-editor-heading">
          <p className="tierlists-kicker">Новый список</p>
          <h1>Создайте свой тирлист</h1>
          <p>Выберите энергетик, назначьте ему категорию и сохраните список. Опубликовать его можно сразу или позже.</p>
        </header>
        <TierListEditor products={products} telegramChannel={profile.telegramChannel} />
      </div>
    </BrandShell>
  );
}
