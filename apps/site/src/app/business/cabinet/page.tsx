import '@/styles/shared.css';
import '@/styles/market.css';
import '@/styles/catalog.css';
import '@/styles/business-cabinet.css';
import type { Metadata } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import { cookies, headers } from 'next/headers';
import { parseSiteTheme, SITE_THEME_COOKIE } from '@/lib/site-theme';
import { redirect } from 'next/navigation';
import { BrandShell } from '@/components/brand-shell';
import { BusinessDrinkAttach, BusinessDrinkRemove, BusinessDrinkRequest, BusinessForm, BusinessInviteAnswer, BusinessInviteForm, BusinessLeave, BusinessLogoForm, BusinessMemberRemove, BusinessNotificationsForm, BusinessReplyButton, BusinessThemeForm } from '@/components/business-forms';
import { CatalogDrinkForm } from '@/components/catalog-drink-form';
import { MarketListingForm } from '@/components/market-listing-form';
import { MarketChat } from '@/components/market-chat';
import { MarketInboxRefresh } from '@/components/market-inbox-refresh';
import { PHOTO_ID_PATTERN } from '@/lib/review-photo-limits';
import { ScoreRadar } from '@/components/score-radar';
import { BusinessDropdown, BusinessIcon, BusinessPagination, BusinessSegments, BusinessShell, SortHeader, businessHref, type BusinessSection, type SortDir } from '@/components/business-shell';
import { FormAlert } from '@/components/form-alert';
import { BusinessRowMenu } from '@/components/business-shell-client';
import { after } from 'next/server';
import Link from '@/components/navigation-progress';
import { ProfileNavigation } from '@/components/profile-navigation';
import { getPool } from '@/db/pool';
import { loadAllCatalogGroups } from '@/lib/catalog';
import { BASIC_FLAVORS } from '@/lib/catalog-query';
import { volumeLabel } from '@/lib/catalog-drink-fields';
import { listOwnCatalogDrinks, type CatalogDrinkStatus } from '@/lib/catalog-drinks';
import { isUserBlocked } from '@/lib/moderation';
import { auth } from '@/lib/auth';
import { getGigaChat } from '@/lib/gigachat';
import { DIGEST_MIN_REVIEWS, DIGEST_SENTIMENT_LABELS } from '@/lib/review-digest-fields';
import { BUSINESS_REVIEW_SORTS, MAX_BUSINESS_MEMBERS, getBusinessAnalytics, getBusinessSearch, digestDue, getCabinet, listBusinessInvites, listBusinessMembers, listDrinkDigests, refreshBusinessDigests, type BusinessRole, listBrandDrinks, listBusinessDrinks, listBusinessReviews, type Business, type BusinessReview, type BusinessReviewSort } from '@/lib/business';
import { BUSINESS_STATUS_LABELS, percentChange, sortRows, type BusinessStatus } from '@/lib/business-fields';
import { catalogGroupSlug } from '@/lib/catalog-query';
import { getListings, getMessages, getOrder, getOrders } from '@/lib/market';
import { ORDER_STATUS, formatPrice, type OrderStatus } from '@/lib/market-fields';
import { storeDrinkOptions } from '@/lib/store-catalog';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Кабинет бизнеса', robots: { index: false, follow: false } };

type Params = { section?: string; page?: string; size?: string; drink?: string; q?: string; sort?: string; status?: string; view?: string; created?: string; by?: string; dir?: string; order?: string; tab?: string };
const number = new Intl.NumberFormat('ru-RU');
const longDay = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Moscow' });
const shortDay = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', timeZone: 'Europe/Moscow' });
const TITLES: Record<BusinessSection, string> = { overview: 'Обзор', reviews: 'Отзывы', insights: 'Разбор нейросетью', search: 'Поиск', brand: 'Бренд', drinks: 'Напитки', 'new-drink': 'Новый напиток', market: 'Объявления', 'new-listing': 'Новое объявление', orders: 'Заказы и чаты', settings: 'Настройки' };
const ORDER_TONE: Record<OrderStatus, string> = { new: 'mid', confirmed: 'good', completed: 'good', cancelled: 'bad' };
const DRINK_REQUEST: Record<CatalogDrinkStatus, { label: string; tone: string }> = { pending: { label: 'На модерации', tone: 'mid' }, published: { label: 'В каталоге', tone: 'good' }, rejected: { label: 'Нужно исправить', tone: 'bad' } };
const SECTIONS = Object.keys(TITLES) as BusinessSection[];
const SIZES = [10, 20, 50];
const STATUS_RANK: Record<string, number> = { approved: 0, pending: 1, rejected: 2 };
/** The column sort of a table: `by` names the column, `dir` its direction (descending first). */
function tableSort(params: Params, section: BusinessSection, keep: Record<string, string | undefined> = {}) {
  const dir: SortDir = params.dir === 'asc' ? 'asc' : 'desc';
  const rest = Object.fromEntries(Object.entries(keep).filter((entry): entry is [string, string] => Boolean(entry[1])));
  const th = (label: string, column: string) => <SortHeader label={label} column={column} by={params.by} dir={dir} href={(by, next) => businessHref(section, { ...rest, by, dir: next })} />;
  return { by: params.by, dir, th };
}
const bar = (value: number) => ({ '--v': value }) as CSSProperties;
const decimal = (value: number | null) => value === null ? '—' : value.toLocaleString('ru-RU', { maximumFractionDigits: 1 });

const KPI_ICONS = {
  reviews: <path d="m12 2.5 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.3l6.5-.9z" />,
  taste: <path d="M12 3c3 4 6 6.6 6 10a6 6 0 0 1-12 0c0-3.4 3-6 6-10Z" />,
  design: <path d="M8 2h8l-1 4H9L8 2Zm1 4h6l1 3v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V9l1-3Z" />,
  heart: <path d="M12 20s-7-4.4-9-9a4.6 4.6 0 0 1 9-2 4.6 4.6 0 0 1 9 2c-2 4.6-9 9-9 9Z" />,
  skip: <path d="M18 6 6 18M6 6l12 12" />,
  catalog: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />,
  check: <path d="m5 12 4.5 4.5L19 7" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  box: <path d="M3 7 12 3l9 4-9 4-9-4Zm0 0v10l9 4 9-4V7M12 11v10" />,
  bag: <path d="M3 9h18l-1.5 11h-15L3 9Zm5 0V7a4 4 0 0 1 8 0v2" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  name: <path d="M4 7V5h16v2M9 19h6M12 5v14" />,
  miss: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5M8.5 8.5l5 5M13.5 8.5l-5 5" /></>,
};

/** A KPI card like the reference: an icon in a raised square, the number with its change in colour, the label below. */
function Kpi({ icon, value, label, delta, deltaLabel }: { icon: keyof typeof KPI_ICONS; value: string; label: string; delta?: number | null; deltaLabel?: string }) {
  return <div className="bc-kpi">
    <span className="bc-kpi-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{KPI_ICONS[icon]}</svg></span>
    <div className="bc-kpi-value"><strong>{value}</strong>{delta !== undefined && delta !== null && <b data-trend={delta > 0 ? 'up' : delta < 0 ? 'down' : undefined}>{delta > 0 ? '+' : ''}{number.format(delta)}{deltaLabel}</b>}</div>
    <span className="bc-kpi-label">{label}</span>
  </div>;
}

