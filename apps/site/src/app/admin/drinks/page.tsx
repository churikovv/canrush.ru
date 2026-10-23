import '@/styles/shared.css';
import '@/styles/admin.css';
import Image from 'next/image';
import { AdminShell } from '@/components/admin-shell';
import { BrandShell } from '@/components/brand-shell';
import { CatalogDrinkAdminDelete, CatalogDrinkAdminEdit } from '@/components/catalog-drink-admin';
import { CatalogDrinkModeration } from '@/components/catalog-drink-moderation';
import Link from '@/components/navigation-progress';
import { requireSiteAdmin } from '@/lib/admin';
import { volumeLabel } from '@/lib/catalog-drink-fields';
import { listCatalogDrinks, type CatalogDrinkStatus } from '@/lib/catalog-drinks';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Напитки участников', robots: { index: false, follow: false } };
const submitted = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Moscow' });
const TABS: { key: CatalogDrinkStatus; label: string; title: string; subtitle: string; empty: [string, string] }[] = [
  { key: 'pending', label: 'На проверке', title: 'Напитки на проверке', subtitle: 'Сверьте бренд и вкус с фото банки: так напиток появится в каталоге и к нему привяжутся отзывы.', empty: ['Все заявки проверены', 'Новые напитки появятся здесь после отправки.'] },
  { key: 'published', label: 'Добавленные', title: 'Добавленные напитки', subtitle: 'Опубликованные напитки участников: поправьте фото, название, объёмы и состав или уберите напиток из каталога.', empty: ['Пока ничего не добавлено', 'Здесь появятся напитки после публикации.'] },
  { key: 'rejected', label: 'Отклонённые', title: 'Отклонённые заявки', subtitle: 'Заявки, которые вернули автору. Их можно поправить и удалить.', empty: ['Отклонённых заявок нет', 'Здесь появятся заявки, возвращённые на исправление.'] },
];

export default async function AdminDrinksPage({ searchParams }: { searchParams: Promise<{ page?: string; tab?: string; q?: string }> }) {
  const admin = await requireSiteAdmin();
  const params = await searchParams;
  const tab = TABS.find(item => item.key === params.tab) ?? TABS[0]!;
  const query = (params.q ?? '').trim().slice(0, 80);
  const page = Math.min(10000, Math.max(1, parseInt(params.page ?? '1', 10) || 1));
  const { items, hasMore } = await listCatalogDrinks(tab.key, page, 20, query);
  const href = (next: { tab?: CatalogDrinkStatus; page?: number; q?: string }) => {
    const search = new URLSearchParams();
    const nextTab = next.tab ?? tab.key;
    if (nextTab !== 'pending') search.set('tab', nextTab);
    const q = next.q ?? query;
    if (q) search.set('q', q);
    if ((next.page ?? 1) > 1) search.set('page', String(next.page));
    return `/admin/drinks${search.size ? `?${search}` : ''}`;
  };
  return <BrandShell headerAction={<Link className="admin-back-link" href="/profile/settings">Вернуться в настройки</Link>} surfaceClassName="admin-surface">
    <AdminShell active="drinks" email={admin.email} title={tab.title} subtitle={tab.subtitle}>
      <div className="admin-drink-toolbar">
        <nav className="market-filters" aria-label="Напитки участников">{TABS.map(item => <Link key={item.key} href={href({ tab: item.key, q: '' })} aria-current={item.key === tab.key ? 'page' : undefined}>{item.label}</Link>)}</nav>
        <form className="admin-drink-search" action="/admin/drinks" role="search">
          {tab.key !== 'pending' && <input type="hidden" name="tab" value={tab.key} />}
          <label className="sr-only" htmlFor="admin-drink-query">Бренд, вкус или название</label>
          <input id="admin-drink-query" type="search" name="q" defaultValue={query} maxLength={80} placeholder="Бренд, вкус или название" />
          <button className="community-button community-button-secondary" type="submit">Найти</button>
        </form>
      </div>
      {items.length ? <div className="admin-store-queue">{items.map(drink => <section key={drink.id} className="admin-data-panel store-review admin-drink-review">
        <div className="admin-drink">
          <a className="admin-drink-cover" href={drink.photo} target="_blank" rel="noreferrer"><Image src={drink.photo} width={160} height={200} unoptimized alt={`Фото: ${drink.brand} ${drink.name}`} /></a>
          <dl>
            <div><dt>Бренд</dt><dd>{drink.brand}</dd></div>
            <div><dt>Вкус</dt><dd>{drink.status === 'published' ? <Link href={drink.href}>{drink.name}</Link> : drink.name}{drink.flavor !== drink.name && <code>{drink.flavor}</code>}</dd></div>
            {drink.fullName && <div><dt>Название</dt><dd>{drink.fullName}</dd></div>}
            <div><dt>Объём</dt><dd>{drink.volumes.map(volumeLabel).join(' · ')}</dd></div>
            <div><dt>Состав</dt><dd>{drink.ingredients || '—'}</dd></div>
            <div><dt>Автор</dt><dd>{drink.author.username ? <Link href={`/profile/${drink.author.username}`}>@{drink.author.username}</Link> : drink.author.name} · {submitted.format(drink.createdAt)}</dd></div>
            {drink.status === 'rejected' && drink.moderationNote && <div><dt>Причина</dt><dd>{drink.moderationNote}</dd></div>}
          </dl>
        </div>
        {drink.status === 'pending' && <CatalogDrinkModeration id={drink.id} version={drink.updatedAt.toISOString()} />}
        <div className="admin-drink-manage">
          <CatalogDrinkAdminEdit key={drink.updatedAt.toISOString()} drink={{ id: drink.id, brand: drink.brand, flavor: drink.flavor, fullName: drink.fullName, volumes: drink.volumes, ingredients: drink.ingredients, status: drink.status, photo: drink.photo, version: drink.updatedAt.toISOString() }} />
          <CatalogDrinkAdminDelete id={drink.id} label={`${drink.brand} · ${drink.name}`} published={drink.status === 'published'} />
        </div>
      </section>)}</div>
        : <div className="admin-data-panel"><div className="admin-empty-result"><strong>{query ? 'Ничего не нашлось' : tab.empty[0]}</strong><span>{query ? 'Попробуйте другой бренд или вкус.' : tab.empty[1]}</span></div></div>}
      {(page > 1 || hasMore) && <nav className="admin-table-pagination" aria-label="Страницы напитков"><span>Страница {page}</span><div>{page > 1 && <Link href={href({ page: page - 1 })}>← Назад</Link>}{hasMore && <Link href={href({ page: page + 1 })}>Далее →</Link>}</div></nav>}
    </AdminShell>
  </BrandShell>;
}
