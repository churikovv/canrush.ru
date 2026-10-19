import '@/styles/shared.css';
import '@/styles/admin.css';
import { BrandShell } from '@/components/brand-shell';
import Link from '@/components/navigation-progress';
import { StoreCard } from '@/components/store-card';
import { StoreModeration } from '@/components/store-moderation';
import { StoreTransferForm } from '@/components/store-transfer-form';
import { AdminShell } from '@/components/admin-shell';
import { requireSiteAdmin } from '@/lib/admin';
import { listStores } from '@/lib/stores';
import { withCatalogLinks } from '@/lib/store-catalog';
export const dynamic='force-dynamic';
export const metadata={title:'Модерация магазинов',robots:{index:false,follow:false}};
export default async function AdminStoresPage({searchParams}:{searchParams:Promise<{page?:string}>}){
 const admin=await requireSiteAdmin();const params=await searchParams;const page=Math.min(10000,Math.max(1,parseInt(params.page??'1',10)||1));
 const {items:rows,hasMore}=await listStores('','',page,undefined,true);const items=await withCatalogLinks(rows);
 return <BrandShell headerAction={<Link className="admin-back-link" href="/profile">Вернуться в профиль</Link>} surfaceClassName="admin-surface"><AdminShell active="stores" email={admin.email} title="Магазины на проверке" subtitle="Проверьте адрес и точку в картах, описание и прайс перед публикацией."><section className="admin-data-panel store-transfer-panel" aria-labelledby="store-transfer-title"><div className="admin-panel-heading"><h2 id="store-transfer-title">Передать магазин</h2><span>Редактирование переходит новому владельцу</span></div><p className="store-note">Подходит для любого магазина, в том числе опубликованного. Статус и заявка не меняются, действие попадает в журнал.</p><StoreTransferForm/></section>{items.length?<div className="admin-store-queue">{items.map(store=><section key={store.id} className="admin-data-panel store-review"><StoreCard store={store}/><StoreModeration id={store.id} version={store.updatedAt.toISOString()}/></section>)}</div>:<div className="admin-data-panel"><div className="admin-empty-result"><strong>Все заявки проверены</strong><span>Новые магазины появятся здесь после отправки.</span></div></div>}{(page>1||hasMore)&&<nav className="admin-table-pagination" aria-label="Страницы заявок"><span>Страница {page}</span><div>{page>1&&<Link href={`/admin/stores?page=${page-1}`}>← Назад</Link>}{hasMore&&<Link href={`/admin/stores?page=${page+1}`}>Далее →</Link>}</div></nav>}</AdminShell></BrandShell>;
}
