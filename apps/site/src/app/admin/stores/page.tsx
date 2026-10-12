import { BrandShell } from '@/components/brand-shell';
import Link from '@/components/navigation-progress';
import { StoreCard } from '@/components/store-card';
import { StoreModeration } from '@/components/store-moderation';
import { requireSiteAdmin } from '@/lib/admin';
import { listStores } from '@/lib/stores';
export const dynamic='force-dynamic';
export const metadata={title:'Модерация магазинов',robots:{index:false,follow:false}};
export default async function AdminStoresPage({searchParams}:{searchParams:Promise<{page?:string}>}){
 await requireSiteAdmin();const params=await searchParams;const page=Math.min(10000,Math.max(1,parseInt(params.page??'1',10)||1));
 const {items,hasMore}=await listStores('','',page,undefined,true);
 return <BrandShell headerAction={<Link href="/admin">Вернуться в админку</Link>}><div className="market-layout"><h1>Магазины на проверке</h1><p>Проверьте адрес и точку в картах, описание и прайс перед публикацией.</p>{items.length?items.map(store=><section key={store.id} className="store-review"><StoreCard store={store}/><StoreModeration id={store.id} version={store.updatedAt.toISOString()}/></section>):<section className="market-empty"><h2>Все заявки проверены</h2></section>}<nav className="market-pagination">{page>1&&<Link href={`/admin/stores?page=${page-1}`}>Назад</Link>}{hasMore&&<Link href={`/admin/stores?page=${page+1}`}>Далее</Link>}</nav></div></BrandShell>;
}