function Empty({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return <div className="bc-empty"><strong>{title}</strong><span>{text}</span>{action}</div>;
}

/** The status pill of the reference, coloured by the score: green from 8, amber from 5, red below. */
function ScorePill({ taste, design }: { taste: number; design: number }) {
  const score = (taste + design) / 2;
  return <span className="bc-pill" data-tone={score >= 8 ? 'good' : score >= 5 ? 'mid' : 'bad'} title={`Вкус ${taste}, дизайн ${design}`}>{decimal(score)}</span>;
}

function StatusPill({ status }: { status: BusinessStatus }) {
  return <span className="bc-pill" data-tone={status === 'approved' ? 'good' : status === 'pending' ? 'mid' : 'bad'}>{BUSINESS_STATUS_LABELS[status]}</span>;
}

function Person({ review }: { review: BusinessReview }) {
  return <span className="bc-person">
    {review.avatarId
      // eslint-disable-next-line @next/next/no-img-element -- avatars are served from the database
      ? <img src={`/api/profile-images/${review.avatarId}`} alt="" width={36} height={36} loading="lazy" />
      : <span className="bc-person-initial" aria-hidden="true">{review.authorName.slice(0, 1).toUpperCase()}</span>}
    <span><strong>{review.authorName}</strong><small>{review.author ? `@${review.author}` : 'без ника'}</small></span>
  </span>;
}

function ReviewsTable({ items, sortHref, sort }: { items: BusinessReview[]; sortHref?: (sort: BusinessReviewSort) => string; sort?: BusinessReviewSort }) {
  const sortable = (label: string, up: BusinessReviewSort, down: BusinessReviewSort) => sortHref
    ? <Link className="bc-th-sort" href={sortHref(sort === down ? up : down)} data-active={sort === up || sort === down || undefined}>{label}<svg width="10" height="14" viewBox="0 0 10 14" aria-hidden="true"><path d="M5 1 1 5h8L5 1Z" fill={sort === up ? 'currentColor' : 'none'} stroke="currentColor" /><path d="m5 13-4-4h8l-4 4Z" fill={sort === down ? 'currentColor' : 'none'} stroke="currentColor" /></svg></Link>
    : label;
  return <div className="bc-table-card"><table className="bc-table">
    <thead><tr><th>Автор</th><th>Напиток</th><th>Отзыв</th><th>{sortable('Дата', 'old', 'new')}</th><th>{sortable('Оценка', 'low', 'high')}</th><th><span className="sr-only">Действия</span></th></tr></thead>
    <tbody>{items.map(item => <tr key={item.id}>
      <td><Person review={item} /></td>
      <td data-label="Напиток"><Link className="bc-link" href={`/catalog/${catalogGroupSlug(item.brand, item.flavor)}`}>{item.name}</Link></td>
      <td data-label="Отзыв" className="bc-cell-text"><span>{item.text}</span>{item.reply && <span className="bc-reply-preview"><b>Ваш ответ:</b> {item.reply.text}</span>}</td>
      <td data-label="Дата" className="bc-nowrap">{longDay.format(item.createdAt)}</td>
      <td data-label="Оценка"><ScorePill taste={item.taste} design={item.design} /></td>
      <td className="bc-cell-menu"><span className="bc-row-actions"><BusinessReplyButton reviewId={item.id} author={item.authorName} reply={item.reply?.text ?? null} /><BusinessRowMenu label="Действия с отзывом" items={[
        { href: `/catalog/${catalogGroupSlug(item.brand, item.flavor)}#reviews`, label: 'Открыть напиток' },
        ...(item.author ? [{ href: `/profile/${item.author}`, label: 'Профиль автора' }] : []),
      ]} /></span></td>
    </tr>)}</tbody>
  </table></div>;
}

async function Overview({ business }: { business: Business }) {
  const [analytics, recent] = await Promise.all([getBusinessAnalytics(business.id), listBusinessReviews(business.id, { limit: 5 })]);
  if (!analytics.drinks) return <Empty title="Прикрепите напитки, чтобы увидеть аналитику" text="Аналитика считает только подтверждённые напитки компании." action={<Link className="bc-button" href={businessHref('drinks')}>Перейти к напиткам</Link>} />;
  const { reviews, brand } = analytics;
  const maxWeek = Math.max(1, ...reviews.weekly.map(item => item.count));
  const change = percentChange(reviews.last30, reviews.previous30);
  return <>
    <div className="bc-kpis">
      <Kpi icon="reviews" value={number.format(reviews.total)} delta={reviews.last30} label="Отзывов на ваши напитки" />
      <Kpi icon="taste" value={decimal(reviews.taste)} label="Средняя оценка вкуса" />
      <Kpi icon="design" value={decimal(reviews.design)} label="Средняя оценка дизайна" />
      <Kpi icon="heart" value={number.format(brand.likes)} delta={brand.likes30} label="Лайков бренда в дейтинге" />
    </div>
    <div className="bc-grid">
      <section className="bc-card" aria-labelledby="bc-weekly">
        <div className="bc-card-head"><h2 id="bc-weekly">Отзывы по неделям</h2><span className="bc-muted">{change !== null ? `${change > 0 ? '+' : ''}${change}% к прошлым 30 дням` : '12 недель'}</span></div>
        <ol className="bc-chart">{reviews.weekly.map(item => <li key={item.week} title={`Неделя с ${shortDay.format(new Date(item.week))}: ${item.count}`}>
          <span style={bar(item.count / maxWeek)}>{item.count > 0 && <b>{item.count}</b>}</span><small>{shortDay.format(new Date(item.week))}</small>
        </li>)}</ol>
      </section>
      <section className="bc-card" aria-labelledby="bc-scores">
        <div className="bc-card-head"><h2 id="bc-scores">Профиль оценок</h2><span className="bc-muted">в процентах, 100 — максимум</span></div>
        <ScoreRadar yours={analytics.profile.yours} catalog={analytics.profile.catalog} label="Ваши напитки" />
      </section>
    </div>
    <section className="bc-card is-soon" aria-labelledby="bc-ai">
      <span className="bc-pill" data-tone="good">Нейросеть</span>
      <div><h2 id="bc-ai">О чём пишут в отзывах</h2><p>Разбор отзывов нейросетью по каждому напитку: что хвалят, на что жалуются и что стоит сделать.</p></div>
      <Link className="bc-button is-outline bc-soon-action" href={businessHref('insights')}>Открыть разбор</Link>
    </section>
    <section aria-labelledby="bc-recent" className="bc-stack">
      <div className="bc-section-head"><h2 id="bc-recent">Последние отзывы</h2><Link className="bc-button is-outline" href={businessHref('reviews')}>Все отзывы</Link></div>
      {recent.items.length ? <ReviewsTable items={recent.items} /> : <Empty title="Отзывов пока нет" text="Как только участники оценят ваши напитки, отзывы появятся здесь." />}
    </section>
  </>;
}

async function Reviews({ business, params }: { business: Business; params: Params }) {
  const [drinks, analytics] = await Promise.all([listBusinessDrinks(business.id), getBusinessAnalytics(business.id)]);
  const approved = drinks.filter(item => item.status === 'approved');
  const selected = approved.find(item => catalogGroupSlug(item.brand, item.flavor) === params.drink);
  const sort = BUSINESS_REVIEW_SORTS.some(item => item.value === params.sort) ? params.sort as BusinessReviewSort : 'new';
  const size = SIZES.includes(Number(params.size)) ? Number(params.size) : 20;
  const page = Math.min(500, Math.max(1, parseInt(params.page ?? '1', 10) || 1));
  const q = (params.q ?? '').trim().slice(0, 80);
  const { items, total } = await listBusinessReviews(business.id, { page, size, drink: selected, q, sort });
  const link = (over: Record<string, string | undefined>) => {
    const next = { drink: selected ? params.drink : undefined, q: q || undefined, sort: sort !== 'new' ? sort : undefined, size: size !== 20 ? String(size) : undefined, ...over };
    return businessHref('reviews', Object.fromEntries(Object.entries(next).filter((entry): entry is [string, string] => Boolean(entry[1]))));
  };
  return <>
    <div className="bc-kpis">
      <Kpi icon="reviews" value={number.format(analytics.reviews.total)} delta={analytics.reviews.last30} label="Всего отзывов" />
      <Kpi icon="clock" value={number.format(analytics.reviews.last30)} delta={percentChange(analytics.reviews.last30, analytics.reviews.previous30)} deltaLabel="%" label="За последние 30 дней" />
      <Kpi icon="taste" value={decimal(analytics.reviews.taste)} label="Средняя оценка вкуса" />
      <Kpi icon="design" value={decimal(analytics.reviews.design)} label="Средняя оценка дизайна" />
    </div>
    <div className="bc-toolbar is-inner">
      <form className="bc-search is-inline" action="/business/cabinet" role="search">
        <input type="hidden" name="section" value="reviews" />
        {selected && <input type="hidden" name="drink" value={params.drink} />}
        <BusinessIcon name="search" size={18} />
        <input name="q" type="search" defaultValue={q} placeholder="Поиск по тексту и автору…" aria-label="Поиск по отзывам" maxLength={80} />
      </form>
      <BusinessDropdown label={selected ? selected.name : 'Фильтр'} icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>}
        items={[{ href: link({ drink: undefined, page: undefined }), label: 'Все напитки', current: !selected }, ...approved.map(item => { const slug = catalogGroupSlug(item.brand, item.flavor); return { href: link({ drink: slug, page: undefined }), label: `${item.name} · ${item.reviews}`, current: selected === item }; })]} />
      <BusinessDropdown label="Сортировка" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 6h10M4 12h7M4 18h4M17 5v14m0 0-3-3m3 3 3-3" /></svg>}
        items={BUSINESS_REVIEW_SORTS.map(item => ({ href: link({ sort: item.value !== 'new' ? item.value : undefined, page: undefined }), label: item.label, current: item.value === sort }))} />
    </div>
    {items.length ? <div className="bc-stack">
      <ReviewsTable items={items} sort={sort} sortHref={value => link({ sort: value !== 'new' ? value : undefined, page: undefined })} />
      <BusinessPagination page={page} size={size} total={total} sizes={SIZES} href={(to, perPage) => link({ page: to > 1 ? String(to) : undefined, size: perPage !== 20 ? String(perPage) : undefined })} />
    </div> : <Empty title={q ? 'Ничего не нашлось' : 'Отзывов пока нет'} text={q ? 'Попробуйте другое слово или сбросьте фильтр.' : approved.length ? 'Отзывы на подтверждённые напитки появятся здесь.' : 'Сначала прикрепите напитки компании.'} />}
  </>;
}

