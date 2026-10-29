import '@/styles/shared.css';
import '@/styles/business-cabinet.css';
import '@/styles/admin.css';
import '@/styles/catalog.css';
import Image from 'next/image';
import { AdminShell } from '@/components/admin-shell';
import { getAdminQueues } from '@/lib/admin-queues';
import { AddToCatalogCard, CatalogDrinkAdminMenu } from '@/components/catalog-drink-admin';
import { CatalogDrinkModeration } from '@/components/catalog-drink-moderation';
import Link from '@/components/navigation-progress';
import { requireSiteAdmin } from '@/lib/admin';
import { volumeLabel } from '@/lib/catalog-drink-fields';
import { loadAllCatalogGroups } from '@/lib/catalog';
import { BASIC_FLAVORS, catalogGroupSlug, flavorName } from '@/lib/catalog-query';
import { listCatalogDrinks, type CatalogDrinkStatus } from '@/lib/catalog-drinks';
import { countSuspectedDuplicates, getDrinkChecks, type DrinkCheck } from '@/lib/drink-duplicate-check';
import { dismissDrinkCheckAction } from '@/app/catalog/new/actions';
import { CatalogCardAdminMenu } from '@/components/catalog-card-admin';
import { countCardQueue, listCatalogCards, type AdminCatalogCard, type CardCheck, type CardView } from '@/lib/catalog-card-check';
import { CardQueueActions } from '@/components/catalog-card-admin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Напитки участников', robots: { index: false, follow: false } };
const submitted = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Moscow' });
type TabKey = CatalogDrinkStatus | 'duplicates' | 'catalog';
const TABS: { key: TabKey; label: string; title: string; subtitle: string; empty: [string, string] }[] = [
  { key: 'pending', label: 'На проверке', title: 'Напитки на проверке', subtitle: 'Сверьте бренд и вкус с фото банки: так напиток появится в каталоге и к нему привяжутся отзывы.', empty: ['Все заявки проверены', 'Новые напитки появятся здесь после отправки.'] },
  { key: 'published', label: 'Добавленные', title: 'Добавленные напитки', subtitle: 'Опубликованные напитки участников. В меню «⋯» — правка бренда, вкуса, фото, объёмов и состава или удаление из каталога.', empty: ['Пока ничего не добавлено', 'Здесь появятся напитки после публикации.'] },
  { key: 'duplicates', label: 'Возможные дубли', title: 'Возможные дубли', subtitle: 'Опубликованные напитки, которые нейросеть сочла похожими на другую карточку. Сравните и склейте в меню «⋯» или отметьте «Не дубль».', empty: ['Подозрений нет', 'Нейросеть проверяет напитки постепенно — новые подозрения появятся здесь.'] },
  { key: 'catalog', label: 'Карточки каталога', title: 'Карточки каталога', subtitle: 'Напитки, которые парсер собрал из магазинов. В меню «⋯» — своё фото, полное название, склейка с другой карточкой и скрытие из каталога. Парсер эти правки не перезаписывает.', empty: ['Карточек нет', 'Здесь появятся напитки из магазинов после работы парсера.'] },
  { key: 'rejected', label: 'Отклонённые', title: 'Отклонённые заявки', subtitle: 'Заявки, которые вернули автору. Их можно поправить и удалить.', empty: ['Отклонённых заявок нет', 'Здесь появятся заявки, возвращённые на исправление.'] },
];

