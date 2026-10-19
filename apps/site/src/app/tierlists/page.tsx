import '@/styles/shared.css';
import '@/styles/tierlists.css';
import type { Metadata } from 'next';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { TierListsBrowser, type TierListSearchParams } from '@/components/tier-lists-browser';
import { seoMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = seoMetadata({
  title: 'Тирлисты энергетиков',
  description: 'Рейтинг энергетических напитков CanRush по оценкам покупателей и пользовательские тирлисты, которыми можно поделиться.',
  path: '/tierlists',
});

export default async function TierListsPage({ searchParams }: { searchParams: Promise<TierListSearchParams> }) {
  return (
    <BrandShell headerAction={<ProfileNavigation active="tierlists" />} surfaceClassName="tierlists-surface">
      <TierListsBrowser params={await searchParams} />
    </BrandShell>
  );
}