const SCOPE_LABELS: Record<string, string> = { catalog: 'Каталог', stores: 'Магазины', market: 'Маркет' };

/**
 * «Поиск»: anonymous searches on CanRush where the company's brands were in the results or in the query itself — how
 * many, by week, the most frequent queries, and queries that named a brand and found nothing.
 */
async function Search({ business }: { business: Business }) {
  const data = await getBusinessSearch(business.id);
  if (!data.brands.length) return <Empty title="Поиск появится с первым напитком" text="Считаем поиски, где в выдаче или в самом запросе был бренд ваших подтверждённых напитков." action={<Link className="bc-button" href={businessHref('drinks')}>Прикрепить напитки</Link>} />;
  const maxWeek = Math.max(1, ...data.weekly.map(item => item.count));
  const change = percentChange(data.total30, data.previous30);
  return <>
    <div className="bc-kpis">
      <Kpi icon="search" value={number.format(data.total30)} delta={change} deltaLabel="%" label="Поисков с вашим брендом за 30 дней" />
      <Kpi icon="catalog" value={number.format(data.shown30)} label="Бренд был в выдаче" />
      <Kpi icon="name" value={number.format(data.named30)} label="Бренд назвали в запросе" />
      <Kpi icon="miss" value={number.format(data.missed30)} label="Назвали, но ничего не нашли" />
    </div>
    <div className="bc-grid">
      <section className="bc-card" aria-labelledby="bc-search-weekly">
        <div className="bc-card-head"><h2 id="bc-search-weekly">Поиски по неделям</h2><span className="bc-muted">12 недель</span></div>
        <ol className="bc-chart">{data.weekly.map(item => <li key={item.week} title={`Неделя с ${shortDay.format(new Date(item.week))}: ${item.count}`}>
          <span style={bar(item.count / maxWeek)}>{item.count > 0 && <b>{item.count}</b>}</span><small>{shortDay.format(new Date(item.week))}</small>
        </li>)}</ol>
      </section>
      <section className="bc-card" aria-labelledby="bc-search-missed">
        <div className="bc-card-head"><h2 id="bc-search-missed">Искали и не нашли</h2><span className="bc-muted">30 дней</span></div>
        {data.missed.length ? <ul className="bc-search-missed">{data.missed.map(item => <li key={item.query}><span>«{item.query}»</span><b>{item.count}</b></li>)}</ul>
          : <p className="bc-muted">Таких запросов нет — всё, что искали с вашим брендом, находилось.</p>}
        <p className="bc-muted bc-search-note">Запрос с названием бренда без результатов — спрос, который не встретил ни карточки, ни магазина, ни объявления.</p>
      </section>
    </div>
    <section aria-labelledby="bc-search-top" className="bc-stack">
      <div className="bc-section-head"><h2 id="bc-search-top">Частые запросы</h2><span className="bc-muted">30 дней · обезличено</span></div>
      {data.top.length ? <div className="bc-table-card"><table className="bc-table">
        <thead><tr><th>Запрос</th><th>Поисков</th><th>Результатов</th><th>Где искали</th><th>Последний</th></tr></thead>
        <tbody>{data.top.map(item => <tr key={item.query}>
          <td><strong>«{item.query}»</strong>{item.named && <span className="bc-pill bc-search-named">бренд в запросе</span>}</td>
          <td data-label="Поисков">{number.format(item.count)}</td>
          <td data-label="Результатов">{item.results === 0 ? <span className="bc-muted">ничего</span> : `≈ ${number.format(item.results)}`}</td>
          <td data-label="Где искали">{item.scopes.map(scope => SCOPE_LABELS[scope] ?? scope).join(', ')}</td>
          <td data-label="Последний" className="bc-nowrap">{longDay.format(item.lastAt)}</td>
        </tr>)}</tbody>
      </table></div> : <Empty title="Поисков пока нет" text="Как только участники начнут искать ваш бренд или найдут его в выдаче, запросы появятся здесь." />}
    </section>
  </>;
}

