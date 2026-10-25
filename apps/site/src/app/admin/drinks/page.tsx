import '@/styles/shared.css';
import '@/styles/admin.css';
import '@/styles/catalog.css';
import Image from 'next/image';
import { AdminShell } from '@/components/admin-shell';
import { BrandShell } from '@/components/brand-shell';
import { CatalogDrinkAdminMenu } from '@/components/catalog-drink-admin';
import { CatalogDrinkModeration } from '@/components/catalog-drink-moderation';
import Link from '@/components/navigation-progress';
import { requireSiteAdmin } from '@/lib/admin';
import { volumeLabel } from '@/lib/catalog-drink-fields';
import { loadAllCatalogGroups } from '@/lib/catalog';
import { BASIC_FLAVORS, catalogGroupSlug } from '@/lib/catalog-query';
import { listCatalogDrinks, type CatalogDrinkStatus } from '@/lib/catalog-drinks';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Напитки участников', robots: { index: false, follow: false } };
const submitted = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Moscow' });
const TABS: { key: CatalogDrinkStatus; label: string; title: string; subtitle: string; empty: [string, string] }[] = [
  { key: 'pending', label: 'На проверке', title: 'Напитки на проверке', subtitle: 'Сверьте бренд и вкус с фото банки: так напиток появится в каталоге и к нему привяжутся отзывы.', empty: ['Все заявки проверены', 'Новые напитки появятся здесь после отправки.'] },
  { key: 'published', label: 'Добавленные', title: 'Добавленные напитки', subtitle: 'Опубликованные напитки участников. В меню «⋯» — правка бренда, вкуса, фото, объёмов и состава или удаление из каталога.', empty: ['Пока ничего не добавлено', 'Здесь появятся напитки после публикации.'] },
  { key: 'rejected', label: 'Отклонённые', title: 'Отклонённые заявки', subtitle: 'Заявки, которые вернули автору. Их можно поправить и удалить.', empty: ['Отклонённых заявок нет', 'Здесь появятся заявки, возвращённые на исправление.'] },
];

export default async function AdminDrinksPage({ searchParams }: { searchParams: Promise<{ page?: string; tab?: string; q?: string }> }) {
  const admin = await requireSiteAdmin();
  const params = await searchParams;
  const tab = TABS.find(item => item.key === params.tab) ?? TABS[0]!;
  const query = (params.q ?? '').trim().slice(0, 80);
  const page = Math.min(10000, Math.max(1, parseInt(params.page ?? '1', 10) || 1));
  const [{ items, hasMore }, groups] = await Promise.all([listCatalogDrinks(tab.key, page, 24, query), loadAllCatalogGroups()]);
  // A request sent despite the «уже есть в каталоге» warning: the parser card or published member drink it matches, to
  // compare before publishing.
  const catalogCard = (brand: string, flavor: string) => groups.find(group => group.brand.toLowerCase() === brand.toLowerCase() && group.flavor.toLowerCase() === flavor.toLowerCase());
  // The same brand and flavour suggestions as the request form, for the edit dialog.
  const brands = [...new Set(groups.map(group => group.brand.trim()).filter(brand => brand && brand.toLowerCase() !== 'unknown'))].sort((a, b) => a.localeCompare(b, 'ru'));
  const flavors = [...BASIC_FLAVORS].sort((a, b) => a.label.localeCompare(b.label, 'ru'));
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
    <AdminShell active="drinks" email={admin.email} role={admin.role} title={tab.title} subtitle={tab.subtitle}>
      <div className="admin-drink-toolbar">
        <nav className="market-filters" aria-label="Напитки участников">{TABS.map(item => <Link key={item.key} href={href({ tab: item.key, q: '' })} aria-current={item.key === tab.key ? 'page' : undefined}>{item.label}</Link>)}</nav>
        <form className="admin-drink-search" action="/admin/drinks" role="search">
          {tab.key !== 'pending' && <input type="hidden" name="tab" value={tab.key} />}
          <label className="sr-only" htmlFor="admin-drink-query">Бренд, вкус или название</label>
          <input id="admin-drink-query" type="search" name="q" defaultValue={query} maxLength={80} placeholder="Бренд, вкус или название" />
          <button className="community-button community-button-secondary" type="submit">Найти</button>
        </form>
      </div>
      {items.length ? <ul className="admin-drink-grid">{items.map(drink => <li key={drink.id} className="admin-drink-card">
        <div className="admin-drink-card-main">
          <a className="admin-drink-card-cover" href={drink.photo} target="_blank" rel="noreferrer" aria-label="Фото банки целиком"><Image src={drink.photo} width={64} height={80} unoptimized alt="" /></a>
          <div className="admin-drink-card-text">
            <small>{drink.brand}</small>
            <strong>{drink.status === 'published' ? <Link href={drink.href}>{drink.name}</Link> : drink.name}</strong>
            {drink.fullName && <span className="admin-drink-card-full">{drink.fullName}</span>}
            <span className="admin-drink-card-meta">{drink.volumes.map(volumeLabel).join(' · ')} · {drink.author.username ? <Link href={`/profile/${drink.author.username}`}>@{drink.author.username}</Link> : drink.author.name} · {submitted.format(drink.createdAt)}</span>
            {drink.flavor !== drink.name && <code title="Ключ вкуса">{drink.flavor}</code>}
          </div>
          <CatalogDrinkAdminMenu key={drink.updatedAt.toISOString()} brands={brands} flavors={flavors} drink={{ id: drink.id, brand: drink.brand, flavor: drink.flavor, name: drink.name, fullName: drink.fullName, volumes: drink.volumes, ingredients: drink.ingredients, status: drink.status, photo: drink.photo, version: drink.updatedAt.toISOString() }} />
        </div>
        {drink.ingredients && <p className="admin-drink-card-ingredients">{drink.ingredients}</p>}
        {drink.status === 'rejected' && drink.moderationNote && <p className="admin-drink-card-note">Причина: {drink.moderationNote}</p>}
        {drink.status === 'pending' && (() => { const card = catalogCard(drink.brand, drink.flavor); return card && <p className="admin-drink-card-match">Совпадает с карточкой каталога — <Link href={`/catalog/${catalogGroupSlug(card.brand, card.flavor)}`}>сравнить</Link>. Автор отправил свою версию: смените вкус в «Редактировать» или склейте; опубликовать как есть нельзя.</p>; })()}
        {drink.status === 'pending' && <CatalogDrinkModeration id={drink.id} version={drink.updatedAt.toISOString()} />}
      </li>)}</ul>
        : <div className="admin-data-panel"><div className="admin-empty-result"><strong>{query ? 'Ничего не нашлось' : tab.empty[0]}</strong><span>{query ? 'Попробуйте другой бренд или вкус.' : tab.empty[1]}</span></div></div>}
      {(page > 1 || hasMore) && <nav className="admin-table-pagination" aria-label="Страницы напитков"><span>Страница {page}</span><div>{page > 1 && <Link href={href({ page: page - 1 })}>← Назад</Link>}{hasMore && <Link href={href({ page: page + 1 })}>Далее →</Link>}</div></nav>}
    </AdminShell>
  </BrandShell>;
}
