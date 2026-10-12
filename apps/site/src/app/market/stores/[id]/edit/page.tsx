import { headers } from 'next/headers';
import { redirect,notFound } from 'next/navigation';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { ProfileBackButton } from '@/components/profile-back-button';
import { StoreForm } from '@/components/store-form';
import { auth } from '@/lib/auth';
import { getStore } from '@/lib/stores';
export const metadata={title:'Редактировать магазин',robots:{index:false,follow:false}};
export default async function EditStorePage({params}:{params:Promise<{id:string}>}){
 const session=await auth.api.getSession({headers:await headers()});if(!session)redirect('/sign-in');
 const store=await getStore((await params).id);if(!store||store.ownerId!==session.user.id)notFound();
 return <BrandShell headerAction={<ProfileNavigation active="market"/>}><div className="market-layout"><ProfileBackButton href="/market/stores?mine=1" label="Мои магазины"/><header className="store-editor-heading"><h1>Редактировать магазин</h1></header><StoreForm initial={store} cityId={store.city} apiKey={process.env.YANDEX_MAPS_API_KEY??''}/></div></BrandShell>;
}
