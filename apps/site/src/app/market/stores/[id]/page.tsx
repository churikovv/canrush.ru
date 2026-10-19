import '@/styles/shared.css';
import '@/styles/market.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { ProfileBackButton } from '@/components/profile-back-button';
import { StoreDetail } from '@/components/store-card';
import { StoreMap } from '@/components/store-map';
import { auth } from '@/lib/auth';
import { getVisibleStore } from '@/lib/stores';
import { withCatalogLinks } from '@/lib/store-catalog';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{id:string}>}):Promise<Metadata>{
 const store=await getVisibleStore((await params).id,null);
 return store?{title:`${store.name} — магазин энергетиков`,description:`${store.address}. Энергетики и цены от участников Canrush.`}:{title:'Магазин',robots:{index:false,follow:false}};
}
export default async function StorePage({params}:{params:Promise<{id:string}>}){
 const session=await auth.api.getSession({headers:await headers()});
 const row=await getVisibleStore((await params).id,session?.user.id??null);if(!row)notFound();
 const own=row.ownerId===session?.user.id;
 const [store]=await withCatalogLinks([{...row,ownerId:own?row.ownerId:'',moderationNote:own?row.moderationNote:'',reviewedAt:null,reviewedBy:undefined}]);
 const apiKey=process.env.YANDEX_MAPS_API_KEY??'';
 return <BrandShell headerAction={<ProfileNavigation active="stores"/>}><div className="market-layout store-detail"><ProfileBackButton href={own?'/market/stores?mine=1':'/market/stores'} label={own?'Мои магазины':'Магазины'}/>
  <StoreDetail store={store!} own={own} apiKey={apiKey} map={store!.latitude!==null&&store!.longitude!==null&&<StoreMap apiKey={apiKey} center={[store!.latitude,store!.longitude]} points={[{id:store!.id,latitude:store!.latitude,longitude:store!.longitude,label:''}]}/>}/>
 </div></BrandShell>;
}