async function Brand({ business, params }: { business: Business; params: Params }) {
  const analytics = await getBusinessAnalytics(business.id);
  if (!analytics.brands.length) return <Empty title="Бренд появится с первым напитком" text="Метрики бренда считаются по брендам подтверждённых напитков компании." action={<Link className="bc-button" href={businessHref('drinks')}>Прикрепить напитки</Link>} />;
  const all = await listBrandDrinks(business.id, analytics.brands);
  const yours = params.view === 'yours';
  const sort = tableSort(params, 'brand', { view: yours ? 'yours' : undefined });
  const items = sortRows(yours ? all.filter(item => item.yours) : all, sort.by, sort.dir, {
    name: item => item.name, reviews: item => item.reviews, score: item => item.score, likes: item => item.likes, skips: item => item.skips, yours: item => item.yours ? 1 : 0,
  });
  const { brand } = analytics;
  const swipes = brand.likes + brand.skips;
  return <>
    <div className="bc-kpis">
      <Kpi icon="reviews" value={number.format(brand.reviews)} delta={brand.reviews30} label="Отзывов на бренд" />
      <Kpi icon="heart" value={number.format(brand.likes)} delta={brand.likes30} label="Свайпов вправо" />
      <Kpi icon="skip" value={number.format(brand.skips)} label={swipes ? `Свайпов влево · ${Math.round(brand.likes / swipes * 100)}% лайков` : 'Свайпов влево'} />
      <Kpi icon="catalog" value={number.format(brand.catalogDrinks)} label="Энергетиков бренда в каталоге" />
    </div>
    <div className="bc-toolbar is-inner">
      <BusinessSegments label="Напитки бренда" items={[
        { href: businessHref('brand'), label: 'Все напитки бренда', current: !yours, count: all.length },
        { href: businessHref('brand', { view: 'yours' }), label: 'Ваши', current: yours, count: all.filter(item => item.yours).length },
      ]} />
    </div>
    <div className="bc-table-card"><table className="bc-table">
      <thead><tr><th>{sort.th('Напиток', 'name')}</th><th>{sort.th('Отзывы', 'reviews')}</th><th>{sort.th('Оценка', 'score')}</th><th>{sort.th('Свайпы вправо', 'likes')}</th><th>{sort.th('Свайпы влево', 'skips')}</th><th>{sort.th('Статус', 'yours')}</th></tr></thead>
      <tbody>{items.map(item => <tr key={`${item.brand}:${item.flavor}`}>
        <td><Link className="bc-drink" href={`/catalog/${catalogGroupSlug(item.brand, item.flavor)}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- local covers */}
          <span className="bc-drink-cover">{item.cover ? <img src={item.cover} alt="" loading="lazy" /> : '⚡'}</span>
          <span><strong>{item.name}</strong><small>{item.brand}</small></span>
        </Link></td>
        <td data-label="Отзывы">{item.reviews}</td>
        <td data-label="Оценка">{item.score === null ? '—' : <span className="bc-pill" data-tone={item.score >= 8 ? 'good' : item.score >= 5 ? 'mid' : 'bad'}>{decimal(item.score)}</span>}</td>
        <td data-label="Вправо">{item.likes}</td>
        <td data-label="Влево">{item.skips}</td>
        <td data-label="Статус">{item.yours ? <span className="bc-pill" data-tone="good">Ваш</span> : <span className="bc-muted">—</span>}</td>
      </tr>)}</tbody>
    </table></div>
  </>;
}

/** Drinks the owner sent to the catalog as new ones: their moderation, and «Прикрепить» once published. */
function DrinkRequests({ requests, attached }: { requests: Awaited<ReturnType<typeof listOwnCatalogDrinks>>; attached: Set<string> }) {
  return <section aria-labelledby="bc-requests" className="bc-stack">
    <div className="bc-section-head"><h2 id="bc-requests">Новые напитки в каталог</h2><Link className="bc-button is-outline" href={businessHref('new-drink')}>Добавить ещё</Link></div>
    <div className="bc-table-card"><table className="bc-table">
      <thead><tr><th>Напиток</th><th>Отправлен</th><th>Объёмы</th><th>Модерация</th><th>Компания</th></tr></thead>
      <tbody>{requests.map(drink => { const key = JSON.stringify([drink.brand, drink.flavor]); return <tr key={drink.id}>
        <td><span className="bc-drink">
          {/* eslint-disable-next-line @next/next/no-img-element -- the member's photo, served from the database */}
          <span className="bc-drink-cover"><img src={`${drink.photo}?size=thumbnail`} alt="" loading="lazy" /></span>
          <span><strong>{drink.brand} · {drink.name}</strong><small>{drink.fullName || drink.brand}</small></span>
        </span>{drink.status === 'rejected' && drink.moderationNote && <small className="bc-note">Модератор: {drink.moderationNote}</small>}</td>
        <td data-label="Отправлен" className="bc-nowrap">{longDay.format(drink.createdAt)}</td>
        <td data-label="Объёмы">{drink.volumes.map(volumeLabel).join(' · ')}</td>
        <td data-label="Модерация"><span className="bc-pill" data-tone={DRINK_REQUEST[drink.status].tone}>{DRINK_REQUEST[drink.status].label}</span></td>
        <td data-label="Компания">{drink.status !== 'published' ? <span className="bc-muted">после публикации</span>
          : attached.has(key) ? <span className="bc-pill" data-tone="good">Прикреплён</span> : <BusinessDrinkAttach brand={drink.brand} flavor={drink.flavor} />}</td>
      </tr>; })}</tbody>
    </table></div>
  </section>;
}

async function Drinks({ business, params, userId }: { business: Business; params: Params; userId: string }) {
  const [drinks, options, requests] = await Promise.all([listBusinessDrinks(business.id), storeDrinkOptions(), listOwnCatalogDrinks(userId)]);
  const status = (['approved', 'pending', 'rejected'] as const).find(item => item === params.status);
  const sort = tableSort(params, 'drinks', { status });
  const items = sortRows(status ? drinks.filter(item => item.status === status) : drinks, sort.by, sort.dir, {
    name: item => item.name, added: item => item.createdAt.getTime(), reviews: item => item.reviews, taste: item => item.taste, design: item => item.design,
    swipes: item => item.likes, cans: item => item.cans, status: item => STATUS_RANK[item.status] ?? 0,
  });
  const counts = { approved: 0, pending: 0, rejected: 0 };
  for (const item of drinks) counts[item.status] += 1;
  return <>
    <div className="bc-kpis">
      <Kpi icon="box" value={number.format(drinks.length)} label="Напитков компании" />
      <Kpi icon="check" value={number.format(counts.approved)} label="Подтверждены" />
      <Kpi icon="clock" value={number.format(counts.pending)} label="На проверке" />
      <Kpi icon="skip" value={number.format(counts.rejected)} label="Отклонены" />
    </div>
    <section className="bc-card" aria-labelledby="bc-attach">
      <div className="bc-card-head"><h2 id="bc-attach">Прикрепить напиток из каталога</h2><span className="bc-muted">команда проверит, что он ваш</span></div>
      <BusinessDrinkRequest options={options} taken={drinks.map(item => JSON.stringify([item.brand, item.flavor]))} />
    </section>
    <div className="bc-toolbar is-inner">
      <BusinessSegments label="Статус" items={[
        { href: businessHref('drinks'), label: 'Все', current: !status, count: drinks.length },
        { href: businessHref('drinks', { status: 'approved' }), label: 'Подтверждены', current: status === 'approved', count: counts.approved },
        { href: businessHref('drinks', { status: 'pending' }), label: 'На проверке', current: status === 'pending', count: counts.pending },
        { href: businessHref('drinks', { status: 'rejected' }), label: 'Отклонены', current: status === 'rejected', count: counts.rejected },
      ]} />
    </div>
    {items.length ? <div className="bc-table-card"><table className="bc-table">
      <thead><tr><th>{sort.th('Напиток', 'name')}</th><th>{sort.th('Добавлен', 'added')}</th><th>{sort.th('Отзывы', 'reviews')}</th><th>{sort.th('Вкус', 'taste')}</th><th>{sort.th('Дизайн', 'design')}</th><th>{sort.th('Свайпы', 'swipes')}</th><th>{sort.th('Банки', 'cans')}</th><th>{sort.th('Статус', 'status')}</th><th><span className="sr-only">Действия</span></th></tr></thead>
      <tbody>{items.map(item => <tr key={`${item.brand}:${item.flavor}`}>
        <td><Link className="bc-drink" href={`/catalog/${catalogGroupSlug(item.brand, item.flavor)}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- local covers */}
          <span className="bc-drink-cover">{item.cover ? <img src={item.cover} alt="" loading="lazy" /> : '⚡'}</span>
          <span><strong>{item.name}</strong><small>{item.brand}</small></span>
        </Link>{item.status === 'rejected' && item.moderationNote && <small className="bc-note">Причина: {item.moderationNote}</small>}</td>
        <td data-label="Добавлен" className="bc-nowrap">{longDay.format(item.createdAt)}</td>
        <td data-label="Отзывы">{item.reviews}</td>
        <td data-label="Вкус">{decimal(item.taste)}</td>
        <td data-label="Дизайн">{decimal(item.design)}</td>
        <td data-label="Свайпы">{item.likes} / {item.skips}</td>
        <td data-label="Банки">{item.cans}</td>
        <td data-label="Статус"><StatusPill status={item.status} /></td>
        <td className="bc-cell-menu"><BusinessDrinkRemove brand={item.brand} flavor={item.flavor} /></td>
      </tr>)}</tbody>
    </table></div> : <Empty title={status ? 'Здесь пусто' : 'Напитков пока нет'} text={status ? 'Напитков с таким статусом нет.' : 'Найдите свои напитки в каталоге и прикрепите их.'} />}
    {requests.length > 0 && <DrinkRequests requests={requests} attached={new Set(drinks.filter(item => item.status !== 'rejected').map(item => JSON.stringify([item.brand, item.flavor])))} />}
  </>;
}

