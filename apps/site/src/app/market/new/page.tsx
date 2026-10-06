import type { Metadata } from 'next';
import Link from 'next/link';
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
  const blocked = await isUserBlocked(session.user.id);
  return <BrandShell headerAction={<ProfileNavigation active="market" />}><div className="market-layout market-editor-layout">
    <Link className="market-back" href="/market">← Маркет</Link><header className="market-heading"><h1>Новое объявление</h1></header>
    {blocked ? <p role="alert">Публикация объявлений для этого аккаунта ограничена.</p> : <MarketListingForm />}
  </div></BrandShell>;
}
