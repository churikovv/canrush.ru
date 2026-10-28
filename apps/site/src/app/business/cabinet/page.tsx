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
import { BusinessDrinkAttach, BusinessDrinkRemove, BusinessDrinkRequest, BusinessForm, BusinessInviteAnswer, BusinessInviteForm, BusinessLeave, BusinessLogoForm, BusinessMemberRemove, BusinessMemberRole, BusinessNotificationsForm, BusinessReplyButton, BusinessThemeForm, CompetitorPicker, DrinkEditForm, PromoAddons, WeeklyReportSwitch } from '@/components/business-forms';
import { CatalogDrinkForm } from '@/components/catalog-drink-form';
import { MarketListingForm } from '@/components/market-listing-form';
import { MarketChat } from '@/components/market-chat';
import { MarketInboxRefresh } from '@/components/market-inbox-refresh';
import { PHOTO_ID_PATTERN } from '@/lib/review-photo-limits';
import { ScoreRadar } from '@/components/score-radar';
import { BusinessDropdown, BusinessIcon, BusinessPagination, BusinessSegments, BusinessShell, SortHeader, businessHref, type BusinessSection, type SortDir } from '@/components/business-shell';
import { FormAlert } from '@/components/form-alert';
import { BusinessChecklist, BusinessRowMenu } from '@/components/business-shell-client';
import { Kpi } from '@/components/business-kpi';
import { after } from 'next/server';
import Link from '@/components/navigation-progress';
import { ProfileNavigation } from '@/components/profile-navigation';
import { getPool } from '@/db/pool';
import { loadAllCatalogGroups } from '@/lib/catalog';
import { BASIC_FLAVORS } from '@/lib/catalog-query';
import { volumeLabel } from '@/lib/catalog-drink-fields';
import { getCatalogDrink, listOwnCatalogDrinks, type CatalogDrinkStatus } from '@/lib/catalog-drinks';
import { getProductIngredients } from '@/lib/ingredients';
import { isUserBlocked } from '@/lib/moderation';
import { auth } from '@/lib/auth';
import { getGigaChat } from '@/lib/gigachat';
import { DIGEST_MIN_REVIEWS, DIGEST_SENTIMENT_LABELS } from '@/lib/review-digest-fields';
import { BUSINESS_REVIEW_SORTS, MAX_BUSINESS_MEMBERS, getBusinessAnalytics, getBusinessCards, getBusinessSearch, digestDue, getCabinet, listBusinessInvites, listBusinessMembers, listBusinessAudit, listDrinkDigests, refreshBusinessDigests, type BusinessRole, listBrandDrinks, listBusinessDrinks, listBusinessReviews, listReplyTemplates, type ReplyTemplate, type Business, type BusinessReview, type BusinessReviewSort, type BusinessReviewView, countReviewQueue, getOnboarding } from '@/lib/business';
import { historyWindow, BUSINESS_AUDIT_LABELS, BUSINESS_KINDS, BUSINESS_ROLES, BUSINESS_STATUS_LABELS, percentChange, sortRows, type BusinessStatus } from '@/lib/business-fields';
import { catalogGroupSlug } from '@/lib/catalog-query';
import { isTelegramPlaceholderEmail } from '@/lib/telegram-init-data';
import { getBrandProfile, listDrinkEdits, type DrinkEdit, type DrinkEditStatus } from '@/lib/brand-drink-edits';
import { FEATURE_LABELS, PLANS, effectivePlan, hasFeature, planFor, planInfo, rubles, type PlanFeature } from '@/lib/business-plans';
import { listPromoRequests, planUsage } from '@/lib/business-billing';
import { BusinessPricing, type PlanAction } from '@/components/business-pricing';
import { BusinessCompare } from '@/components/business-compare';
import { getCompetitors, type BrandMetrics } from '@/lib/business-competitors';
import { getCabinetListings, getMessages, getOrder, getOrders } from '@/lib/market';
import { ORDER_STATUS, formatPrice, type OrderStatus } from '@/lib/market-fields';
import { storeDrinkOptions } from '@/lib/store-catalog';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Кабинет бизнеса', robots: { index: false, follow: false } };

type Params = { section?: string; page?: string; size?: string; drink?: string; q?: string; sort?: string; status?: string; view?: string; created?: string; by?: string; dir?: string; order?: string; tab?: string; days?: string };
const number = new Intl.NumberFormat('ru-RU');
const longDay = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Moscow' });
const longDayTime = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' });
const shortDay = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', timeZone: 'Europe/Moscow' });
const TITLES: Record<BusinessSection, string> = { overview: 'Обзор', reviews: 'Отзывы', insights: 'Разбор нейросетью', search: 'Поиск', cards: 'Карточки', competitors: 'Конкуренты', brand: 'Бренд', drinks: 'Напитки', 'drink-edit': 'Правка карточки', 'new-drink': 'Новый напиток', market: 'Объявления', 'new-listing': 'Новое объявление', orders: 'Заказы и чаты', settings: 'Настройки', plan: 'Тариф и продвижение' };
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

function ReviewsTable({ items, templates, canReply, sortHref, sort }: { items: BusinessReview[]; templates: ReplyTemplate[]; canReply: boolean; sortHref?: (sort: BusinessReviewSort) => string; sort?: BusinessReviewSort }) {
  const sortable = (label: string, up: BusinessReviewSort, down: BusinessReviewSort) => sortHref
    ? <Link className="bc-th-sort" href={sortHref(sort === down ? up : down)} data-active={sort === up || sort === down || undefined}>{label}<svg width="10" height="14" viewBox="0 0 10 14" aria-hidden="true"><path d="M5 1 1 5h8L5 1Z" fill={sort === up ? 'currentColor' : 'none'} stroke="currentColor" /><path d="m5 13-4-4h8l-4 4Z" fill={sort === down ? 'currentColor' : 'none'} stroke="currentColor" /></svg></Link>
    : label;
  return <div className="bc-table-card"><table className="bc-table">
    <thead><tr><th>Автор</th><th>Напиток</th><th>Отзыв</th><th>{sortable('Дата', 'old', 'new')}</th><th>{sortable('Оценка', 'low', 'high')}</th><th><span className="sr-only">Действия</span></th></tr></thead>
    <tbody>{items.map((item, index) => <tr key={item.id}>
      <td><Person review={item} /></td>
      <td data-label="Напиток"><Link className="bc-link" href={`/catalog/${catalogGroupSlug(item.brand, item.flavor)}`}>{item.name}</Link></td>
      <td data-label="Отзыв" className="bc-cell-text"><span>{item.text}</span>{item.reply && <span className="bc-reply-preview"><b>Ваш ответ:</b> {item.reply.text}</span>}</td>
      <td data-label="Дата" className="bc-nowrap">{longDay.format(item.createdAt)}</td>
      <td data-label="Оценка"><ScorePill taste={item.taste} design={item.design} /></td>
      <td className="bc-cell-menu"><span className="bc-row-actions">{canReply && <BusinessReplyButton reviewId={item.id} author={item.authorName} drink={item.name} reply={item.reply?.text ?? null} templates={templates} next={items.slice(index + 1).find(other => !other.reply)?.id ?? null} />}<BusinessRowMenu label="Действия с отзывом" items={[
        { href: `/catalog/${catalogGroupSlug(item.brand, item.flavor)}#reviews`, label: 'Открыть напиток' },
        ...(item.author ? [{ href: `/profile/${item.author}`, label: 'Профиль автора' }] : []),
      ]} /></span></td>
    </tr>)}</tbody>
  </table></div>;
}