/** «Новый напиток» inside the cabinet: the catalog's step form; after moderation the drink is attached in one click. */
async function NewDrink() {
  const groups = await loadAllCatalogGroups();
  const brands = [...new Set(groups.map(group => group.brand.trim()).filter(brand => brand && brand.toLowerCase() !== 'unknown'))].sort((a, b) => a.localeCompare(b, 'ru'));
  const flavors = [...BASIC_FLAVORS].sort((a, b) => a.label.localeCompare(b.label, 'ru'));
  return <section className="bc-card bc-form-card">
    <div className="bc-card-head"><h2>Напиток, которого нет в каталоге</h2><span className="bc-muted">бренд, вкус, фото банки и объёмы</span></div>
    <p className="bc-muted">После проверки модератором напиток появится в каталоге, а в разделе «Напитки» — кнопка, чтобы прикрепить его к компании.</p>
    <CatalogDrinkForm brands={brands} flavors={flavors} inCabinet />
  </section>;
}

/** «Новое объявление» inside the cabinet: the market's step form; publishing returns to the listings. */
async function NewListing({ userId }: { userId: string }) {
  const [groups, blocked] = await Promise.all([loadAllCatalogGroups(), isUserBlocked(userId)]);
  const brands = [...new Set(groups.map(group => group.brand).filter(brand => brand && brand.toLowerCase() !== 'unknown'))].sort((a, b) => a.localeCompare(b, 'ru'));
  return <section className="bc-card bc-form-card">
    <div className="bc-card-head"><h2>Объявление в маркете</h2><span className="bc-muted">пять шагов — и оно в маркете</span></div>
    {blocked ? <FormAlert>Публикация объявлений для этого аккаунта ограничена.</FormAlert> : <MarketListingForm brands={brands} inCabinet />}
  </section>;
}

