import '@/styles/shared.css';
import '@/styles/market.css';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { ProfileBackButton } from '@/components/profile-back-button';
import { StoreForm } from '@/components/store-form';
import { auth } from '@/lib/auth';
import { storeDrinkOptions } from '@/lib/store-catalog';
import { selectedCity } from '@/lib/location';
import { findCity } from '@canrush/shared';
export const metadata={title:'Добавить магазин',robots:{index:false,follow:false}};
export default async function NewStorePage({searchParams}:{searchParams:Promise<{city?:string}>}){
 if(!await auth.api.getSession({headers:await headers()}))redirect('/sign-in');
 const params=await searchParams;const city=findCity(params.city)??await selectedCity();
 return <BrandShell headerAction={<ProfileNavigation active="prices"/>}><div className="market-layout"><ProfileBackButton href="/market/stores" label="Магазины"/><header className="store-editor-heading"><h1>Добавить магазин</h1><p>Укажите адрес — точку на карте и ближайшее метро подберём автоматически. Мы проверим заявку перед публикацией.</p></header><StoreForm cityId={city.id} apiKey={process.env.YANDEX_MAPS_API_KEY??''} drinks={await storeDrinkOptions()}/></div></BrandShell>;
}
