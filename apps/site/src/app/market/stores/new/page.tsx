import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { ProfileBackButton } from '@/components/profile-back-button';
import { StoreForm } from '@/components/store-form';
import { auth } from '@/lib/auth';
import { selectedCity } from '@/lib/location';
import { findCity } from '@canrush/shared';
export const metadata={title:'Добавить магазин',robots:{index:false,follow:false}};
export default async function NewStorePage({searchParams}:{searchParams:Promise<{city?:string}>}){
 if(!await auth.api.getSession({headers:await headers()}))redirect('/sign-in');
 const params=await searchParams;const city=findCity(params.city)??await selectedCity();
 return <BrandShell headerAction={<ProfileNavigation active="market"/>}><div className="market-layout"><ProfileBackButton href="/market/stores" label="Магазины"/><header className="store-editor-heading"><h1>Добавить магазин</h1><p>Укажите адрес и точку на карте. Мы проверим заявку перед публикацией.</p></header><StoreForm cityId={city.id} apiKey={process.env.YANDEX_MAPS_API_KEY??''}/></div></BrandShell>;
}
