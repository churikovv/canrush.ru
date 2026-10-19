import '@/styles/shared.css';
import '@/styles/market.css';
import type { Metadata } from 'next';
import Link from '@/components/navigation-progress';
import { headers } from 'next/headers';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { MarketTabs } from '@/components/section-tabs';
import { MarketBrowser, type MarketSearchParams } from '@/components/market-browser';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Маркет энергетиков', description: 'Энергетики от участников CanRush. Объявления, доставка и общение с продавцами.' };
export default async function MarketPage({ searchParams }: { searchParams: Promise<MarketSearchParams> }) {
  const query = await searchParams;
  const session = await auth.api.getSession({ headers: await headers() });
  const seller = typeof query.seller === 'string' ? query.seller.trim().slice(0, 64) : '';
  const mine = !seller && query.mine === '1' && Boolean(session);
  return <BrandShell headerAction={<ProfileNavigation active="market" />}><div className="market-layout">
    <header className="market-heading"><div><h1>{seller ? `Объявления @${seller}` : 'Маркет'}</h1>{seller ? <p><Link href={`/profile/${encodeURIComponent(seller)}`}>Вернуться в профиль</Link></p> : <p>Энергетики от участников CanRush</p>}</div><Link className="community-button" href="/market/new">Создать объявление</Link></header>
    <MarketTabs active={seller ? undefined : mine ? 'mine' : 'all'} signedIn={Boolean(session)} />
    <MarketBrowser query={query} viewerId={session?.user.id ?? null} />
  </div></BrandShell>;
}
