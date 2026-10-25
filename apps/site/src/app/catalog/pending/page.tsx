import '@/styles/shared.css';
import '@/styles/market.css';
import '@/styles/catalog.css';
import type { Metadata } from 'next';
import { BrandShell } from '@/components/brand-shell';
import Link from '@/components/navigation-progress';
import { ProfileBackButton } from '@/components/profile-back-button';
import { ProfileNavigation } from '@/components/profile-navigation';
import { volumeLabel } from '@/lib/catalog-drink-fields';
import { listPendingCatalogDrinksPublic } from '@/lib/catalog-drinks';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Напитки на модерации', robots: { index: false, follow: false } };

const sent = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Moscow' });
const drinksWord = (count: number) => count % 10 === 1 && count % 100 !== 11 ? 'напиток' : [2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100) ? 'напитка' : 'напитков';

/**
 * «На модерации»: drinks members have sent and a moderator has not checked yet, open to everyone with a search, so a
 * drink already on its way is not sent twice. The photos stay private until moderation, as on the request itself.
 */
export default async function PendingCatalogDrinksPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const params = await searchParams;
  const query = (params.q ?? '').trim().slice(0, 80);
  const page = Math.min(1000, Math.max(1, parseInt(params.page ?? '1', 10) || 1));
  const { items, total, hasMore } = await listPendingCatalogDrinksPublic(query, page);
  const pageHref = (next: number) => `/catalog/pending?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(next > 1 ? { page: String(next) } : {}) })}`;
  return <BrandShell headerAction={<ProfileNavigation active="catalog" />}>
    <div className="market-layout catalog-drink-layout catalog-pending">
      <ProfileBackButton href="/catalog" label="Каталог" />
      <header className="store-editor-heading">
        <h1>На модерации</h1>
        <p>Напитки, которые участники уже отправили и которые ждут проверки. Если ваш здесь — подождите: после проверки он появится в каталоге. Фото покажем после модерации.</p>
      </header>
      <form className="catalog-pending-search" action="/catalog/pending" role="search">
        <label className="sr-only" htmlFor="catalog-pending-query">Бренд, вкус или название</label>
        <input id="catalog-pending-query" type="search" name="q" defaultValue={query} maxLength={80} placeholder="Искать бренд, вкус или название" />
        <button className="community-button community-button-secondary" type="submit">Найти</button>
      </form>
      <p className="catalog-pending-count" aria-live="polite">{query ? `Найдено: ${total}` : total ? `На проверке ${total} ${drinksWord(total)}` : ''}</p>
      {items.length ? <ul className="catalog-pending-list">{items.map(drink => <li key={drink.id}>
        <span className="catalog-pending-can" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3h8l1 3v13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6l1-3Z" /><path d="M7 7h10M12 11v4l2 1" /></svg>
        </span>
        <div>
          <small>{drink.brand}</small>
          <strong>{drink.name}</strong>
          {drink.fullName && <span className="catalog-pending-full">{drink.fullName}</span>}
          <span className="catalog-pending-meta">{drink.volumes.map(volumeLabel).join(' · ')} · отправлен {sent.format(drink.createdAt)}{drink.author && <> · <Link href={`/profile/${drink.author}`}>@{drink.author}</Link></>}</span>
        </div>
      </li>)}</ul>
        : <div className="catalog-pending-empty"><strong>{query ? 'Ничего не нашлось' : 'Сейчас всё проверено'}</strong><span>{query ? 'Такого напитка нет среди заявок. Если его нет и в каталоге — добавьте.' : 'Новые заявки появятся здесь, пока их не проверит модератор.'}</span><Link className="community-button" href="/catalog/new">Добавить напиток</Link></div>}
      {(page > 1 || hasMore) && <nav className="catalog-pending-pages" aria-label="Страницы заявок">{page > 1 && <Link href={pageHref(page - 1)}>← Назад</Link>}<span>Страница {page}</span>{hasMore && <Link href={pageHref(page + 1)}>Далее →</Link>}</nav>}
    </div>
  </BrandShell>;
}