/** «N отзывов ждут ответа» on the overview: low ones first, a button straight into the queue. */
function ReplyQueueBanner({ queue }: { queue: { unanswered: number; lowUnanswered: number } }) {
  return <div className="bc-queue-banner">
    <span className="bc-kpi-icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z" /></svg></span>
    <div><strong>{number.format(queue.unanswered)} {plural(queue.unanswered, 'отзыв ждёт', 'отзыва ждут', 'отзывов ждут')} ответа</strong>
      <span className="bc-muted">{queue.lowUnanswered ? `Из них ${number.format(queue.lowUnanswered)} с низкой оценкой — с них лучше начать.` : 'Ответ компании виден всем под отзывом, а автор получает уведомление.'}</span></div>
    <Link className="bc-button" href={businessHref('reviews', { view: queue.lowUnanswered ? 'low' : 'unanswered' })}>Ответить</Link>
  </div>;
}

const plural = (count: number, one: string, few: string, many: string) => {
  const ones = count % 10, tens = count % 100;
  return ones === 1 && tens !== 11 ? one : ones >= 2 && ones <= 4 && (tens < 12 || tens > 14) ? few : many;
};

async function Overview({ business, canReply }: { business: Business; canReply: boolean }) {
  const [analytics, recent, templates, queue] = await Promise.all([getBusinessAnalytics(business.id), listBusinessReviews(business.id, { limit: 5 }), listReplyTemplates(business.id), countReviewQueue(business.id)]);
  if (!analytics.drinks) return <Empty title="Прикрепите напитки, чтобы увидеть аналитику" text="Аналитика считает только подтверждённые напитки компании." action={<Link className="bc-button" href={businessHref('drinks')}>Перейти к напиткам</Link>} />;
  const { reviews, brand } = analytics;
  const maxWeek = Math.max(1, ...reviews.weekly.map(item => item.count));
  const change = percentChange(reviews.last30, reviews.previous30);
  return <>
    {canReply && queue.unanswered > 0 && <ReplyQueueBanner queue={queue} />}
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
      {recent.items.length ? <ReviewsTable items={recent.items} templates={templates} canReply={canReply} /> : <Empty title="Отзывов пока нет" text="Как только участники оценят ваши напитки, отзывы появятся здесь." />}
    </section>
  </>;
}

async function Reviews({ business, params, canReply }: { business: Business; params: Params; canReply: boolean }) {
  const [drinks, analytics] = await Promise.all([listBusinessDrinks(business.id), getBusinessAnalytics(business.id)]);
  const approved = drinks.filter(item => item.status === 'approved');
  const selected = approved.find(item => catalogGroupSlug(item.brand, item.flavor) === params.drink);
  const sort = BUSINESS_REVIEW_SORTS.some(item => item.value === params.sort) ? params.sort as BusinessReviewSort : 'new';
  const size = SIZES.includes(Number(params.size)) ? Number(params.size) : 20;
  const page = Math.min(500, Math.max(1, parseInt(params.page ?? '1', 10) || 1));
  const q = (params.q ?? '').trim().slice(0, 80);
  const view: BusinessReviewView = params.view === 'unanswered' || params.view === 'low' ? params.view : 'all';
  const [{ items, total }, templates, queue] = await Promise.all([listBusinessReviews(business.id, { page, size, drink: selected, q, sort, view }), listReplyTemplates(business.id), countReviewQueue(business.id)]);
  const link = (over: Record<string, string | undefined>) => {
    const next = { view: view !== 'all' ? view : undefined, drink: selected ? params.drink : undefined, q: q || undefined, sort: sort !== 'new' ? sort : undefined, size: size !== 20 ? String(size) : undefined, ...over };
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
      <BusinessSegments label="Какие отзывы" items={[
        { href: link({ view: undefined, page: undefined }), label: 'Все', current: view === 'all', count: analytics.reviews.total },
        { href: link({ view: 'unanswered', page: undefined }), label: 'Без ответа', current: view === 'unanswered', count: queue.unanswered },
        { href: link({ view: 'low', page: undefined }), label: 'Низкие оценки', current: view === 'low', count: queue.low },
      ]} />
    </div>
    <div className="bc-toolbar is-inner">
      <form className="bc-search is-inline" action="/business/cabinet" role="search">
        <input type="hidden" name="section" value="reviews" />
        {view !== 'all' && <input type="hidden" name="view" value={view} />}
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
      <ReviewsTable items={items} templates={templates} canReply={canReply} sort={sort} sortHref={value => link({ sort: value !== 'new' ? value : undefined, page: undefined })} />
      <BusinessPagination page={page} size={size} total={total} sizes={SIZES} href={(to, perPage) => link({ page: to > 1 ? String(to) : undefined, size: perPage !== 20 ? String(perPage) : undefined })} />
    </div> : view === 'unanswered' && !q && !selected ? <Empty title="На все отзывы есть ответы" text="Новые отзывы появятся здесь — и в уведомлениях, если они включены." />
      : <Empty title={q ? 'Ничего не нашлось' : 'Отзывов пока нет'} text={q ? 'Попробуйте другое слово или сбросьте фильтр.' : approved.length ? 'Отзывы на подтверждённые напитки появятся здесь.' : 'Сначала прикрепите напитки компании.'} />}
  </>;
}

const SCOPE_LABELS: Record<string, string> = { catalog: 'Каталог', stores: 'Магазины', market: 'Маркет' };

/**
 * «Поиск»: anonymous searches on CanRush where the company's brands were in the results or in the query itself — how
 * many, by week, the most frequent queries, and queries that named a brand and found nothing.
 */
