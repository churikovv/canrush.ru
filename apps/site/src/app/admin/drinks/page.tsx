import '@/styles/shared.css';
import '@/styles/admin.css';
import Image from 'next/image';
import { AdminShell } from '@/components/admin-shell';
import { BrandShell } from '@/components/brand-shell';
import { CatalogDrinkModeration } from '@/components/catalog-drink-moderation';
import Link from '@/components/navigation-progress';
import { requireSiteAdmin } from '@/lib/admin';
import { volumeLabel } from '@/lib/catalog-drink-fields';
import { listPendingCatalogDrinks } from '@/lib/catalog-drinks';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Модерация напитков', robots: { index: false, follow: false } };
const submitted = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Moscow' });

export default async function AdminDrinksPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const admin = await requireSiteAdmin();
  const page = Math.min(10000, Math.max(1, parseInt((await searchParams).page ?? '1', 10) || 1));
  const { items, hasMore } = await listPendingCatalogDrinks(page);
  return <BrandShell headerAction={<Link className="admin-back-link" href="/profile">Вернуться в профиль</Link>} surfaceClassName="admin-surface">
    <AdminShell active="drinks" email={admin.email} title="Напитки на проверке" subtitle="Сверьте бренд и вкус с фото банки: так напиток появится в каталоге и к нему привяжутся отзывы.">
      {items.length ? <div className="admin-store-queue">{items.map(drink => <section key={drink.id} className="admin-data-panel store-review admin-drink-review">
        <div className="admin-drink">
          <a className="admin-drink-cover" href={drink.photo} target="_blank" rel="noreferrer"><Image src={drink.photo} width={160} height={200} unoptimized alt={`Фото: ${drink.brand} ${drink.name}`} /></a>
          <dl>
            <div><dt>Бренд</dt><dd>{drink.brand}</dd></div>
            <div><dt>Вкус</dt><dd>{drink.name}{drink.flavor !== drink.name && <code>{drink.flavor}</code>}</dd></div>
            <div><dt>Объём</dt><dd>{drink.volumes.map(volumeLabel).join(' · ')}</dd></div>
            <div><dt>Состав</dt><dd>{drink.ingredients || '—'}</dd></div>
            <div><dt>Автор</dt><dd>{drink.author.username ? <Link href={`/profile/${drink.author.username}`}>@{drink.author.username}</Link> : drink.author.name} · {submitted.format(drink.createdAt)}</dd></div>
          </dl>
        </div>
        <CatalogDrinkModeration id={drink.id} version={drink.updatedAt.toISOString()} />
      </section>)}</div>
        : <div className="admin-data-panel"><div className="admin-empty-result"><strong>Все заявки проверены</strong><span>Новые напитки появятся здесь после отправки.</span></div></div>}
      {(page > 1 || hasMore) && <nav className="admin-table-pagination" aria-label="Страницы заявок"><span>Страница {page}</span><div>{page > 1 && <Link href={`/admin/drinks?page=${page - 1}`}>← Назад</Link>}{hasMore && <Link href={`/admin/drinks?page=${page + 1}`}>Далее →</Link>}</div></nav>}
    </AdminShell>
  </BrandShell>;
}
