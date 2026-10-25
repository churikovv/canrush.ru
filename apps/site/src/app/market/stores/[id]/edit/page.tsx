import '@/styles/shared.css';
import '@/styles/market.css';
import { headers } from 'next/headers';
import { redirect,notFound } from 'next/navigation';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { ProfileBackButton } from '@/components/profile-back-button';
import { StoreForm } from '@/components/store-form';
import { auth } from '@/lib/auth';
import { storeDrinkOptions } from '@/lib/store-catalog';
import { hasStoreGeocoder } from '@/lib/store-geocoder';
import { getStore } from '@/lib/stores';
import { isSiteStaffEmail } from '@/lib/admin';
export const metadata={title:'Редактировать магазин',robots:{index:false,follow:false}};
export default async function EditStorePage({params}:{params:Promise<{id:string}>}){
 const session=await auth.api.getSession({headers:await headers()});if(!session)redirect('/sign-in');
 const store=await getStore((await params).id);if(!store)notFound();
 // The owner edits and sends it back for review; the team edits anyone's store from /admin/stores, status kept.
 const staff=store.ownerId!==session.user.id;if(staff&&!await isSiteStaffEmail(session.user.email))notFound();
 return <BrandShell headerAction={<ProfileNavigation active="stores"/>}><div className="market-layout"><ProfileBackButton href={staff?'/admin/stores':'/market/stores?mine=1'} label={staff?'Магазины в админке':'Мои магазины'}/><header className="store-editor-heading"><h1>Редактировать магазин</h1></header><StoreForm initial={store} cityId={store.city} apiKey={process.env.YANDEX_MAPS_API_KEY??''} drinks={await storeDrinkOptions()} geocoder={hasStoreGeocoder()}/></div></BrandShell>;
}