async function Market({ userId, params }: { userId: string; params: Params }) {
  const { items } = await getListings(1, userId);
  const closed = params.status === 'closed';
  const sort = tableSort(params, 'market', { status: closed ? 'closed' : undefined });
  const shown = sortRows(items.filter(item => item.closed === closed), sort.by, sort.dir, {
    title: item => item.title, price: item => item.price, quantity: item => item.quantity, created: item => Date.parse(item.createdAt), status: item => item.closed ? 1 : 0,
  });
  const active = items.filter(item => !item.closed);
  return <>
    <div className="bc-kpis">
      <Kpi icon="bag" value={number.format(items.length)} label="Объявлений" />
      <Kpi icon="check" value={number.format(active.length)} label="Активных" />
      <Kpi icon="clock" value={number.format(items.length - active.length)} label="Закрытых" />
      <Kpi icon="box" value={number.format(active.reduce((sum, item) => sum + item.quantity, 0))} label="Банок в продаже" />
    </div>
    <div className="bc-toolbar is-inner">
      <BusinessSegments label="Объявления" items={[
        { href: businessHref('market'), label: 'Активные', current: !closed, count: active.length },
        { href: businessHref('market', { status: 'closed' }), label: 'Закрытые', current: closed, count: items.length - active.length },
      ]} />
    </div>
    {params.created && <FormAlert tone="success" title="Объявление опубликовано">Оно уже в маркете. Заказы и переписка с покупателями — в «Заказах и чатах».</FormAlert>}
    {shown.length ? <div className="bc-table-card"><table className="bc-table">
      <thead><tr><th>{sort.th('Объявление', 'title')}</th><th>{sort.th('Цена за банку', 'price')}</th><th>{sort.th('Осталось', 'quantity')}</th><th>{sort.th('Создано', 'created')}</th><th>{sort.th('Статус', 'status')}</th></tr></thead>
      <tbody>{shown.map(item => <tr key={item.id}>
        <td><Link className="bc-drink" href={`/market/${item.id}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- listing photos are served from the database */}
          <span className="bc-drink-cover">{item.photos[0] ? <img src={`/api/market-photos/${item.photos[0]}?thumb`} alt="" loading="lazy" /> : '⚡'}</span>
          <span><strong>{item.title}</strong><small>{item.brand ?? item.city}</small></span>
        </Link></td>
        <td data-label="Цена">{formatPrice(item.price)}</td>
        <td data-label="Осталось">{item.quantity} шт.</td>
        <td data-label="Создано" className="bc-nowrap">{longDay.format(new Date(item.createdAt))}</td>
        <td data-label="Статус"><span className="bc-pill" data-tone={item.closed ? 'bad' : 'good'}>{item.closed ? 'Закрыто' : 'Активно'}</span></td>
      </tr>)}</tbody>
    </table></div> : <Empty title={closed ? 'Закрытых объявлений нет' : 'Активных объявлений нет'} text="Продавайте лимитки, наборы и редкие вкусы напрямую участникам." action={<Link className="bc-button" href={businessHref('new-listing')}>Создать объявление</Link>} />}
  </>;
}

const THUMB = 'M7 10.5v9.5H4v-9.5zM7 10.5l3.6-6.6c1.5 0 2.5 1.2 2.2 2.6l-.6 3.5h6.1a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 17.1 20H7';
/** The brief's three lists, as on the drink page: brand blue for praise and advice, neutral grey for complaints. */
const INSIGHT_LISTS = [
  { key: 'praise', title: 'Хвалят', tone: 'brand', icon: <path d={THUMB} /> },
  { key: 'complaints', title: 'Жалуются', tone: 'muted', icon: <path d={THUMB} transform="rotate(180 12 12)" /> },
  { key: 'suggestions', title: 'Что сделать', tone: 'brand', icon: <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3Z" /> },
] as const;
const reviewsWord = (count: number) => count % 10 === 1 && count % 100 !== 11 ? 'отзыв' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'отзыва' : 'отзывов';

/**
 * «Разбор нейросетью»: one card per approved drink with the latest brief — summary, praise, complaints and what to
 * do. There is no button: drinks that are due (no brief, or new reviews after the cooldown) are briefed after the
 * response (`refreshBusinessDigests`), and the card says so until the next visit. Texts and scores go to the model,
 * never names.
 */
async function Insights({ business }: { business: Business }) {
  const drinks = await listDrinkDigests(business.id);
  const enabled = getGigaChat() !== null;
  if (!drinks.length) return <Empty title="Разбор появится с первым напитком" text="Прикрепите напитки компании — когда у них будут отзывы, нейросеть разберёт их." action={<Link className="bc-button" href={businessHref('drinks')}>Прикрепить напитки</Link>} />;
  const due = enabled ? drinks.filter(drink => digestDue(drink)) : [];
  if (due.length) after(() => refreshBusinessDigests(business.id, drinks).catch(() => 0));
  return <>
    {!enabled && <FormAlert tone="warning" title="Разбор нейросетью пока не подключён">Он появится, когда мы его включим на сайте.</FormAlert>}
    <p className="bc-muted bc-insights-note">Разбор обновляется сам, когда приходят новые отзывы. Нейросеть читает только текст и оценки — без имён авторов. Это выжимка, а не факт: перепроверяйте выводы по самим отзывам.</p>
    <div className="bc-insights">{drinks.map(drink => {
      const digest = drink.digest;
      const status = !enabled ? null
        : drink.reviews < DIGEST_MIN_REVIEWS ? `Нужно хотя бы ${DIGEST_MIN_REVIEWS} отзыва — сейчас ${drink.reviews}`
        : due.includes(drink) ? (digest ? `Обновляем: +${drink.fresh} ${reviewsWord(drink.fresh)}` : 'Разбираем отзывы — обновите страницу через минуту')
        : digest && drink.fresh > 0 ? `+${drink.fresh} ${reviewsWord(drink.fresh)} — обновим позже`
        : digest ? 'Актуально' : null;
      return <article key={`${drink.brand}:${drink.flavor}`} className="bc-card bc-insight">
        <header className="bc-insight-head">
          <Link className="bc-drink" href={`/catalog/${catalogGroupSlug(drink.brand, drink.flavor)}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- local covers */}
            <span className="bc-drink-cover">{drink.cover ? <img src={drink.cover} alt="" loading="lazy" /> : '⚡'}</span>
            <span><strong>{drink.name}</strong><small>{drink.reviews} {reviewsWord(drink.reviews)}</small></span>
          </Link>
          {digest && <span className="bc-pill bc-insight-mood">{DIGEST_SENTIMENT_LABELS[digest.body.sentiment]}</span>}
        </header>
        {digest && <>
          <p className="bc-insight-summary">{digest.body.summary}</p>
          <div className="bc-insight-lists">
            {INSIGHT_LISTS.map(({ key, title, tone, icon }) => <section key={key} data-tone={tone}>
              <h3><span aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icon}</svg></span>{title}</h3>
              {digest.body[key].length ? <ul>{digest.body[key].map(item => <li key={item}>{item.charAt(0).toUpperCase() + item.slice(1)}</li>)}</ul> : <p className="bc-muted">Ничего заметного</p>}
            </section>)}
          </div>
        </>}
        <footer className="bc-insight-foot">
          <span className="bc-muted">{digest ? `Нейросеть · по ${digest.reviewCount} ${digest.reviewCount % 10 === 1 && digest.reviewCount % 100 !== 11 ? 'отзыву' : 'отзывам'} · ${longDay.format(digest.createdAt)}` : 'Разбора ещё нет.'}</span>
          {status && <span className="bc-pill bc-insight-status">{status}</span>}
        </footer>
      </article>;
    })}</div>
  </>;
}

const SETTINGS_TABS = [
  { key: 'company', label: 'Компания' }, { key: 'team', label: 'Команда' }, { key: 'notifications', label: 'Уведомления' }, { key: 'theme', label: 'Оформление' }, { key: 'documents', label: 'Документы' },
] as const;
const DOCUMENTS = [
  { href: '/terms', title: 'Пользовательское соглашение', note: 'Правила CanRush для всех аккаунтов, и для компаний тоже' },
  { href: '/privacy', title: 'Политика обработки персональных данных', note: 'Какие данные мы храним и кому передаём' },
  { href: '/account-deletion', title: 'Удаление аккаунта', note: 'Как удалить аккаунт и что при этом происходит с данными' },
  { href: '/business', title: 'CanRush для бизнеса', note: 'Что умеет кабинет и как подключаются компании' },
];

