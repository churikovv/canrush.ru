import { BrandShell } from '@/components/brand-shell';
import Link from '@/components/navigation-progress';
import { StoreCard } from '@/components/store-card';
import { StoreModeration } from '@/components/store-moderation';
import { AdminShell } from '@/components/admin-shell';
import { requireSiteAdmin } from '@/lib/admin';
import { listStores } from '@/lib/stores';
export const dynamic='force-dynamic';
export const metadata={title:'Модерация магазинов',robots:{index:false,follow:false}};
export default async function AdminStoresPage({searchParams}:{searchParams:Promise<{page?:string}>}){
 const admin=await requireSiteAdmin();const params=await searchParams;const page=Math.min(10000,Math.max(1,parseInt(params.page??'1',10)||1));
 const {items,hasMore}=await listStores('','',page,undefined,true);
 return <BrandShell headerAction={<Link className="admin-back-link" href="/profile">Вернуться в профиль</Link>} surfaceClassName="admin-surface"><AdminShell active="stores" email={admin.email} title="Магазины на проверке" subtitle="Проверьте адрес и точку в картах, описание и прайс перед публикацией.">{items.length?<div className="admin-store-queue">{items.map(store=><section key={store.id} className="admin-data-panel store-review"><StoreCard store={store}/><StoreModeration id={store.id} version={store.updatedAt.toISOString()}/></section>)}</div>:<div className="admin-data-panel"><div className="admin-empty-result"><strong>Все заявки проверены</strong><span>Новые магазины появятся здесь после отправки.</span></div></div>}{(page>1||hasMore)&&<nav className="admin-table-pagination" aria-label="Страницы заявок"><span>Страница {page}</span><div>{page>1&&<Link href={`/admin/stores?page=${page-1}`}>← Назад</Link>}{hasMore&&<Link href={`/admin/stores?page=${page+1}`}>Далее →</Link>}</div></nav>}</AdminShell></BrandShell>;
}
