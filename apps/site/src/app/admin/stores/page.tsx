import '@/styles/shared.css';
import '@/styles/tierlists.css';
import '@/styles/business-cabinet.css';
import '@/styles/admin.css';
import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { StoreCard } from '@/components/store-card';
import { StoreModeration } from '@/components/store-moderation';
import { StoreTransferBanner } from '@/components/store-transfer-banner';
import { AdminShell } from '@/components/admin-shell';
import { requireSiteAdmin } from '@/lib/admin';
import { listStoresForAdmin, type StoreAuthor, type StoreStatus } from '@/lib/stores';
import { withCatalogLinks } from '@/lib/store-catalog';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Модерация магазинов', robots: { index: false, follow: false } };

const TABS: { key: StoreStatus; label: string; title: string; subtitle: string; empty: [string, string] }[] = [
  { key: 'pending', label: 'На проверке', title: 'Магазины на проверке', subtitle: 'Проверьте адрес и точку в картах, описание и прайс перед публикацией.', empty: ['Все заявки проверены', 'Новые магазины появятся здесь после отправки.'] },
  { key: 'published', label: 'Добавленные', title: 'Добавленные магазины', subtitle: 'Опубликованные магазины: правка из админки не отправляет их на повторную проверку.', empty: ['Магазинов пока нет', 'Они появятся после первой модерации.'] },
  { key: 'rejected', label: 'Отклонённые', title: 'Отклонённые магазины', subtitle: 'Заявки, которые не прошли проверку, с причиной отказа.', empty: ['Отклонённых нет', 'Здесь появятся заявки с причиной отказа.'] },
];
const submitted = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Moscow' });

/** Who sent the store: avatar and nick, linking to the profile. */
function Author({ author, at }: { author: StoreAuthor; at: Date }) {
  const avatar = author.avatarId ? <Image src={`/api/profile-images/${author.avatarId}`} width={32} height={32} unoptimized alt="" /> : <span aria-hidden="true">{(author.username ?? author.name ?? '?').slice(0, 1).toUpperCase()}</span>;
  return <p className="admin-store-author"><span className="admin-store-author-avatar">{avatar}</span><span>Отправил {author.username ? <Link href={`/profile/${author.username}`}>@{author.username}</Link> : <strong>{author.name}</strong>} · {submitted.format(at)}</span></p>;
}

export default async function AdminStoresPage({ searchParams }: { searchParams: Promise<{ page?: string; tab?: string; q?: string }> }) {
  const admin = await requireSiteAdmin();
  const params = await searchParams;
  const tab = TABS.find(item => item.key === params.tab) ?? TABS[0]!;
  const query = (params.q ?? '').trim().slice(0, 80);
  const page = Math.min(10000, Math.max(1, parseInt(params.page ?? '1', 10) || 1));
  const { items: rows, hasMore } = await listStoresForAdmin(tab.key, page, query);
  const linked = await withCatalogLinks(rows);
  const items = rows.map((row, index) => ({ ...linked[index]!, author: row.author }));
  const href = (next: { tab?: StoreStatus; page?: number; q?: string }) => {
    const search = new URLSearchParams();
    const nextTab = next.tab ?? tab.key;
    if (nextTab !== 'pending') search.set('tab', nextTab);
    const q = next.q ?? query;
    if (q) search.set('q', q);
    if ((next.page ?? 1) > 1) search.set('page', String(next.page));
    return `/admin/stores${search.size ? `?${search}` : ''}`;
  };
  return <AdminShell active="stores" email={admin.email} role={admin.role} title={tab.title} subtitle={tab.subtitle}>
      {admin.role === 'admin' && <StoreTransferBanner />}
      <div className="admin-drink-toolbar">
        <nav className="market-filters" aria-label="Магазины">{TABS.map(item => <Link key={item.key} href={href({ tab: item.key, q: '' })} aria-current={item.key === tab.key ? 'page' : undefined}>{item.label}</Link>)}</nav>
        <form className="admin-drink-search" action="/admin/stores" role="search">
          {tab.key !== 'pending' && <input type="hidden" name="tab" value={tab.key} />}
          <label className="sr-only" htmlFor="admin-store-query">Название, адрес или автор</label>
          <input id="admin-store-query" type="search" name="q" defaultValue={query} maxLength={80} placeholder="Название, адрес или автор" />
          <button className="community-button community-button-secondary" type="submit">Найти</button>
        </form>
      </div>
      {items.length ? <div className="admin-store-queue">{items.map(store => <section key={store.id} className="admin-data-panel store-review">
        <div className="admin-store-head"><Author author={store.author} at={store.updatedAt} /><Link className="community-button community-button-secondary admin-store-edit" href={`/market/stores/${store.id}/edit`}>Редактировать</Link></div>
        <StoreCard store={store} />
        {store.status === 'rejected' && store.moderationNote && <p className="admin-drink-card-note">Причина: {store.moderationNote}</p>}
        {store.status === 'pending' && <StoreModeration id={store.id} version={store.updatedAt.toISOString()} />}
      </section>)}</div>
        : <div className="admin-data-panel"><div className="admin-empty-result"><strong>{query ? 'Ничего не нашлось' : tab.empty[0]}</strong><span>{query ? 'Попробуйте другое название, адрес или ник.' : tab.empty[1]}</span></div></div>}
      {(page > 1 || hasMore) && <nav className="admin-table-pagination" aria-label="Страницы магазинов"><span>Страница {page}</span><div>{page > 1 && <Link href={href({ page: page - 1 })}>← Назад</Link>}{hasMore && <Link href={href({ page: page + 1 })}>Далее →</Link>}</div></nav>}
    </AdminShell>
}
