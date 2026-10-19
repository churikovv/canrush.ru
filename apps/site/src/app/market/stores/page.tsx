import '@/styles/shared.css';
import '@/styles/market.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from '@/components/navigation-progress';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { StoreBrowser, type StoreSearchParams } from '@/components/store-browser';
import { StoreTabs } from '@/components/section-tabs';
import { auth } from '@/lib/auth';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Магазины энергетиков',description:'Адреса магазинов энергетиков на карте и списком. Станции метро, напитки и цены от участников Canrush.'};
export default async function StoresPage({searchParams}:{searchParams:Promise<StoreSearchParams>}){
 const [params,session]=await Promise.all([searchParams,auth.api.getSession({headers:await headers()})]);
 const mine=params.mine==='1'&&!!session;
 return <BrandShell headerAction={<ProfileNavigation active="stores"/>}><div className="market-layout"><header className="market-heading"><div><h1>Магазины</h1><p>Места, где участники находят энергетики</p></div><Link className="community-button" href="/market/stores/new">Добавить магазин</Link></header>
 <StoreTabs active={mine?'mine':'stores'} signedIn={Boolean(session)}/>
 <StoreBrowser params={params} ownerId={mine?session!.user.id:undefined}/></div></BrandShell>;
}