export default async function AdminDrinksPage({ searchParams }: { searchParams: Promise<{ page?: string; tab?: string; q?: string; view?: string }> }) {
  const admin = await requireSiteAdmin();
  const params = await searchParams;
  const tab = TABS.find(item => item.key === params.tab) ?? TABS[0]!;
  const query = (params.q ?? '').trim().slice(0, 80);
  const page = Math.min(10000, Math.max(1, parseInt(params.page ?? '1', 10) || 1));
  const status: CatalogDrinkStatus = tab.key === 'duplicates' || tab.key === 'catalog' ? 'published' : tab.key;
  // «Карточки каталога» lists the parser's cards, not members' drinks.
  // `view`: all cards, the neural network's queue for moderators, or the merges it made on its own.
  const view: CardView = params.view === 'queue' || params.view === 'auto' ? params.view : 'all';
  const cards = tab.key === 'catalog' ? await listCatalogCards(query, page, 24, view) : null;
  const cardQueue = tab.key === 'catalog' ? await countCardQueue() : 0;
  const [{ items, hasMore: moreDrinks }, groups, suspected] = await Promise.all([
    cards ? Promise.resolve({ items: [], hasMore: false }) : listCatalogDrinks(status, page, 24, query, { suspects: tab.key === 'duplicates' }),
    loadAllCatalogGroups(), countSuspectedDuplicates()]);
  const hasMore = cards ? page * 24 < cards.total : moreDrinks;
  const checks = await getDrinkChecks(items.map(drink => drink.id));
  // A request sent despite the «уже есть в каталоге» warning: the parser card or published member drink it matches, to
  // compare before publishing.
  const catalogCard = (brand: string, flavor: string) => groups.find(group => group.brand.toLowerCase() === brand.toLowerCase() && group.flavor.toLowerCase() === flavor.toLowerCase());
  // The same brand and flavour suggestions as the request form, for the edit dialog.
  const brands = [...new Set(groups.map(group => group.brand.trim()).filter(brand => brand && brand.toLowerCase() !== 'unknown'))].sort((a, b) => a.localeCompare(b, 'ru'));
  const flavors = [...BASIC_FLAVORS].sort((a, b) => a.label.localeCompare(b.label, 'ru'));
  const href = (next: { tab?: TabKey; page?: number; q?: string; view?: CardView }) => {
    const search = new URLSearchParams();
    const nextTab = next.tab ?? tab.key;
    if (nextTab !== 'pending') search.set('tab', nextTab);
    const nextView = next.view ?? (nextTab === 'catalog' ? view : 'all');
    if (nextTab === 'catalog' && nextView !== 'all') search.set('view', nextView);
    const q = next.q ?? query;
    if (q) search.set('q', q);
    if ((next.page ?? 1) > 1) search.set('page', String(next.page));
    return `/admin/drinks${search.size ? `?${search}` : ''}`;
  };
  return <AdminShell queues={await getAdminQueues()} active="drinks" email={admin.email} role={admin.role} title={tab.title} subtitle={tab.subtitle}>
      <div className="admin-drink-toolbar">
        <nav className="market-filters" aria-label="Напитки участников">{TABS.map(item => <Link key={item.key} href={href({ tab: item.key, q: '' })} aria-current={item.key === tab.key ? 'page' : undefined}>{item.label}{item.key === 'duplicates' && suspected > 0 ? ` · ${suspected}` : ''}</Link>)}</nav>
        <form className="admin-drink-search" action="/admin/drinks" role="search">
          {tab.key !== 'pending' && <input type="hidden" name="tab" value={tab.key} />}
          {tab.key === 'catalog' && view !== 'all' && <input type="hidden" name="view" value={view} />}
          <label className="sr-only" htmlFor="admin-drink-query">Бренд, вкус или название</label>
          <input id="admin-drink-query" type="search" name="q" defaultValue={query} maxLength={80} placeholder="Бренд, вкус или название" />
          <button className="community-button community-button-secondary" type="submit">Найти</button>
        </form>
      </div>
      {cards && <nav className="admin-card-views" aria-label="Карточки каталога">{([['all', 'Все'], ['queue', `На проверке${cardQueue ? ` · ${cardQueue}` : ''}`], ['auto', 'Склеено нейросетью']] as const).map(([key, label]) =>
        <Link key={key} href={href({ view: key, page: 1 })} aria-current={key === view ? 'page' : undefined}>{label}</Link>)}</nav>}
      {cards ? (cards.items.length ? <ul className="admin-drink-grid">{cards.items.map(card => <li key={`${card.brand}:${card.flavor}`} className="admin-drink-card" data-muted={card.hidden || card.mergedInto ? '' : undefined}>
        <div className="admin-drink-card-main">
          <span className="admin-drink-card-cover">{card.cover ? <Image src={card.cover} width={64} height={80} unoptimized alt="" /> : null}</span>
          <div className="admin-drink-card-text">
            <small>{card.brand}</small>
            <strong>{card.hidden || card.mergedInto ? card.name : <Link href={`/catalog/${catalogGroupSlug(card.brand, card.flavor)}`}>{card.name}</Link>}</strong>
            {card.fullName && <span className="admin-drink-card-full">{card.fullName}</span>}
            <span className="admin-drink-card-meta">{card.offers ? `В магазинах · ${card.offers} ${card.offers % 10 === 1 && card.offers % 100 !== 11 ? 'предложение' : card.offers % 10 >= 2 && card.offers % 10 <= 4 && (card.offers % 100 < 10 || card.offers % 100 >= 20) ? 'предложения' : 'предложений'}` : 'Архив · нет в магазинах'}{card.ownPhoto ? ' · своё фото' : ''}</span>
            <code title="Ключ вкуса">{card.flavor}</code>
            {card.mergedInto && <span className="catalog-drink-archived">Склеена с «{card.mergedInto.label}»</span>}
            {card.hidden && <span className="catalog-drink-archived">Скрыта из каталога</span>}
          </div>
          <CatalogCardAdminMenu card={card} />
        </div>
        {card.check && (view !== 'all' || ['duplicate', 'unsure', 'unknown'].includes(card.check.verdict)) && !card.check.dismissed && !card.hidden && (view === 'auto' || !card.mergedInto) && <CardCheckNote card={card} check={card.check} />}
      </li>)}</ul> : <div className="admin-data-panel"><div className="admin-empty-result"><strong>{query ? 'Ничего не нашлось' : view === 'queue' ? 'Очередь пуста' : view === 'auto' ? 'Нейросеть ещё ничего не склеила' : tab.empty[0]}</strong><span>{query ? 'Попробуйте другой бренд или вкус.' : view === 'queue' ? 'Карточки, в которых нейросеть сомневается, появятся здесь.' : view === 'auto' ? 'Карточки, в дублях которых она уверена, она склеит сама и покажет здесь.' : tab.empty[1]}</span></div></div>)
      : items.length ? <ul className="admin-drink-grid">{items.map(drink => <li key={drink.id} className="admin-drink-card">
        <div className="admin-drink-card-main">
          <a className="admin-drink-card-cover" href={drink.photo} target="_blank" rel="noreferrer" aria-label="Фото банки целиком"><Image src={drink.photo} width={64} height={80} unoptimized alt="" /></a>
          <div className="admin-drink-card-text">
            <small>{drink.brand}</small>
            <strong>{drink.status === 'published' ? <Link href={drink.href}>{drink.name}</Link> : drink.name}</strong>
            {drink.fullName && <span className="admin-drink-card-full">{drink.fullName}</span>}
            {drink.discontinued && <span className="catalog-drink-archived">В архиве · больше не производится</span>}
            <span className="admin-drink-card-meta">{drink.volumes.map(volumeLabel).join(' · ')} · {drink.author.username ? <Link href={`/profile/${drink.author.username}`}>@{drink.author.username}</Link> : drink.author.name} · {submitted.format(drink.createdAt)}</span>
            {drink.flavor !== drink.name && <code title="Ключ вкуса">{drink.flavor}</code>}
          </div>
          <CatalogDrinkAdminMenu key={drink.updatedAt.toISOString()} brands={brands} flavors={flavors} drink={{ id: drink.id, brand: drink.brand, flavor: drink.flavor, name: drink.name, fullName: drink.fullName, volumes: drink.volumes, ingredients: drink.ingredients, status: drink.status, photo: drink.photo, discontinued: drink.discontinued, version: drink.updatedAt.toISOString() }} />
        </div>
        {drink.ingredients && <p className="admin-drink-card-ingredients">{drink.ingredients}</p>}
        {drink.photos.length > 0 && <div className="admin-drink-extras" aria-label="Ещё фото от автора">{drink.photos.map((photo, index) => <a key={photo} href={`/api/catalog-drink-photos/${photo}`} target="_blank" rel="noreferrer" aria-label={`Фото ${index + 2} целиком`}>
          <Image src={`/api/catalog-drink-photos/${photo}?size=thumbnail`} width={56} height={56} unoptimized alt="" />
        </a>)}</div>}
        {drink.business && <p className="admin-drink-card-note">Опубликован без проверки компанией «{drink.business}»</p>}
        {drink.status === 'rejected' && drink.moderationNote && <p className="admin-drink-card-note">Причина: {drink.moderationNote}</p>}
        {drink.status === 'pending' && (() => {
          const card = catalogCard(drink.brand, drink.flavor);
          if (!card) return null;
          // The same drink in a can the card does not list yet is the usual case (a shop sells its own volume): offer to add it.
          const known = [...card.variants.map(offer => offer.volumeMl ?? 0), ...(card.volumes ?? [])];
          const fresh = drink.volumes.filter(volume => !known.some(other => Math.abs(other - volume) <= 10));
          return <div className="admin-drink-card-match">
            <p>Совпадает с карточкой каталога — <Link href={`/catalog/${catalogGroupSlug(card.brand, card.flavor)}`}>сравнить</Link>. {fresh.length
              ? `В карточке нет ${fresh.map(volumeLabel).join(', ')}: добавьте объём в неё — отдельно опубликовать тот же напиток нельзя.`
              : 'Объёмы те же: склейте заявку с карточкой или смените вкус в «Редактировать».'}</p>
            <AddToCatalogCard id={drink.id} version={drink.updatedAt.toISOString()} card={{ brand: card.brand, flavor: card.flavor, label: `${card.brand} · ${flavorName(card.flavor)}` }} volumes={fresh.map(volumeLabel).join(', ')} />
          </div>;
        })()}
        {(() => { const check = checks.get(drink.id); return check && <DrinkCheckNote check={check} id={drink.id} canDismiss={drink.status === 'published'} />; })()}
        {drink.status === 'pending' && <CatalogDrinkModeration id={drink.id} version={drink.updatedAt.toISOString()} />}
      </li>)}</ul>
        : <div className="admin-data-panel"><div className="admin-empty-result"><strong>{query ? 'Ничего не нашлось' : tab.empty[0]}</strong><span>{query ? 'Попробуйте другой бренд или вкус.' : tab.empty[1]}</span></div></div>}
      {(page > 1 || hasMore) && <nav className="admin-table-pagination" aria-label="Страницы напитков"><span>Страница {page}</span><div>{page > 1 && <Link href={href({ page: page - 1 })}>← Назад</Link>}{hasMore && <Link href={href({ page: page + 1 })}>Далее →</Link>}</div></nav>}
    </AdminShell>
}

