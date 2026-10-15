import '@/styles/shared.css';
import '@/styles/market.css';
import { loadAllCatalogGroups } from '@/lib/catalog';
import type { Metadata } from 'next';
import { ProfileBackButton } from '@/components/profile-back-button';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { MarketListingForm } from '@/components/market-listing-form';
import { auth } from '@/lib/auth';
import { isUserBlocked } from '@/lib/moderation';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Создать объявление', robots: { index: false, follow: false } };
export default async function NewListingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in');
  const brands = [...new Set((await loadAllCatalogGroups()).map(group=>group.brand).filter(brand=>brand && brand.toLowerCase()!=='unknown'))].sort((a,b)=>a.localeCompare(b,'ru'));
  const blocked = await isUserBlocked(session.user.id);
  return <BrandShell headerAction={<ProfileNavigation active="market" />}><div className="market-layout market-editor-layout">
    <ProfileBackButton href="/market" label="Маркет" /><header className="store-editor-heading"><h1>Новое объявление</h1><p>Заполните четыре шага — объявление сразу появится в маркете.</p></header>
    {blocked ? <p role="alert">Публикация объявлений для этого аккаунта ограничена.</p> : <MarketListingForm brands={brands} />}
  </div></BrandShell>;
}