async function Search({ business, params }: { business: Business; params: Params }) {
  const days = historyWindow(params.days, planInfo(business).historyDays);
  const data = await getBusinessSearch(business.id, undefined, 20, days);
  const period = periodName(days);
  if (!data.brands.length) return <Empty title="Поиск появится с первым напитком" text="Считаем поиски, где в выдаче или в самом запросе был бренд ваших подтверждённых напитков." action={<Link className="bc-button" href={businessHref('drinks')}>Прикрепить напитки</Link>} />;
  const maxWeek = Math.max(1, ...data.weekly.map(item => item.count));
  const change = percentChange(data.total30, data.previous30);
  return <>
    <HistoryPicker section="search" days={days} business={business} />
    <div className="bc-kpis">
      <Kpi icon="search" value={number.format(data.total30)} delta={change} deltaLabel="%" label={`Поисков с вашим брендом за ${period}`} />
      <Kpi icon="catalog" value={number.format(data.shown30)} label="Бренд был в выдаче" />
      <Kpi icon="name" value={number.format(data.named30)} label="Бренд назвали в запросе" />
      <Kpi icon="miss" value={number.format(data.missed30)} label="Назвали, но ничего не нашли" />
    </div>
    <div className="bc-grid">
      <section className="bc-card" aria-labelledby="bc-search-weekly">
        <div className="bc-card-head"><h2 id="bc-search-weekly">Поиски по {days === 365 ? 'месяцам' : 'неделям'}</h2><span className="bc-muted">{days === 365 ? '12 месяцев' : '12 недель'}</span></div>
        <ol className="bc-chart">{data.weekly.map(item => <li key={item.week} title={`${days === 365 ? 'Месяц' : 'Неделя'} с ${shortDay.format(new Date(item.week))}: ${item.count}`}>
          <span style={bar(item.count / maxWeek)}>{item.count > 0 && <b>{item.count}</b>}</span><small>{shortDay.format(new Date(item.week))}</small>
        </li>)}</ol>
      </section>
      <section className="bc-card" aria-labelledby="bc-search-missed">
        <div className="bc-card-head"><h2 id="bc-search-missed">Искали и не нашли</h2><span className="bc-muted">{period}</span></div>
        {data.missed.length ? <ul className="bc-search-missed">{data.missed.map(item => <li key={item.query}><span>«{item.query}»</span><b>{item.count}</b></li>)}</ul>
          : <p className="bc-muted">Таких запросов нет — всё, что искали с вашим брендом, находилось.</p>}
        <p className="bc-muted bc-search-note">Запрос с названием бренда без результатов — спрос, который не встретил ни карточки, ни магазина, ни объявления.</p>
      </section>
    </div>
    <section aria-labelledby="bc-search-top" className="bc-stack">
      <div className="bc-section-head"><h2 id="bc-search-top">Частые запросы</h2><span className="bc-muted">{period} · обезличено</span></div>
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

const percent = (part: number, whole: number) => whole ? `${(part / whole * 100).toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%` : '—';

async function Cards({ business, params }: { business: Business; params: Params }) {
  const days = historyWindow(params.days, planInfo(business).historyDays);
  const data = await getBusinessCards(business.id, undefined, days);
  const period = periodName(days);
  if (!data.drinks) return <Empty title="Карточки появятся с первым напитком" text="Считаем просмотры страниц ваших подтверждённых напитков и переходы из них в магазины." action={<Link className="bc-button" href={businessHref('drinks')}>Прикрепить напитки</Link>} />;
  const maxWeek = Math.max(1, ...data.weekly.map(item => item.count));
  const sort = tableSort(params, 'cards');
  const items = sortRows(data.items, sort.by, sort.dir, {
    name: item => item.name, views: item => item.views, clicks: item => item.clicks, ctr: item => item.views ? item.clicks / item.views : -1,
  });
  const maxRetailer = Math.max(1, ...data.retailers.map(item => item.count));
  return <>
    <HistoryPicker section="cards" days={days} business={business} />
    <div className="bc-kpis">
      <Kpi icon="eye" value={number.format(data.views30)} delta={percentChange(data.views30, data.previousViews30)} deltaLabel="%" label={`Просмотров карточек за ${period}`} />
      <Kpi icon="tap" value={number.format(data.clicks30)} delta={percentChange(data.clicks30, data.previousClicks30)} deltaLabel="%" label="Переходов в магазины" />
      <Kpi icon="ratio" value={percent(data.clicks30, data.views30)} label="Конверсия просмотра в переход" />
      <Kpi icon="catalog" value={number.format(data.drinks)} label="Подтверждённых напитков" />
    </div>
    <div className="bc-grid">
      <section className="bc-card" aria-labelledby="bc-cards-weekly">
        <div className="bc-card-head"><h2 id="bc-cards-weekly">Просмотры по {days === 365 ? 'месяцам' : 'неделям'}</h2><span className="bc-muted">{days === 365 ? '12 месяцев' : '12 недель'}</span></div>
        <ol className="bc-chart">{data.weekly.map(item => <li key={item.week} title={`${days === 365 ? 'Месяц' : 'Неделя'} с ${shortDay.format(new Date(item.week))}: ${item.count} просмотров, ${item.clicks} переходов`}>
          <span style={bar(item.count / maxWeek)}>{item.count > 0 && <b>{item.count}</b>}</span><small>{shortDay.format(new Date(item.week))}</small>
        </li>)}</ol>
      </section>
      <section className="bc-card" aria-labelledby="bc-cards-stores">
        <div className="bc-card-head"><h2 id="bc-cards-stores">Куда переходят</h2><span className="bc-muted">{period}</span></div>
        {data.retailers.length ? <ul className="bc-cards-stores">{data.retailers.map(item => <li key={item.retailer} style={bar(item.count / maxRetailer)}><span>{item.retailer}</span><b>{number.format(item.count)}</b></li>)}</ul>
          : <p className="bc-muted">Переходов в магазины пока не было. Они появятся, когда участники начнут нажимать на цены в карточках.</p>}
        <p className="bc-muted bc-search-note">Переход — нажатие на цену магазина в карточке напитка. Акции Едадила без ссылки не считаются.</p>
      </section>
    </div>
    <section aria-labelledby="bc-cards-drinks" className="bc-stack">
      <div className="bc-section-head"><h2 id="bc-cards-drinks">По напиткам</h2><span className="bc-muted">{period} · обезличено</span></div>
      <div className="bc-table-card"><table className="bc-table">
        <thead><tr><th>{sort.th('Напиток', 'name')}</th><th>{sort.th('Просмотры', 'views')}</th><th>{sort.th('Переходы', 'clicks')}</th><th>{sort.th('Конверсия', 'ctr')}</th><th>Чаще в магазин</th></tr></thead>
        <tbody>{items.map(item => <tr key={`${item.brand}:${item.flavor}`}>
          <td><Link className="bc-drink" href={`/catalog/${catalogGroupSlug(item.brand, item.flavor)}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- local covers */}
            <span className="bc-drink-cover">{item.cover ? <img src={item.cover} alt="" loading="lazy" /> : '⚡'}</span>
            <span><strong>{item.name}</strong><small>{item.brand}</small></span>
          </Link></td>
          <td data-label="Просмотры">{number.format(item.views)}</td>
          <td data-label="Переходы">{number.format(item.clicks)}</td>
          <td data-label="Конверсия">{percent(item.clicks, item.views)}</td>
          <td data-label="Чаще в магазин">{item.retailer ?? <span className="bc-muted">—</span>}</td>
        </tr>)}</tbody>
      </table></div>
    </section>
  </>;
}

const periodName = (days: number) => days === 365 ? 'год' : `${days} дней`;

/** 30 days / 90 days / year: windows beyond the plan lead to «Тариф» with a lock. */
function HistoryPicker({ section, days, business }: { section: BusinessSection; days: number; business: Business }) {
  const max = planInfo(business).historyDays;
  return <div className="bc-toolbar is-inner"><nav className="bc-segments" aria-label="Период">{[30, 90, 365].map(value => value <= max
    ? <Link key={value} href={businessHref(section, value === 30 ? {} : { days: String(value) })} aria-current={value === days ? 'page' : undefined}>{value === 365 ? 'Год' : `${value} дней`}</Link>
    : <Link key={value} href={businessHref('plan')} className="bc-segment-locked" title={`Доступно в тарифе «${value === 365 ? 'Сеть' : 'Бренд'}»`}>{value === 365 ? 'Год' : `${value} дней`}<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg></Link>)}
  </nav></div>;
}

/** The comparison's columns; `best` marks the leader of a column (price is not a contest — cheaper is not better). */
// An average from a handful of answers is not a lead: scores need 3 reviews, the like share 10 swipes.
const COMPARE: { key: string; label: string; value: (item: BrandMetrics) => number | null; show: (item: BrandMetrics) => ReactNode; best: boolean; enough?: (item: BrandMetrics) => boolean }[] = [
  { key: 'drinks', label: 'Напитков в каталоге', value: item => item.drinks, show: item => number.format(item.drinks), best: true },
  { key: 'reviews', label: 'Отзывов', value: item => item.reviews, show: item => <>{number.format(item.reviews)}{item.reviews30 > 0 && <small> +{number.format(item.reviews30)} за период</small>}</>, best: true },
  { key: 'score', label: 'Оценка', value: item => item.score, show: item => item.score === null ? '—' : <span title={`Вкус ${decimal(item.taste)}, дизайн ${decimal(item.design)}`}>{decimal(item.score)}<small> вкус {decimal(item.taste)} · дизайн {decimal(item.design)}</small></span>, best: true, enough: item => item.reviews >= 3 },
  { key: 'likes', label: 'Лайки в дейтинге', value: item => item.likeShare, show: item => item.likeShare === null ? '—' : <>{Math.round(item.likeShare * 100)}%<small> из {number.format(item.swipes)} свайпов</small></>, best: true, enough: item => item.swipes >= 10 },
  { key: 'searches', label: 'Поиски', value: item => item.searches30, show: item => number.format(item.searches30), best: true },
  { key: 'views', label: 'Просмотры карточек', value: item => item.views30, show: item => number.format(item.views30), best: true },
  { key: 'clicks', label: 'Переходы в магазины', value: item => item.clicks30, show: item => number.format(item.clicks30), best: true },
  { key: 'price', label: 'Цена 0,5 л (медиана)', value: item => item.price500, show: item => item.price500 === null ? '—' : `${number.format(item.price500)} ₽`, best: false },
];

/**
 * «Конкуренты»: the company's brands against up to three picked catalog brands on the same numbers — reviews, scores,
 * dating swipes, searches, card views and store taps, price. The leader of each column is marked; the attention bar
 * shows each side's share of card views among the compared brands.
 */
async function Competitors({ business, params }: { business: Business; params: Params }) {
  const days = historyWindow(params.days, planInfo(business).historyDays);
  const data = await getCompetitors(business.id, days);
  const period = periodName(days);
  if (!data.own) return <Empty title="Сравнение появится с первым напитком" text="Сравниваем бренды ваших подтверждённых напитков с конкурентами из каталога." action={<Link className="bc-button" href={businessHref('drinks')}>Прикрепить напитки</Link>} />;
  const sides = [data.own, ...data.rivals];
  const leaders = Object.fromEntries(COMPARE.filter(column => column.best).map(column => {
    const values = sides.filter(item => column.enough?.(item) ?? true).map(column.value).filter((value): value is number => value !== null);
    const top = values.length ? Math.max(...values) : null;
    return [column.key, top !== null && top > 0 && sides.length > 1 ? top : null];
  }));
  const attention = sides.reduce((sum, item) => sum + item.views30, 0);
  return <>
    <HistoryPicker section="competitors" days={days} business={business} />
    <section className="bc-card" aria-labelledby="bc-competitors-pick">
      <div className="bc-card-head"><h2 id="bc-competitors-pick">С кем сравниваем</h2><span className="bc-muted">до {planInfo(business).competitors} брендов · видит вся команда</span></div>
      <CompetitorPicker picked={data.picked} options={data.options} suggested={data.suggested} max={planInfo(business).competitors} />
    </section>
    {data.rivals.length > 0 && <section className="bc-card" aria-labelledby="bc-competitors-attention">
      <div className="bc-card-head"><h2 id="bc-competitors-attention">Доля внимания</h2><span className="bc-muted">просмотры карточек · {period}</span></div>
      {attention ? <>
        <div className="bc-attention-bar" role="img" aria-label={sides.map(item => `${item.label}: ${Math.round(item.views30 / attention * 100)}%`).join(', ')}>
          {sides.map((item, index) => item.views30 > 0 && <span key={item.label} data-side={index} style={{ flexGrow: item.views30 }} />)}
        </div>
        <ul className="bc-attention-legend">{sides.map((item, index) => <li key={item.label} data-side={index}><i aria-hidden="true" />{item.own ? <b>{item.label}</b> : item.label}<span>{Math.round(item.views30 / attention * 100)}%</span></li>)}</ul>
      </> : <p className="bc-muted">За {period} карточки сравниваемых брендов ещё не открывали.</p>}
    </section>}
    <section aria-labelledby="bc-competitors-table" className="bc-stack">
      <div className="bc-section-head"><h2 id="bc-competitors-table">Сравнение</h2><span className="bc-muted">все напитки брендов · {period} · синим — лидер</span></div>
      {/* Wide screens: metrics as rows, the brands (at most four) as columns — the comparison reads across a line. */}
      <div className="bc-table-card bc-compare-matrix"><table>
        <thead><tr><th>Показатель</th>{sides.map(item => <th key={item.label} data-own={item.own || undefined}>{item.label}{item.own && <span className="bc-pill bc-search-named">вы</span>}</th>)}</tr></thead>
        <tbody>{COMPARE.map(column => <tr key={column.key}><th scope="row">{column.label}</th>
          {sides.map(item => { const value = column.value(item); return <td key={item.label} data-own={item.own || undefined} data-best={value !== null && value === leaders[column.key] && (column.enough?.(item) ?? true) || undefined}>{column.show(item)}</td>; })}
        </tr>)}</tbody>
      </table></div>
      <div className="bc-table-card bc-compare-cards"><table className="bc-table bc-compare">
        <thead><tr><th>Бренд</th>{COMPARE.map(column => <th key={column.key}>{column.label}</th>)}</tr></thead>
        <tbody>{sides.map(item => <tr key={item.label} data-own={item.own || undefined}>
          <td><strong>{item.label}</strong>{item.own && <span className="bc-pill bc-search-named">вы</span>}</td>
          {COMPARE.map(column => { const value = column.value(item); return <td key={column.key} data-label={column.label} data-best={value !== null && value === leaders[column.key] && (column.enough?.(item) ?? true) || undefined}><span className="bc-compare-value">{column.show(item)}</span></td>; })}
        </tr>)}</tbody>
      </table></div>
      {!data.rivals.length && <p className="bc-muted">Добавьте конкурента выше — и его числа встанут рядом с вашими.</p>}
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

async function Drinks({ business, params, userId, canAct }: { business: Business; params: Params; userId: string; canAct: boolean }) {
  const [drinks, options, requests, edits] = await Promise.all([listBusinessDrinks(business.id), storeDrinkOptions(), listOwnCatalogDrinks(userId), listDrinkEdits(business.id)]);
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
    {canAct && <section className="bc-card" aria-labelledby="bc-attach">
      <div className="bc-card-head"><h2 id="bc-attach">Прикрепить напиток из каталога</h2><span className="bc-muted">команда проверит, что он ваш</span></div>
      <BusinessDrinkRequest options={options} taken={drinks.map(item => JSON.stringify([item.brand, item.flavor]))} />
    </section>}
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
        <td className="bc-cell-menu">{canAct && <span className="bc-row-actions">
          {item.status === 'approved' && <Link className="bc-button is-outline" href={businessHref('drink-edit', { drink: catalogGroupSlug(item.brand, item.flavor) })}>Править карточку</Link>}
          <BusinessDrinkRemove brand={item.brand} flavor={item.flavor} /></span>}</td>
      </tr>)}</tbody>
    </table></div> : <Empty title={status ? 'Здесь пусто' : 'Напитков пока нет'} text={status ? 'Напитков с таким статусом нет.' : 'Найдите свои напитки в каталоге и прикрепите их.'} />}
    {requests.length > 0 && <DrinkRequests requests={requests} attached={new Set(drinks.filter(item => item.status !== 'rejected').map(item => JSON.stringify([item.brand, item.flavor])))} />}
    {edits.length > 0 && <DrinkEdits edits={edits} />}
  </>;
}

const EDIT_STATUS: Record<DrinkEditStatus, { label: string; tone: string }> = { pending: { label: 'На проверке', tone: 'mid' }, approved: { label: 'Опубликована', tone: 'good' }, rejected: { label: 'Отклонена', tone: 'bad' } };

/** The company's card edits with their status and, when rejected, the reason. */
function DrinkEdits({ edits }: { edits: DrinkEdit[] }) {
  return <section aria-labelledby="bc-edits" className="bc-stack">
    <div className="bc-section-head"><h2 id="bc-edits">Правки карточек</h2><span className="bc-muted">фото, название, состав и описание от бренда</span></div>
    <div className="bc-table-card"><table className="bc-table">
      <thead><tr><th>Напиток</th><th>Что меняли</th><th>Отправлена</th><th>Статус</th></tr></thead>
      <tbody>{edits.map(edit => <tr key={edit.id}>
        <td><strong>{edit.name}</strong>{edit.status === 'rejected' && edit.moderationNote && <small className="bc-note">Причина: {edit.moderationNote}</small>}</td>
        <td data-label="Что меняли">{[edit.hasPhoto && 'фото', edit.fullName && 'название', edit.ingredients && 'состав', edit.description && 'описание'].filter(Boolean).join(', ')}</td>
        <td data-label="Отправлена" className="bc-nowrap">{longDay.format(edit.createdAt)}{edit.author && <small className="bc-muted"> · @{edit.author}</small>}</td>
        <td data-label="Статус"><span className="bc-pill" data-tone={EDIT_STATUS[edit.status].tone}>{EDIT_STATUS[edit.status].label}</span></td>
      </tr>)}</tbody>
    </table></div>
  </section>;
}

/**
 * «Правка карточки» of one approved drink (`?drink=<slug>`): what the card shows now, the form for the brand's photo,
 * full name, composition and description. The team checks it before the catalog shows it.
 */
async function DrinkEditSection({ business, params, canAct }: { business: Business; params: Params; canAct: boolean }) {
  const drinks = (await listBusinessDrinks(business.id)).filter(item => item.status === 'approved');
  const drink = drinks.find(item => catalogGroupSlug(item.brand, item.flavor) === params.drink);
  if (!canAct) return <Empty title="Только для владельца и менеджеров" text="У роли «Аналитик» только просмотр." />;
  if (!drink) return <Empty title="Выберите напиток" text="Править можно подтверждённые напитки компании — кнопка «Править карточку» в разделе «Напитки»." action={<Link className="bc-button" href={businessHref('drinks')}>К напиткам</Link>} />;
  const [profile, ingredients, added, pending] = await Promise.all([
    getBrandProfile(drink.brand, drink.flavor), getProductIngredients(drink.brand, drink.flavor), getCatalogDrink(drink.brand, drink.flavor),
    listDrinkEdits(business.id).then(items => items.find(item => item.status === 'pending' && item.brand === drink.brand && item.flavor === drink.flavor)),
  ]);
  return <section className="bc-card bc-form-card">
    <div className="bc-card-head"><h2>{drink.name}</h2><Link className="bc-link" href={`/catalog/${catalogGroupSlug(drink.brand, drink.flavor)}`}>Открыть карточку</Link></div>
    {pending ? <FormAlert tone="warning" title="Правка уже на проверке">Отправлена {longDay.format(pending.createdAt)} — новую можно будет отправить после решения.</FormAlert>
      : <>
        <p className="bc-muted">Поля показывают то, что сейчас на карточке. Измените нужное — команда сверит с банкой и опубликует; на карточке появится «Данные подтверждены брендом».</p>
        <DrinkEditForm brand={drink.brand} flavor={drink.flavor} current={{
          fullName: profile?.fullName ?? added?.fullName ?? '', ingredients: profile?.ingredients ?? ingredients?.ingredients ?? added?.ingredients ?? '',
          description: profile?.description ?? '', cover: profile?.photo ?? drink.cover,
        }} />
      </>}
  </section>;
}

/** «Новый напиток» inside the cabinet: the catalog's step form; after moderation the drink is attached in one click. */
async function NewDrink({ verified }: { verified: boolean }) {
  const groups = await loadAllCatalogGroups();
  const brands = [...new Set(groups.map(group => group.brand.trim()).filter(brand => brand && brand.toLowerCase() !== 'unknown'))].sort((a, b) => a.localeCompare(b, 'ru'));
  const flavors = [...BASIC_FLAVORS].sort((a, b) => a.label.localeCompare(b.label, 'ru'));
  return <section className="bc-card bc-form-card">
    <div className="bc-card-head"><h2>Напиток, которого нет в каталоге</h2><span className="bc-muted">бренд, вкус, фото банки и объёмы</span></div>
    <p className="bc-muted">{verified
      ? 'Компания подтверждена: новый напиток появится в каталоге сразу, без модерации. Если похожий уже есть в каталоге или ждёт проверки, напиток уйдёт на проверку. Прикрепить его к компании — отдельная заявка.'
      : 'После проверки модератором напиток появится в каталоге, а в разделе «Напитки» — кнопка, чтобы прикрепить его к компании.'}</p>
    <CatalogDrinkForm brands={brands} flavors={flavors} inCabinet verified={verified} />
  </section>;
}

/** «Новое объявление» inside the cabinet: the market's step form; publishing returns to the listings. */
async function NewListing({ userId, business, asCompany }: { userId: string; business: Business; asCompany: boolean }) {
  const [groups, blocked] = await Promise.all([loadAllCatalogGroups(), isUserBlocked(userId)]);
  const brands = [...new Set(groups.map(group => group.brand).filter(brand => brand && brand.toLowerCase() !== 'unknown'))].sort((a, b) => a.localeCompare(b, 'ru'));
  return <section className="bc-card bc-form-card">
    <div className="bc-card-head"><h2>Объявление в маркете</h2><span className="bc-muted">пять шагов — и оно в маркете</span></div>
    {blocked ? <FormAlert>Публикация объявлений для этого аккаунта ограничена.</FormAlert> : <MarketListingForm brands={brands} inCabinet company={business.status === 'approved' && asCompany ? { name: business.name, logoId: business.logoId } : null} />}
  </section>;
}

async function Market({ userId, business, params }: { userId: string; business: Business; params: Params }) {
  const items = await getCabinetListings(userId, business.status === 'approved' ? business.id : null);
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
          <span><strong>{item.title}</strong><small>{item.businessName ? `От компании${item.sellerId === userId ? '' : ` · ${item.sellerName}`}` : 'Лично'}{item.brand ? ` · ${item.brand}` : ''}</small></span>
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
  { key: 'company', label: 'Компания' }, { key: 'team', label: 'Команда' }, { key: 'log', label: 'Журнал' }, { key: 'notifications', label: 'Уведомления' }, { key: 'theme', label: 'Оформление' }, { key: 'documents', label: 'Документы' },
] as const;
const DOCUMENTS = [
  { href: '/terms', title: 'Пользовательское соглашение', note: 'Правила CanRush для всех аккаунтов, и для компаний тоже' },
  { href: '/privacy', title: 'Политика обработки персональных данных', note: 'Какие данные мы храним и кому передаём' },
  { href: '/account-deletion', title: 'Удаление аккаунта', note: 'Как удалить аккаунт и что при этом происходит с данными' },
  { href: '/business/terms', title: 'Условия для бизнеса', note: 'Проверка, аналитика, ответы на отзывы, карточки и команда' },
  { href: '/business', title: 'CanRush для бизнеса', note: 'Что умеет кабинет и как подключаются компании' },
];

/** Settings: company and logo (the owner edits), the team, notifications and documents — tabs in the toolbar style. */
async function Settings({ business, role, userId, params }: { business: Business; role: BusinessRole; userId: string; params: Params }) {
  const owner = role === 'owner';
  // The log is for those who act for the company; an analyst only looks at the numbers.
  const shown = SETTINGS_TABS.filter(item => item.key !== 'log' || role !== 'analyst');
  const tab = shown.find(item => item.key === params.tab)?.key ?? 'company';
  const tabs = <div className="bc-toolbar is-inner"><BusinessSegments label="Настройки" items={shown.map(item => ({ href: businessHref('settings', item.key === 'company' ? {} : { tab: item.key }), label: item.label, current: item.key === tab }))} /></div>;
  if (tab === 'log') {
    if (!hasFeature(business, 'log')) return <>{tabs}<Upsell feature="log" /></>;
    const entries = await listBusinessAudit(business.id);
    return <>{tabs}
      <section aria-labelledby="bc-log" className="bc-stack">
        <div className="bc-section-head"><h2 id="bc-log">Журнал действий команды</h2><span className="bc-muted">последние 100 · видят владелец и менеджеры</span></div>
        {entries.length ? <div className="bc-table-card"><table className="bc-table">
          <thead><tr><th>Кто</th><th>Действие</th><th>Что</th><th>Когда</th></tr></thead>
          <tbody>{entries.map(entry => <tr key={entry.id}>
            <td><strong>{entry.actor}</strong>{entry.username && <small className="bc-muted"> @{entry.username}</small>}</td>
            <td data-label="Действие">{BUSINESS_AUDIT_LABELS[entry.action] ?? entry.action}</td>
            <td data-label="Что" className="bc-cell-text"><span>{entry.target ?? '—'}</span></td>
            <td data-label="Когда" className="bc-nowrap">{longDayTime.format(entry.createdAt)}</td>
          </tr>)}</tbody>
        </table></div> : <Empty title="Пока пусто" text="Здесь появятся ответы на отзывы, шаблоны, напитки, объявления и изменения команды." />}
      </section>
    </>;
  }
  if (tab === 'team') {
    const members = await listBusinessMembers(business.id);
    return <>{tabs}
      {owner ? <section className="bc-card"><div className="bc-card-head"><h2>Пригласить в команду</h2><span className="bc-muted">до {MAX_BUSINESS_MEMBERS} человек</span></div>
        <p className="bc-muted">Удобнее всего по рабочей почте: придёт письмо, а войдя с этой почтой, человек увидит приглашение в кабинете. Можно и по нику CanRush. Менеджер отвечает на отзывы и публикует от имени компании, аналитик только смотрит и выгружает отчёты; данные компании, логотип и команду меняете только вы. Роль можно сменить в таблице ниже.</p>
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
            <td data-label="Роль">{owner ? <span className="bc-role-cell"><BusinessMemberRole memberKey={member.key} role={member.role} />{member.status === 'pending' && <span className="bc-pill" data-tone="mid">Приглашён</span>}</span>
              : <span className="bc-pill" data-tone={member.status === 'active' ? 'good' : 'mid'}>{member.status === 'active' ? BUSINESS_ROLES.find(item => item.value === member.role)?.label : 'Приглашён'}</span>}</td>
            <td data-label="С нами с" className="bc-nowrap">{longDay.format(member.createdAt)}</td>
            <td className="bc-cell-actions">{owner && <BusinessMemberRemove memberKey={member.key} pending={member.status === 'pending'} />}</td>
          </tr>)}
        </tbody>
      </table></div>
    </>;
  }
  if (tab === 'notifications') {
    const disabled = (await getPool().query(`select 1 from "notificationPreference" where "userId" = $1 and kind = 'business-review' and not enabled`, [userId])).rowCount;
    const [optedOut, email] = await Promise.all([
      getPool().query(`select 1 from "businessReportOptOut" where "userId" = $1`, [userId]).then(result => Boolean(result.rowCount)),
      getPool().query<{ email: string }>(`select email from "user" where id = $1`, [userId]).then(result => result.rows[0]?.email ?? ''),
    ]);
    return <>{tabs}
      <section className="bc-card"><div className="bc-card-head"><h2>Уведомления кабинета</h2><span className="bc-muted">лично для вас</span></div>
        <BusinessNotificationsForm reviews={!disabled} />
        <WeeklyReportSwitch enabled={!optedOut} email={isTelegramPlaceholderEmail(email) ? null : email} />
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
    {business.status === 'rejected' && owner
      ? <section className="bc-card"><div className="bc-card-head"><h2>Компания</h2><span className="bc-muted">исправьте и отправьте снова</span></div>
        <BusinessForm apply initial={business} />
      </section>
      : <CompanySummary business={business} />}
  </>;
}

/**
 * The company as the team checked it: after applying the form is gone — on review and once approved the data is shown
 * read-only (`saveBusiness` refuses changes), a rejected company gets the form back to fix it.
 */
function CompanySummary({ business }: { business: Business }) {
  const rows = [
    ['Кто вы', BUSINESS_KINDS.find(item => item.value === business.kind)?.label ?? business.kind],
    ['Название', business.name],
    ['Сайт', business.website],
    ['Telegram', business.telegram ? `@${business.telegram}` : null],
    ['Почта для связи', business.contactEmail],
    ['О компании', business.about],
  ] as const;
  return <section className="bc-card"><div className="bc-card-head"><h2>Компания</h2><StatusPill status={business.status} /></div>
    <dl className="bc-company-data">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || <span className="bc-muted">не указано</span>}</dd></div>)}</dl>
    <p className="bc-muted">{business.status === 'pending'
      ? 'Заявка на проверке — обычно это пару дней. Мы напишем на почту, когда компанию подтвердят.'
      : <>Данные подтверждены командой CanRush. Чтобы их изменить, напишите на <a className="bc-link" href="mailto:hello@canrush.ru">hello@canrush.ru</a>.</>}</p>
  </section>;
}

/** «Купить» until the payment page exists: a letter to us with the company and the plan in the subject. */
const buyHref = (plan: 'brand' | 'network', company: string) =>
  `mailto:hello@canrush.ru?${new URLSearchParams({ subject: `Тариф «${PLANS[plan].title}» — ${company}`, body: `Хотим подключить или продлить тариф «${PLANS[plan].title}» для компании «${company}».` }).toString().replace(/\+/g, '%20')}`;

const PROMO_LABELS: Record<string, string> = { picks: '«Тебе понравится»', dating: 'Дейтинг напитков', catalog: 'Каталог', stories: 'Истории' };
const PROMO_STATUS: Record<string, { label: string; tone: string }> = {
  new: { label: 'Новая', tone: 'mid' }, contacted: { label: 'Связались', tone: 'mid' }, running: { label: 'Идёт', tone: 'good' }, done: { label: 'Завершено', tone: 'good' }, declined: { label: 'Отказ', tone: 'bad' },
};

/** A section the plan does not include: what it gives, from which plan, and the way to it. */
function Upsell({ feature }: { feature: PlanFeature }) {
  const plan = planFor(feature);
  return <div className="bc-upsell">
    <span className="bc-upsell-lock" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></svg></span>
    <div><span className="bc-pill" data-tone="good">Доступно в тарифе «{plan.title}»</span><h2>{FEATURE_LABELS[feature]}</h2>
      <p className="bc-muted">В тарифе «{plan.title}» — от {rubles(plan.monthly)} в месяц: {plan.features.map(item => FEATURE_LABELS[item].toLowerCase().replace('csv', 'CSV')).join(', ')}, команда до {plan.members} человек.</p></div>
    <Link className="bc-button" href={businessHref('plan')}>Выбрать тариф</Link>
  </div>;
}

/**
 * «Тариф и продвижение» in the manner of linear.app: the plan in force as a strip of hairline cells (the plan and its
 * term, then usage against the limits), the plans as on the landing (`BusinessPricing`: the owner's «Купить» writes to
 * us until the payment page exists), the full comparison folded away, and «Дополнительные услуги» — promotion
 * placements as columns with a request under them, and the requests sent.
 */
async function PlanSection({ business, role, canAct }: { business: Business; role: BusinessRole; canAct: boolean }) {
  const current = effectivePlan(business);
  const info = PLANS[current];
  const [usage, promos] = await Promise.all([planUsage(business.id), listPromoRequests(business.id)]);
  const approved = business.status === 'approved';
  const canBuy = role === 'owner' && approved;
  const limit = (value: number) => value === Infinity ? '∞' : String(value);
  const meter = (label: string, used: number, max: number) => <div key={label} className="bc-billing-cell">
    <dt>{label}</dt><dd><b>{used}</b><small> / {limit(max)}</small></dd>
    <i aria-hidden="true"><span style={{ width: `${max === Infinity ? 8 : Math.min(100, max ? used / max * 100 : 100)}%` }} data-over={used > max || undefined} /></i>
  </div>;
  const paid = (key: 'brand' | 'network'): PlanAction => key === current
    ? (canBuy ? { label: 'Продлить', href: buyHref(key, business.name) } : { label: 'Ваш тариф', current: true })
    : canBuy ? { label: 'Купить', href: buyHref(key, business.name) } : { note: approved ? 'Купить может владелец кабинета' : 'После проверки компании' };
  const term = current === 'start' ? 'Бесплатно навсегда' : business.planUntil ? `до ${longDay.format(business.planUntil)}` : 'Активен';
  return <>
    <section className="bc-billing" aria-label="Текущий тариф">
      <div className="bc-billing-now">
        <small>Текущий тариф</small>
        <h2>{info.title}</h2>
        <p>{term}</p>
      </div>
      <dl className="bc-billing-usage">
        {meter('Команда', usage.members, info.members)}
        {meter('Конкуренты', usage.competitors, info.competitors)}
        {meter('Бренды', usage.brands, info.brands)}
        <div className="bc-billing-cell"><dt>История</dt><dd><b>{info.historyDays === 365 ? 'год' : info.historyDays}</b>{info.historyDays !== 365 && <small> дней</small>}</dd></div>
      </dl>
      {business.founder && current === 'brand' && <p className="bc-billing-note">Вы среди первых компаний CanRush: «Бренд» бесплатно {term}</p>}
      {business.plan !== 'start' && current === 'start' && <p className="bc-billing-note">Срок тарифа «{PLANS[business.plan].title}» закончился — кабинет работает как «Старт», данные сохранены.</p>}
    </section>

    <section className="bc-pricing" aria-labelledby="plans-title">
      <header className="bc-pricing-head"><h2 id="plans-title">Тарифы</h2>
        <p>Оплата за год — два месяца в подарок. Тариф включается или продлевается после оплаты, автосписаний нет.</p></header>
      <BusinessPricing current={current} founder={business.founder} badges={{ [current]: 'Ваш тариф' }} actions={{
        start: current === 'start' ? { label: 'Ваш тариф', current: true } : { note: 'Включится сам, когда закончится срок платного тарифа' },
        brand: paid('brand'), network: paid('network'),
      }} />
      <details className="bc-pricing-compare"><summary>Сравнить все возможности</summary><BusinessCompare title="Сравнение тарифов" /></details>
    </section>

    <section className="bc-pricing" aria-labelledby="addons-title">
      <header className="bc-pricing-head"><h2 id="addons-title">Дополнительные услуги</h2>
        <p>Покажем ваш напиток тем, кому нравятся похожие вкусы. Размещение согласуем с вами и зарегистрируем в ОРД — с пометкой «Реклама», как требует закон.</p></header>
      <PromoAddons canOrder={canAct && approved} />
      {!(canAct && approved) && <p className="bc-muted">Заказать могут владелец и менеджеры подтверждённой компании.</p>}
      {promos.length > 0 && <div className="bc-addon-requests"><h3>Ваши заявки</h3>
        <ul>{promos.map(item => <li key={item.id}>
          <b>{PROMO_LABELS[item.placement] ?? item.placement}</b>
          <span>{rubles(item.budget)}</span>
          <small>{longDay.format(item.createdAt)}{item.erid ? ` · erid ${item.erid}` : ''}</small>
          <span className="bc-pill" data-tone={PROMO_STATUS[item.status]?.tone ?? 'mid'}>{PROMO_STATUS[item.status]?.label ?? item.status}</span>
        </li>)}</ul></div>}
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
  // An analyst looks: no replies, drink requests or publishing on the company's behalf.
  const canAct = role !== 'analyst';
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
    : section === 'plan' ? undefined
    : <>{approved && hasFeature(business, 'export') && <a className="bc-button is-outline" href={`/business/cabinet/export${section === 'search' || section === 'cards' || section === 'competitors' ? `?kind=${section}` : ''}`} download
        title={section === 'search' ? 'Частые запросы' : section === 'cards' ? 'Просмотры и переходы по напиткам' : section === 'competitors' ? 'Сравнение с конкурентами' : 'Все отзывы'}>Экспорт CSV</a>}
      {canAct && <Link className="bc-button" href={businessHref('drinks')}>Прикрепить напиток</Link>}</>;
  const toolbar = section === 'overview' || section === 'reviews' || section === 'insights' || section === 'search' || section === 'cards' || section === 'competitors' || section === 'brand'
    ? <BusinessSegments label="Аналитика" items={[
      { href: businessHref('overview'), label: 'Сводка', current: section === 'overview' },
      { href: businessHref('reviews'), label: 'Отзывы', current: section === 'reviews' },
      { href: businessHref('insights'), label: 'Разбор', current: section === 'insights' },
      { href: businessHref('search'), label: 'Поиск', current: section === 'search' },
      { href: businessHref('cards'), label: 'Карточки', current: section === 'cards' },
      { href: businessHref('competitors'), label: 'Конкуренты', current: section === 'competitors' },
      { href: businessHref('brand'), label: 'Бренд', current: section === 'brand' },
    ]} />
    : undefined;
  // A section beyond the plan shows what it gives and the way to the plan, not the data.
  const gated = (feature: PlanFeature, content: ReactNode) => hasFeature(business, feature) ? content : <Upsell feature={feature} />;
  const locked = (title: string) => <Empty title={title} text="Команда подтвердит компанию и её напитки — и здесь появятся отзывы, оценки и метрики бренда." action={<Link className="bc-button" href={businessHref('drinks')}>Прикрепить напитки</Link>} />;
  const waiting = approved ? (await countReviewQueue(business.id)).unanswered : 0;
  return <BusinessShell business={business} active={section} title={TITLES[section]} actions={actions} toolbar={toolbar} unread={counts?.notifications ?? 0} unreadMessages={counts?.messages ?? 0}
    badges={{ reviews: { count: waiting, label: `без ответа: ${waiting}` } }}>
    {business.status === 'pending' && <FormAlert tone="warning" title="Компания на проверке">Обычно это занимает пару дней. Пока можно прикрепить напитки и заполнить настройки — аналитика откроется после подтверждения.</FormAlert>}
    {business.status === 'rejected' && <FormAlert title="Компания не прошла проверку" actions={section !== 'settings' ? <Link className="bc-button is-outline" href={businessHref('settings')}>Исправить</Link> : undefined}>
      {business.moderationNote || 'Поправьте данные компании в настройках и отправьте снова.'}
    </FormAlert>}
    {section === 'overview' && <BusinessChecklist businessId={business.id} steps={await getOnboarding(business)} />}
    {section === 'overview' && (approved ? <Overview business={business} canReply={canAct} /> : locked('Аналитика появится после проверки'))}
    {section === 'reviews' && (approved ? <Reviews business={business} params={params} canReply={canAct} /> : locked('Отзывы появятся после проверки'))}
    {section === 'insights' && (!approved ? locked('Разбор появится после проверки') : gated('insights', <Insights business={business} />))}
    {section === 'search' && (!approved ? locked('Поиск появится после проверки') : gated('search', <Search business={business} params={params} />))}
    {section === 'cards' && (!approved ? locked('Аналитика карточек появится после проверки') : gated('cards', <Cards business={business} params={params} />))}
    {section === 'competitors' && (!approved ? locked('Сравнение с конкурентами появится после проверки') : gated('competitors', <Competitors business={business} params={params} />))}
    {section === 'plan' && <PlanSection business={business} role={role} canAct={canAct} />}
    {section === 'brand' && (approved ? <Brand business={business} params={params} /> : locked('Метрики бренда появятся после проверки'))}
    {section === 'drinks' && <Drinks business={business} params={params} userId={session.user.id} canAct={canAct} />}
    {section === 'drink-edit' && (approved ? <DrinkEditSection business={business} params={params} canAct={canAct} /> : locked('Править карточки можно после проверки'))}
    {section === 'new-drink' && <NewDrink verified={approved && canAct} />}
    {section === 'new-listing' && <NewListing userId={session.user.id} business={business} asCompany={canAct} />}
    {section === 'orders' && <Orders userId={session.user.id} params={params} />}
    {section === 'market' && <Market userId={session.user.id} business={business} params={params} />}
    {section === 'settings' && <Settings business={business} role={role} userId={session.user.id} params={params} />}
  </BusinessShell>;
}