/** Settings: company and logo (the owner edits), the team, notifications and documents — tabs in the toolbar style. */
async function Settings({ business, role, userId, params }: { business: Business; role: BusinessRole; userId: string; params: Params }) {
  const tab = SETTINGS_TABS.find(item => item.key === params.tab)?.key ?? 'company';
  const owner = role === 'owner';
  const tabs = <div className="bc-toolbar is-inner"><BusinessSegments label="Настройки" items={SETTINGS_TABS.map(item => ({ href: businessHref('settings', item.key === 'company' ? {} : { tab: item.key }), label: item.label, current: item.key === tab }))} /></div>;
  if (tab === 'team') {
    const members = await listBusinessMembers(business.id);
    return <>{tabs}
      {owner ? <section className="bc-card"><div className="bc-card-head"><h2>Пригласить в команду</h2><span className="bc-muted">до {MAX_BUSINESS_MEMBERS} человек</span></div>
        <p className="bc-muted">Удобнее всего по рабочей почте: придёт письмо, а войдя с этой почтой, человек увидит приглашение в кабинете. Можно и по нику CanRush. После согласия участнику откроются аналитика, напитки и разбор отзывов; данные компании, логотип и команду меняете только вы.</p>
        <BusinessInviteForm /></section>
        : <section className="bc-card"><div className="bc-card-head"><h2>Вы в команде «{business.name}»</h2></div><p className="bc-muted">Кабинетом управляет владелец компании. Объявления и заказы в кабинете — ваши собственные.</p><div><BusinessLeave /></div></section>}
      <div className="bc-table-card"><table className="bc-table">
        <thead><tr><th>Участник</th><th>Роль</th><th>С нами с</th><th><span className="sr-only">Действия</span></th></tr></thead>
        <tbody>
          <tr><td><span className="bc-person"><span className="bc-person-initial" aria-hidden="true">★</span><span><strong>Владелец</strong><small>{owner ? 'вы' : 'управляет кабинетом'}</small></span></span></td><td data-label="Роль"><span className="bc-pill" data-tone="good">Владелец</span></td><td data-label="С нами с" className="bc-nowrap">{longDay.format(business.createdAt)}</td><td /></tr>
          {members.map(member => <tr key={member.key}>
            <td><span className="bc-person">
              {/* eslint-disable-next-line @next/next/no-img-element -- avatars are served from the database */}
              {member.avatarId ? <img src={`/api/profile-images/${member.avatarId}`} alt="" width={36} height={36} /> : <span className="bc-person-initial" aria-hidden="true">{member.email ? '@' : member.name.slice(0, 1).toUpperCase()}</span>}
              <span><strong>{member.name}{member.userId === userId ? ' (вы)' : ''}</strong><small>{member.email && member.status === 'pending' ? 'приглашение на почту' : member.username ? `@${member.username}` : 'без ника'}</small></span>
            </span></td>
            <td data-label="Роль"><span className="bc-pill" data-tone={member.status === 'active' ? 'good' : 'mid'}>{member.status === 'active' ? 'Менеджер' : 'Приглашён'}</span></td>
            <td data-label="С нами с" className="bc-nowrap">{longDay.format(member.createdAt)}</td>
            <td className="bc-cell-actions">{owner && <BusinessMemberRemove memberKey={member.key} pending={member.status === 'pending'} />}</td>
          </tr>)}
        </tbody>
      </table></div>
    </>;
  }
  if (tab === 'notifications') {
    const disabled = (await getPool().query(`select 1 from "notificationPreference" where "userId" = $1 and kind = 'business-review' and not enabled`, [userId])).rowCount;
    return <>{tabs}
      <section className="bc-card"><div className="bc-card-head"><h2>Уведомления кабинета</h2><span className="bc-muted">лично для вас</span></div>
        <BusinessNotificationsForm reviews={!disabled} />
      </section>
      <section className="bc-card"><div className="bc-card-head"><h2>Заказы, сообщения и остальное</h2></div>
        <p className="bc-muted">Новые заказы и сообщения покупателей приходят по правилам маркета. Каналы — сайт, Telegram-бот и приложение — и остальные уведомления настраиваются в общих настройках аккаунта.</p>
        <div className="bc-logo-actions"><Link className="bc-button is-outline" href="/profile/settings?section=notifications">Общие уведомления</Link><Link className="bc-button is-outline" href="/profile/settings?section=telegram-bot">Telegram-бот</Link></div>
      </section>
    </>;
  }
  if (tab === 'theme') {
    const theme = parseSiteTheme((await cookies()).get(SITE_THEME_COOKIE)?.value) ?? 'system';
    return <>{tabs}
      <section className="bc-card"><div className="bc-card-head"><h2>Тема</h2><span className="bc-muted">для кабинета и всего сайта</span></div>
        <BusinessThemeForm theme={theme} />
      </section>
    </>;
  }
  if (tab === 'documents') return <>{tabs}
    <section className="bc-card"><div className="bc-card-head"><h2>Документы CanRush</h2><span className="bc-muted">действуют и для компаний</span></div>
      <ul className="bc-docs">{DOCUMENTS.map(doc => <li key={doc.href}><Link href={doc.href}><strong>{doc.title}</strong><small className="bc-muted">{doc.note}</small></Link></li>)}</ul>
    </section>
    <section className="bc-card"><div className="bc-card-head"><h2>Связь</h2></div>
      <p className="bc-muted">Вопросы по кабинету, проверке компании и условиям — на <a className="bc-link" href="mailto:hello@canrush.ru">hello@canrush.ru</a>.</p>
      <p className="bc-muted">© CanRush, {new Date(business.createdAt).getFullYear()}. Названия и логотипы брендов принадлежат их владельцам.</p>
    </section>
  </>;
  return <>{tabs}
    <section className="bc-card"><BusinessLogoForm name={business.name} logoId={business.logoId} editable={owner} /></section>
    <section className="bc-card"><div className="bc-card-head"><h2>Компания</h2><span className="bc-muted">видна команде при проверке</span></div>
      {owner ? <BusinessForm apply={business.status === 'rejected'} initial={business} /> : <p className="bc-muted">Данные компании меняет владелец кабинета.</p>}
    </section>
  </>;
}

/**
 * «Заказы и чаты» inside the cabinet: the same orders as /messages — a sortable table (sold and bought), and an order's
 * chat (`?order=`) with the market's own chat component. The list refreshes itself like the inbox.
 */
async function Orders({ userId, params }: { userId: string; params: Params }) {
  if (params.order && PHOTO_ID_PATTERN.test(params.order)) {
    const order = await getOrder(userId, params.order);
    if (order) {
      const [messages, blocked] = await Promise.all([getMessages(userId, order.id), isUserBlocked(userId)]);
      return <section className="bc-card bc-chat-card"><MarketChat key={order.id} initialOrder={order} initialMessages={messages.items} initialHasMore={messages.hasMore} userId={userId} blocked={blocked} /></section>;
    }
  }
  const page = Math.min(1000, Math.max(1, parseInt(params.page ?? '1', 10) || 1));
  const { items: all, hasMore } = await getOrders(userId, page);
  const side = params.view === 'selling' || params.view === 'buying' ? params.view : undefined;
  const sort = tableSort(params, 'orders', { view: side });
  const filtered = all.filter(order => !side || (side === 'selling') === (order.sellerId === userId));
  const items = sortRows(filtered, sort.by, sort.dir, {
    partner: order => order.sellerId === userId ? order.buyerName : order.sellerName, title: order => order.title, quantity: order => order.quantity,
    price: order => order.price, status: order => order.status, updated: order => Date.parse(order.updatedAt), unread: order => order.unread,
  });
  const selling = all.filter(order => order.sellerId === userId).length;
  return <>
    <MarketInboxRefresh />
    <div className="bc-kpis">
      <Kpi icon="bag" value={number.format(all.length)} label={hasMore || page > 1 ? 'Заказов на странице' : 'Заказов'} />
      <Kpi icon="box" value={number.format(selling)} label="Вы продаёте" />
      <Kpi icon="clock" value={number.format(all.filter(order => order.status === 'new' || order.status === 'confirmed').length)} label="В работе" />
      <Kpi icon="reviews" value={number.format(all.reduce((sum, order) => sum + order.unread, 0))} label="Непрочитанных сообщений" />
    </div>
    <div className="bc-toolbar is-inner">
      <BusinessSegments label="Заказы" items={[
        { href: businessHref('orders'), label: 'Все', current: !side, count: all.length },
        { href: businessHref('orders', { view: 'selling' }), label: 'Продаю', current: side === 'selling', count: selling },
        { href: businessHref('orders', { view: 'buying' }), label: 'Покупаю', current: side === 'buying', count: all.length - selling },
      ]} />
    </div>
    {items.length ? <div className="bc-stack"><div className="bc-table-card"><table className="bc-table">
      <thead><tr><th>{sort.th('Собеседник', 'partner')}</th><th>{sort.th('Объявление', 'title')}</th><th>{sort.th('Кол-во', 'quantity')}</th><th>{sort.th('Сумма', 'price')}</th><th>{sort.th('Статус', 'status')}</th><th>{sort.th('Обновлено', 'updated')}</th><th>{sort.th('Новые', 'unread')}</th></tr></thead>
      <tbody>{items.map(order => { const selling = order.sellerId === userId; const href = businessHref('orders', { order: order.id }); return <tr key={order.id}>
        <td><Link className="bc-drink" href={href}>
          {/* eslint-disable-next-line @next/next/no-img-element -- listing photos are served from the database */}
          <span className="bc-drink-cover">{order.photoId ? <img src={`/api/market-photos/${order.photoId}?thumb`} alt="" loading="lazy" /> : '⚡'}</span>
          <span><strong>{selling ? order.buyerName : order.sellerName}</strong><small>{selling ? 'Покупает у вас' : 'Вы покупаете'}</small></span>
        </Link></td>
        <td data-label="Объявление"><Link className="bc-link" href={href}>{order.title}</Link></td>
        <td data-label="Кол-во">{order.quantity} шт.</td>
        <td data-label="Сумма">{formatPrice(order.price)}</td>
        <td data-label="Статус"><span className="bc-pill" data-tone={ORDER_TONE[order.status]}>{ORDER_STATUS[order.status]}</span></td>
        <td data-label="Обновлено" className="bc-nowrap">{longDay.format(new Date(order.updatedAt))}</td>
        <td data-label="Новые">{order.unread > 0 ? <span className="bc-count">{order.unread}</span> : <span className="bc-muted">—</span>}</td>
      </tr>; })}</tbody>
    </table></div>
    {(page > 1 || hasMore) && <div className="bc-pagination"><span /><nav className="bc-pages" aria-label="Страницы заказов">
      {page > 1 ? <Link className="bc-page" href={businessHref('orders', { ...(side ? { view: side } : {}), ...(page > 2 ? { page: String(page - 1) } : {}) })} aria-label="Предыдущая">‹</Link> : <span className="bc-page is-disabled" aria-hidden="true">‹</span>}
      <span className="bc-page" aria-current="page">{page}</span>
      {hasMore ? <Link className="bc-page" href={businessHref('orders', { ...(side ? { view: side } : {}), page: String(page + 1) })} aria-label="Следующая">›</Link> : <span className="bc-page is-disabled" aria-hidden="true">›</span>}
    </nav><span /></div>}
    </div> : <Empty title="Заказов пока нет" text="Когда участник закажет банки из ваших объявлений, заказ и переписка появятся здесь." action={<Link className="bc-button" href={businessHref('new-listing')}>Создать объявление</Link>} />}
  </>;
}