/**
 * The neural network's duplicate hint on a drink's card: the card it looks like, why, and a link to compare. Only a hint
 * — the moderator decides; on a published drink the team can clear it («Не дубль»). A plain «new» is a quiet line.
 */
function DrinkCheckNote({ check, id, canDismiss }: { check: DrinkCheck & { dismissed: boolean }; id: string; canDismiss: boolean }) {
  if (check.verdict === 'failed') return <p className="admin-drink-check" data-verdict="failed">Нейросеть не смогла проверить на дубли — повторит позже.</p>;
  if (check.verdict === 'new' || check.dismissed) return <p className="admin-drink-check" data-verdict="new">{check.dismissed ? 'Отмечено «не дубль».' : 'Нейросеть: похожих напитков в каталоге не нашла.'}</p>;
  return <div className="admin-drink-check" data-verdict={check.verdict} role="note">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>
    <div>
      <strong>{check.verdict === 'duplicate' ? 'Нейросеть: похоже на дубль' : 'Нейросеть: возможно, дубль'}{check.matchLabel && <> «{check.matchHref ? <Link href={check.matchHref}>{check.matchLabel}</Link> : check.matchLabel}»</>}</strong>
      {check.reason && <p>{check.reason}</p>}
    </div>
    {canDismiss && <form action={dismissDrinkCheckAction.bind(null, id)}><button className="community-button community-button-secondary" type="submit">Не дубль</button></form>}
  </div>;
}

/**
 * The neural network's word on a parser card: a likely duplicate (with «Склеить с «…»» and «Не дубль»), an unread
 * flavour with the shop's product name, or a merge it made on its own.
 */
function CardCheckNote({ card, check }: { card: AdminCatalogCard; check: CardCheck }) {
  const title = check.verdict === 'merged' ? 'Нейросеть склеила сама' : check.verdict === 'unknown' ? 'Парсер не распознал вкус'
    : check.verdict === 'duplicate' ? 'Нейросеть: похоже на дубль' : 'Нейросеть: возможно, дубль';
  return <div className="admin-drink-check" data-verdict={check.verdict === 'unknown' || check.verdict === 'merged' ? 'unsure' : check.verdict} role="note">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>
    <div>
      <strong>{title}{check.match && check.verdict !== 'merged' && <> «<Link href={check.match.href}>{check.match.label}</Link>»</>}</strong>
      {check.title && <p>Названия в магазинах: {check.title}</p>}
      {check.reason && <p>{check.reason}</p>}
    </div>
    {check.verdict !== 'merged' && <CardQueueActions card={{ brand: card.brand, flavor: card.flavor }} match={check.verdict === 'unknown' ? null : check.match} unknown={check.verdict === 'unknown'} />}
  </div>;
}
