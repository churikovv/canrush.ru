import '@/styles/shared.css';
import '@/styles/market.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from '@/components/navigation-progress';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { StoreDirectory } from '@/components/store-directory';
import { StoreTabs } from '@/components/section-tabs';
import Image from 'next/image';
import { auth } from '@/lib/auth';
import { listStores } from '@/lib/stores';
import { withCatalogLinks } from '@/lib/store-catalog';
import { selectedCity } from '@/lib/location';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Магазины энергетиков',description:'Адреса магазинов энергетиков на карте и списком. Станции метро, напитки и цены от участников Canrush.'};
export default async function StoresPage({searchParams}:{searchParams:Promise<{q?:string;page?:string;mine?:string}>}){
 const [params,session,defaultCity]=await Promise.all([searchParams,auth.api.getSession({headers:await headers()}),selectedCity()]);
 const mine=params.mine==='1'&&!!session;const city=defaultCity;const q=typeof params.q==='string'?params.q.trim().slice(0,100):'';const page=Math.min(10000,Math.max(1,parseInt(params.page??'1',10)||1));
 const {items:rows,hasMore}=await listStores(city.id,q,page,mine?session!.user.id:undefined);
 const items=await withCatalogLinks(rows.map(s=>({id:s.id,photos:s.photos,ownerId:mine?s.ownerId:'',name:s.name,city:s.city,address:s.address,latitude:s.latitude,longitude:s.longitude,locationSource:s.locationSource,metro:s.metro,description:s.description,catalog:s.catalog,status:s.status,moderationNote:mine?s.moderationNote:'',updatedAt:s.updatedAt,reviewedAt:null})));
 const href=(n:number)=>`/market/stores?${new URLSearchParams({q,page:String(n),...(mine?{mine:'1'}:{})})}`;
 return <BrandShell headerAction={<ProfileNavigation active="stores"/>}><div className="market-layout"><header className="market-heading"><div><h1>Магазины</h1><p>Места, где участники находят энергетики</p></div><Link className="community-button" href="/market/stores/new">Добавить магазин</Link></header>
 <StoreTabs active={mine?'mine':'stores'} signedIn={Boolean(session)}/>
 <form className="market-search-form" action="/market/stores">
 <div className="catalog-search-field"><button className="market-search-submit" type="submit" aria-label="Найти магазины"><Image src="/brand/icons/catalog-search.svg" width={24} height={24} alt="" /></button><input name="q" type="search" aria-label="Поиск магазинов" maxLength={100} defaultValue={q} placeholder="Название, адрес или напиток"/></div>
 {mine&&<input type="hidden" name="mine" value="1"/>}</form>
 {items.length?<StoreDirectory key={`${city.id}:${q}:${page}:${mine}`} stores={items} center={[city.lat,city.lng]} own={mine} apiKey={process.env.YANDEX_MAPS_API_KEY??''}/>:<section className="market-empty"><h2>{q?'Магазины не найдены':'Здесь пока нет магазинов'}</h2><p>{mine?'Ваши заявки в выбранном городе появятся здесь.':'Добавьте знакомый магазин — после проверки он появится на карте.'}</p><div className="market-empty-actions"><Link className="community-button" href={`/market/stores/new?city=${city.id}`}>Добавить магазин</Link></div></section>}
 <nav className="market-pagination" aria-label="Страницы магазинов">{page>1&&<Link href={href(page-1)}>Назад</Link>}{hasMore&&<Link href={href(page+1)}>Следующая страница</Link>}</nav></div></BrandShell>;
}