/**
 * The business cabinet: without a company — the application form; afterwards a SaaS console of its own (no site
 * header), with overview, reviews, brand, drinks, listings and settings. A pending company already attaches drinks;
 * analytics open after approval.
 */
export default async function BusinessCabinetPage({ searchParams }: { searchParams: Promise<Params> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in?for=business');
  const params = await searchParams;
  const cabinet = await getCabinet(session.user.id);
  if (!cabinet) {
    const invites = await listBusinessInvites(session.user.id);
    return <BrandShell headerAction={<ProfileNavigation active="business" />}>
      <div className="bc-apply">
        {invites.map(invite => <section key={invite.businessId} className="bc-invite">
          <strong>Вас пригласили в команду «{invite.business}»</strong>
          <span className="bc-muted">{invite.inviter ? `@${invite.inviter} приглашает` : 'Приглашение'} управлять кабинетом компании: аналитика, напитки, разбор отзывов.</span>
          <BusinessInviteAnswer businessId={invite.businessId} />
        </section>)}
        <p className="bc-muted">CanRush для бизнеса</p>
        <h1>Расскажите о компании</h1>
        <p>Проверим, что компания настоящая, и откроем кабинет: аналитику отзывов и бренда, ваши напитки и объявления в маркете.</p>
        <BusinessForm apply />
      </div>
    </BrandShell>;
  }
  const { business, role } = cabinet;
  const section = SECTIONS.includes(params.section as BusinessSection) ? params.section as BusinessSection : 'overview';
  const approved = business.status === 'approved';
  const counts = (await getPool().query<{ notifications: number; messages: number }>(
    `select (select count(*)::int from notification where "userId" = $1 and "readAt" is null) as notifications,
       (select count(*)::int from "marketMessage" m join "marketOrder" o on o.id = m."orderId" join "marketListing" l on l.id = o."listingId"
        where $1 in (o."buyerId", l."sellerId") and m."senderId" <> $1
          and m."createdAt" > coalesce(case when o."buyerId" = $1 then o."buyerReadAt" else o."sellerReadAt" end, 'epoch')) as messages`, [session.user.id])).rows[0];
  const actions = section === 'market' ? <Link className="bc-button" href={businessHref('new-listing')}>Новое объявление</Link>
    : section === 'drinks' ? <Link className="bc-button" href={businessHref('new-drink')}>Новый напиток</Link>
    : section === 'new-drink' ? <Link className="bc-button is-outline" href={businessHref('drinks')}>К напиткам</Link>
    : section === 'new-listing' ? <Link className="bc-button is-outline" href={businessHref('market')}>К объявлениям</Link>
    : section === 'orders' ? (params.order ? <Link className="bc-button is-outline" href={businessHref('orders')}>Все заказы</Link> : <Link className="bc-button" href={businessHref('new-listing')}>Новое объявление</Link>)
    : section === 'settings' ? undefined
    : <>{approved && <a className="bc-button is-outline" href="/business/cabinet/export" download>Экспорт CSV</a>}<Link className="bc-button" href={businessHref('drinks')}>Прикрепить напиток</Link></>;
  const toolbar = section === 'overview' || section === 'reviews' || section === 'insights' || section === 'search' || section === 'brand'
    ? <BusinessSegments label="Аналитика" items={[
      { href: businessHref('overview'), label: 'Сводка', current: section === 'overview' },
      { href: businessHref('reviews'), label: 'Отзывы', current: section === 'reviews' },
      { href: businessHref('insights'), label: 'Разбор', current: section === 'insights' },
      { href: businessHref('search'), label: 'Поиск', current: section === 'search' },
      { href: businessHref('brand'), label: 'Бренд', current: section === 'brand' },
    ]} />
    : undefined;
  const locked = (title: string) => <Empty title={title} text="Команда подтвердит компанию и её напитки — и здесь появятся отзывы, оценки и метрики бренда." action={<Link className="bc-button" href={businessHref('drinks')}>Прикрепить напитки</Link>} />;
  return <BusinessShell business={business} active={section} title={TITLES[section]} actions={actions} toolbar={toolbar} unread={counts?.notifications ?? 0} unreadMessages={counts?.messages ?? 0}>
    {business.status === 'pending' && <FormAlert tone="warning" title="Компания на проверке">Обычно это занимает пару дней. Пока можно прикрепить напитки и заполнить настройки — аналитика откроется после подтверждения.</FormAlert>}
    {business.status === 'rejected' && <FormAlert title="Компания не прошла проверку" actions={section !== 'settings' ? <Link className="bc-button is-outline" href={businessHref('settings')}>Исправить</Link> : undefined}>
      {business.moderationNote || 'Поправьте данные компании в настройках и отправьте снова.'}
    </FormAlert>}
    {section === 'overview' && (approved ? <Overview business={business} /> : locked('Аналитика появится после проверки'))}
    {section === 'reviews' && (approved ? <Reviews business={business} params={params} /> : locked('Отзывы появятся после проверки'))}
    {section === 'insights' && (approved ? <Insights business={business} /> : locked('Разбор появится после проверки'))}
    {section === 'search' && (approved ? <Search business={business} /> : locked('Поиск появится после проверки'))}
    {section === 'brand' && (approved ? <Brand business={business} params={params} /> : locked('Метрики бренда появятся после проверки'))}
    {section === 'drinks' && <Drinks business={business} params={params} userId={session.user.id} />}
    {section === 'new-drink' && <NewDrink />}
    {section === 'new-listing' && <NewListing userId={session.user.id} />}
    {section === 'orders' && <Orders userId={session.user.id} params={params} />}
    {section === 'market' && <Market userId={session.user.id} params={params} />}
    {section === 'settings' && <Settings business={business} role={role} userId={session.user.id} params={params} />}
  </BusinessShell>;
}
