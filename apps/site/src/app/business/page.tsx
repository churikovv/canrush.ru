import '@/styles/shared.css';
import '@/styles/business-cabinet.css';
import '@/styles/business.css';
import type { Metadata } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import Image from 'next/image';
import { headers } from 'next/headers';
import { CITIES } from '@canrush/shared';
import { BrandShell } from '@/components/brand-shell';
import Link from '@/components/navigation-progress';
import { ProfileNavigation } from '@/components/profile-navigation';
import { BusinessIcon } from '@/components/business-shell';
import { Kpi } from '@/components/business-kpi';
import { ScoreRadar } from '@/components/score-radar';
import { BusinessStats, type BusinessStory } from '@/components/business-stats';
import { catalogRetailerName } from '@/lib/catalog-query';
import { getPool } from '@/db/pool';
import { auth } from '@/lib/auth';
import { loadAllCatalogGroups } from '@/lib/catalog';
import { isCountedCatalogDrink } from '@/lib/home-metrics';
import { seoMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = seoMetadata({
  title: 'CanRush для бизнеса',
  description: 'Кабинет для брендов энергетиков, дистрибьюторов и магазинов: аналитика отзывов и поиска, ответы от имени компании, разбор нейросетью, новые напитки в каталоге и продажи в маркете.',
  path: '/business',
});


const count = new Intl.NumberFormat('ru-RU');

/** Rounded down for the stats strip: «1 200+» reads as a fact, «1 237» as a counter. */
function rounded(value: number): { to: number; plus: boolean } {
  if (value < 100) return { to: value, plus: false };
  const step = value < 1000 ? 50 : value < 10_000 ? 100 : 1000;
  return { to: Math.floor(value / step) * step, plus: true };
}

const weeks = (rows: { week: string; count: number }[]) => {
  const counts = new Map(rows.map(row => [row.week, row.count]));
  const monday = new Date(); monday.setUTCHours(0, 0, 0, 0); monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  return Array.from({ length: 12 }, (_, index) => { const day = new Date(monday); day.setUTCDate(day.getUTCDate() - 7 * (11 - index)); return counts.get(day.toISOString().slice(0, 10)) ?? 0; });
};

/**
 * Live numbers for «CanRush сегодня»: each card's headline and the details under it — growth, activity, the share of
 * high scores, what is on sale now — straight from the database and the catalog (members without a nickname and
 * banned ones are left out, as everywhere).
 */
const pillOf = (value: number) => { const { to, plus } = rounded(value); return `${count.format(to)}${plus ? '+' : ''}`; };

async function stats(): Promise<BusinessStory[]> {
  const people = `u.username is not null and not exists(select 1 from "userBlock" b where b."userId" = u.id)`;
  const [row, signups, reviewWeeks, groups, added] = await Promise.all([
    getPool().query<{ members: number; new30: number; active30: number; calendar30: number; reviewers: number; reviews: number; reviews30: number; score: number | null; high: number; photos: number; replies: number; stores: number }>(
      `select (select count(*) from "user" u where ${people})::int as members,
         (select count(*) from "user" u where ${people} and u."createdAt" > now() - interval '30 days')::int as new30,
         (select count(*) from "user" u where ${people} and u."lastSeenAt" > now() - interval '30 days')::int as active30,
         (select count(distinct "userId") from "drinkLog" where day > current_date - 30)::int as calendar30,
         (select count(distinct "userId") from review)::int as reviewers,
         (select count(*) from review)::int as reviews,
         (select count(*) from review where "createdAt" > now() - interval '30 days')::int as reviews30,
         (select round(avg((taste + design) / 2.0)::numeric, 1)::float8 from review) as score,
         (select count(*) from review where taste + design >= 16)::int as high,
         (select count(distinct "reviewId") from "reviewPhoto")::int as photos,
         (select count(*) from "reviewCompanyReply")::int as replies,
         (select count(*) from "marketStore" where status = 'published')::int as stores`).then(result => result.rows[0]).catch(() => undefined),
    getPool().query<{ week: string; count: number }>(`select date_trunc('week', "createdAt")::date::text as week, count(*)::int as count from "user" u
      where ${people} and u."createdAt" > now() - interval '12 weeks' group by 1`).then(result => result.rows).catch(() => []),
    getPool().query<{ week: string; count: number }>(`select date_trunc('week', "createdAt")::date::text as week, count(*)::int as count from review
      where "createdAt" > now() - interval '12 weeks' group by 1`).then(result => result.rows).catch(() => []),
    loadAllCatalogGroups().catch(() => []),
    getPool().query<{ count: number }>(`select count(*)::int as count from "catalogDrink" where status = 'published'`).then(result => result.rows[0]?.count ?? 0).catch(() => 0),
  ]);
  const drinks = groups.filter(isCountedCatalogDrink);
  const onSale = drinks.filter(group => group.variants.length > 0).length;
  const retailers = new Set(drinks.flatMap(group => group.variants.map(catalogRetailerName))).size;
  const members = row?.members ?? 0, reviews = row?.reviews ?? 0;
  return [
    { key: 'members', icon: 'people', title: 'Участники', pill: pillOf(members),
      ring: members ? { value: (row?.active30 ?? 0) / members, label: 'заходили за месяц' } : null,
      left: { label: 'С профилем', ...rounded(members) }, right: { label: 'Новых за 30 дней', to: row?.new30 ?? 0, plus: false, prefix: '+' },
      visual: { kind: 'bars', values: weeks(signups), caption: 'Регистрации по неделям' },
      foot: [{ label: 'Отмечали банки', value: `${count.format(row?.calendar30 ?? 0)} за 30 дней` }, { label: 'Пишут отзывы', value: `${count.format(row?.reviewers ?? 0)} участников` }] },
    { key: 'reviews', icon: 'reviews', title: 'Отзывы', pill: pillOf(reviews),
      ring: reviews ? { value: (row?.high ?? 0) / reviews, label: 'оценок 8 и выше' } : null,
      left: { label: 'На напитки', ...rounded(reviews) }, right: { label: 'Средняя оценка', to: row?.score ?? 0, plus: false, decimals: 1, suffix: ' / 10' },
      visual: { kind: 'bars', values: weeks(reviewWeeks), caption: 'Отзывы по неделям' },
      foot: [{ label: 'За 30 дней', value: `${count.format(row?.reviews30 ?? 0)} новых` }, { label: 'С фото банки', value: count.format(row?.photos ?? 0) }] },
    { key: 'drinks', icon: 'can', title: 'Энергетики', pill: pillOf(drinks.length),
      ring: drinks.length ? { value: onSale / drinks.length, label: 'в продаже сейчас' } : null,
      left: { label: 'В каталоге', ...rounded(drinks.length) }, right: { label: 'Брендов', to: new Set(drinks.map(group => group.brand)).size, plus: false },
      visual: { kind: 'split', caption: 'Где их найти', parts: [
        { label: 'В магазинах', value: onSale }, { label: 'Архив', value: Math.max(0, drinks.length - onSale - added) }, { label: 'От участников', value: added }] },
      foot: [{ label: 'Цены', value: `${count.format(retailers)} сетей и магазинов` }, { label: 'Добавили участники', value: count.format(added) }] },
    { key: 'cities', icon: 'city', title: 'Города', pill: String(CITIES.length), ring: null,
      left: { label: 'С ценами', to: CITIES.length, plus: false }, right: { label: 'Сетей', to: retailers, plus: false },
      visual: { kind: 'chips', caption: 'Где сравнивают цены', items: CITIES.slice(0, 6).map(city => city.name), more: Math.max(0, CITIES.length - 6) },
      foot: [{ label: 'Обновление', value: 'каждый день' }, { label: 'Магазины от участников', value: `${count.format(row?.stores ?? 0)} на карте` }] },
  ];
}

/**
 * A chapter of the landing in the manner of linear.app: a hairline across the page, «1.0 Аналитика» as the kicker, a
 * big heading with its lead on the left and a link, a wide frame with the cabinet's screens (example data) fading at
 * the bottom, and the chapter's capabilities as a two-column list whose «+» opens a line about each.
 */
function Chapter({ id, number, kicker, title, lead, link, screens, items }: {
  id: string; number: string; kicker: string; title: ReactNode; lead: ReactNode; link: { href: string; label: string };
  screens: ReactNode[]; items: [title: string, text: string][];
}) {
  const half = Math.ceil(items.length / 2);
  return <section className="biz-chapter" id={id} aria-labelledby={`${id}-title`}>
    <div className="biz-chapter-head">
      <p className="biz-kicker"><b>{number}</b>{kicker}</p>
      <h2 id={`${id}-title`}>{title}</h2>
      <div className="biz-chapter-lead"><p>{lead}</p><Link className="biz-more" href={link.href}>{link.label}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg></Link></div>
    </div>
    <div className="biz-frame" aria-hidden="true" data-count={screens.length}>{screens.map((screen, index) => <div key={index} className="biz-frame-screen">{screen}</div>)}</div>
    <div className="biz-caps">
      <p className="biz-caps-title">Возможности</p>
      {[items.slice(0, half), items.slice(half)].map((column, index) => <ul key={index}>{column.map(([name, text]) => <li key={name}>
        <details><summary>{name}<span className="biz-caps-plus" aria-hidden="true" /></summary><p>{text}</p></details>
      </li>)}</ul>)}
    </div>
  </section>;
}

/** Line art for the three principles: thin strokes in the muted ink, one detail in the brand blue. */
const ART = {
  verified: <svg viewBox="0 0 200 140" fill="none" strokeLinejoin="round">
    {[0, 1, 2].map(index => <g key={index} transform={`translate(${46 + index * 38} ${28 - index * 6})`}>
      <path d="M0 14 6 0h28l6 14v74a8 8 0 0 1-8 8H8a8 8 0 0 1-8-8Z" className="biz-art-line" />
      <path d="M0 30h40M0 70h40" className="biz-art-line is-faint" />
    </g>)}
    <circle cx="150" cy="96" r="22" className="biz-art-accent-fill" /><path d="m140 96 7 7 14-15" className="biz-art-check" />
  </svg>,
  live: <svg viewBox="0 0 200 140" fill="none" strokeLinejoin="round">
    <path d="M24 118h152" className="biz-art-line" />
    {[30, 52, 40, 70, 58, 86, 74, 100].map((height, index) => <rect key={index} x={30 + index * 18} y={118 - height} width="10" height={height} rx="3" className={index === 7 ? 'biz-art-accent' : 'biz-art-line'} />)}
    <path d="M30 70c30-10 50 8 76-14s44-14 64-34" className="biz-art-line is-dashed" />
  </svg>,
  voice: <svg viewBox="0 0 200 140" fill="none" strokeLinejoin="round" strokeLinecap="round">
    <path d="M30 26h96a10 10 0 0 1 10 10v34a10 10 0 0 1-10 10H62l-20 16V80H30a10 10 0 0 1-10-10V36a10 10 0 0 1 10-10Z" className="biz-art-line" />
    <path d="M38 44h66M38 58h44" className="biz-art-line is-faint" />
    <path d="M86 70h84a10 10 0 0 1 10 10v28a10 10 0 0 1-10 10h-8v14l-18-14H86a10 10 0 0 1-10-10V80a10 10 0 0 1 10-10Z" className="biz-art-accent" />
    <path d="M92 88h60M92 100h36" className="biz-art-accent-text" />
  </svg>,
};

function Principle({ art, title, children }: { art: keyof typeof ART; title: string; children: ReactNode }) {
  return <li className="biz-principle"><div className="biz-principle-art" aria-hidden="true">{ART[art]}</div><strong>{title}</strong><p>{children}</p></li>;
}

const bar = (value: number) => ({ '--v': value }) as CSSProperties;
const THUMB = 'M7 10.5v9.5H4v-9.5zM7 10.5l3.6-6.6c1.5 0 2.5 1.2 2.2 2.6l-.6 3.5h6.1a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 17.1 20H7';
const Icon = ({ d, flip }: { d: string; flip?: boolean }) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d={d} transform={flip ? 'rotate(180 12 12)' : undefined} /></svg>;

/** A small radar like the cabinet's «Профиль оценок»: the drink (filled) against the catalog average (dashed). */
function MiniRadar({ drink, catalog }: { drink: number[]; catalog: number[] }) {
  const point = (value: number, index: number, total: number) => {
    const angle = -Math.PI / 2 + index * 2 * Math.PI / total;
    return `${Math.round((60 + Math.cos(angle) * 48 * value) * 10) / 10},${Math.round((60 + Math.sin(angle) * 48 * value) * 10) / 10}`;
  };
  const shape = (values: number[]) => values.map((value, index) => point(value, index, values.length)).join(' ');
  return <svg className="biz-radar" viewBox="0 0 120 120">
    {[1, .66, .33].map(level => <polygon key={level} points={shape(drink.map(() => level))} className="biz-radar-grid" />)}
    <polygon points={shape(catalog)} className="biz-radar-catalog" />
    <polygon points={shape(drink)} className="biz-radar-drink" />
  </svg>;
}

const HERO_WEEKS = [4, 5, 4, 6, 5, 7, 6, 8, 7, 9, 8, 11];
const HERO_DAYS = ['4 авг.', '11 авг.', '18 авг.', '25 авг.', '1 сент.', '8 сент.', '15 сент.', '22 сент.', '29 сент.', '6 окт.', '13 окт.', '20 окт.'];
const HERO_REVIEWS: [name: string, nick: string, drink: string, text: string, taste: number, design: number, date: string][] = [
  ['Алина', 'alina_energy', 'Манго', 'Сочный, не приторный — беру второй раз подряд.', 9, 8, '27 октября 2026 г.'],
  ['Денис', 'den_cans', 'Классический', 'Банка огонь, вкус как в детстве.', 9, 9, '26 октября 2026 г.'],
  ['Мира', 'mira.k', 'Без сахара', 'Газа маловато, но послевкусие приятное.', 7, 6, '24 октября 2026 г.'],
  ['Саша', 'sasha_rush', 'Ягодный', 'Лучший в линейке, жду большую банку.', 10, 9, '23 октября 2026 г.'],
];
const HERO_NAV = [
  { label: 'Аналитика', icon: 'chart' as const, items: ['Отзывы', 'Разбор нейросетью', 'Поиск', 'Карточки', 'Конкуренты', 'Бренд'] },
  { label: 'Каталог', icon: 'can' as const, items: ['Напитки', 'Новый напиток'] },
  { label: 'Продажи', icon: 'bag' as const, items: ['Объявления', 'Новое объявление', 'Заказы и чаты'] },
];

/**
 * The hero's picture: the cabinet's «Обзор» built from the cabinet's own markup and styles (`.bc-*` from
 * business-cabinet.css, the shared `Kpi`, `BusinessIcon`, `ScoreRadar`) with example data, so it looks exactly like the
 * product. Inert and hidden from assistive tech — a picture, not a page. On phones the sidebar folds away; on desktop
 * it grows past the page column and fades out at the bottom. The mascot peeks over its corner.
 */
function HeroCabinet() {
  const score = (taste: number, design: number) => (taste + design) / 2;
  return <div className="biz-showcase" aria-hidden="true">
    <span className="biz-glow" />
    <Image className="biz-showcase-mascot" src="/brand/home/business.png" width={443} height={480} alt="" priority sizes="(max-width: 639px) 96px, 190px" />
    <div className="biz-screen">
      <div className="bc-root biz-real" inert>
        <div className="bc-sidebar-wrap"><aside className="bc-sidebar">
          <span className="bc-brand"><span className="bc-brand-mark" /><strong>CanRush</strong><small>Бизнес</small></span>
          <span className="bc-search"><BusinessIcon name="search" size={18} /><span className="biz-real-placeholder">Поиск…</span><span className="bc-kbd"><kbd>⌘</kbd><kbd>K</kbd></span></span>
          <nav className="bc-nav">
            <a className="bc-nav-top" aria-current="page"><BusinessIcon name="home" /><span>Обзор</span></a>
            {HERO_NAV.map(group => <details key={group.label} className="bc-nav-group" open>
              <summary><BusinessIcon name={group.icon} /><span>{group.label}</span><span className="bc-caret"><BusinessIcon name="chevron" size={16} /></span></summary>
              <div className="bc-nav-items">{group.items.map(item => <a key={item}>{item}{item === 'Отзывы' && <span className="bc-nav-badge">3</span>}</a>)}</div>
            </details>)}
          </nav>
          <div className="bc-workspace biz-real-workspace">
            <span className="bc-workspace-logo">ЭЛ</span>
            <span className="bc-workspace-text"><strong>Energy Lab</strong><small>Бренд</small></span>
            <span className="bc-workspace-chevron"><BusinessIcon name="chevron" size={16} /></span>
          </div>
        </aside></div>
        <div className="bc-main">
          <header className="bc-topbar">
            <h1>Обзор</h1>
            <div className="bc-topbar-actions">
              <span className="bc-icon-button"><BusinessIcon name="chat" /></span>
              <span className="bc-icon-button"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg><span className="bc-dot" /></span>
              <span className="bc-topbar-divider" />
              <span className="bc-button is-outline">Экспорт CSV</span>
              <span className="bc-button">Прикрепить напиток</span>
            </div>
          </header>
          <div className="bc-toolbar"><nav className="bc-segments">{['Сводка', 'Отзывы', 'Разбор', 'Поиск', 'Карточки', 'Конкуренты', 'Бренд'].map((item, index) => <a key={item} aria-current={index === 0 ? 'page' : undefined}>{item}</a>)}</nav></div>
          <div className="bc-content">
            <div className="bc-queue-banner">
              <span className="bc-kpi-icon"><BusinessIcon name="chat" /></span>
              <div><strong>3 отзыва ждут ответа</strong><span className="bc-muted">Из них 1 с низкой оценкой — с него лучше начать.</span></div>
              <span className="bc-button">Ответить</span>
            </div>
            <div className="bc-kpis">
              <Kpi icon="reviews" value="248" delta={31} label="Отзывов на ваши напитки" />
              <Kpi icon="taste" value="8,4" label="Средняя оценка вкуса" />
              <Kpi icon="design" value="7,9" label="Средняя оценка дизайна" />
              <Kpi icon="heart" value="1 126" delta={142} label="Лайков бренда в дейтинге" />
            </div>
            <div className="bc-grid">
              <section className="bc-card">
                <div className="bc-card-head"><h2>Отзывы по неделям</h2><span className="bc-muted">+24% к прошлым 30 дням</span></div>
                <ol className="bc-chart">{HERO_WEEKS.map((value, index) => <li key={index} style={{ '--i': index } as CSSProperties}>
                  <span style={bar(value / 11)}><b>{value * 3}</b></span><small>{HERO_DAYS[index]}</small>
                </li>)}</ol>
              </section>
              <section className="bc-card">
                <div className="bc-card-head"><h2>Профиль оценок</h2><span className="bc-muted">в процентах, 100 — максимум</span></div>
                <ScoreRadar yours={{ taste: 84, design: 79, high: 62, liked: 71, returning: 38 }} catalog={{ taste: 72, design: 70, high: 44, liked: 58, returning: 27 }} label="Ваши напитки" />
              </section>
            </div>
            <section className="bc-stack">
              <div className="bc-section-head"><h2>Последние отзывы</h2><span className="bc-button is-outline">Все отзывы</span></div>
              <div className="bc-table-card"><table className="bc-table">
                <thead><tr><th>Автор</th><th>Напиток</th><th>Отзыв</th><th>Дата</th><th>Оценка</th><th><span className="sr-only">Действия</span></th></tr></thead>
                <tbody>{HERO_REVIEWS.map(([name, nick, drink, text, taste, design, date]) => <tr key={nick}>
                  <td><span className="bc-person"><span className="bc-person-initial">{name.slice(0, 1)}</span><span><strong>{name}</strong><small>@{nick}</small></span></span></td>
                  <td data-label="Напиток"><span className="bc-link">Energy Lab · {drink}</span></td>
                  <td data-label="Отзыв" className="bc-cell-text"><span>{text}</span></td>
                  <td data-label="Дата" className="bc-nowrap">{date}</td>
                  <td data-label="Оценка"><span className="bc-pill" data-tone={score(taste, design) >= 8 ? 'good' : score(taste, design) >= 5 ? 'mid' : 'bad'}>{score(taste, design).toLocaleString('ru-RU')}</span></td>
                  <td className="bc-cell-menu"><span className="bc-row-actions"><span className="bc-button bc-reply-button">Ответить</span></span></td>
                </tr>)}</tbody>
              </table></div>
            </section>
          </div>
        </div>
      </div>
    </div>
    <span className="biz-showcase-note">Пример данных</span>
  </div>;
}

/**
 * «CanRush для бизнеса»: the landing for brands, distributors and shops. Every feature block describes what the cabinet
 * already does (its screens are drawn in the cabinet's look, with example data, and say so); what is not built yet
 * sits apart under «Скоро». The numbers in the strip are live. The hero is centred like a product page: a «Новое» pill,
 * the headline, the actions and the cabinet's overview under a glow, entering in a short stagger (CSS only, so it plays
 * before hydration; still under `prefers-reduced-motion`).
 */
export default async function BusinessPage() {
  const [session, numbers] = await Promise.all([auth.api.getSession({ headers: await headers() }), stats()]);
  const start = session ? { href: '/business/cabinet', label: 'Открыть кабинет' } : { href: '/sign-in?for=business', label: 'Начать бесплатно' };
  const cta = (secondary?: boolean) => <Link className={`biz-button${secondary ? ' is-light' : ''}`} href={start.href}>{start.label}</Link>;
  return <BrandShell headerAction={<ProfileNavigation active="business" />}>
    <div className="biz">
      <header className="biz-hero">
        <a className="biz-pill" href="#replies"><span className="biz-pill-tag">Новое</span>Ответы на отзывы и шаблоны<svg className="biz-pill-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg></a>
        <h1>Ваш энергетик&nbsp;— <span>там, где его выбирают</span></h1>
        <p className="biz-lead">Кабинет для брендов, дистрибьюторов и магазинов: что говорят о ваших напитках, как их ищут и сравнивают с конкурентами — и ответы покупателям от имени бренда.</p>
        <div className="biz-actions">
          <Link className="biz-button biz-cta" href={start.href}>Начать бесплатно<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg></Link>
        </div>
        <HeroCabinet />
      </header>

      <section className="biz-numbers" aria-labelledby="biz-numbers-title">
        <div className="biz-numbers-head"><h2 id="biz-numbers-title">CanRush сегодня</h2><span className="biz-live"><i aria-hidden="true" />живые данные</span></div>
        <BusinessStats stories={numbers} />
      </section>

      <ul className="biz-principles" aria-label="Почему CanRush">
        <Principle art="verified" title="Только ваши напитки">Проверяем компанию и каждый её напиток вручную — аналитику по бренду видит только его настоящий владелец.</Principle>
        <Principle art="live" title="Живые и обезличенные данные">Отзывы, поиски, просмотры и свайпы участников — без имён, аккаунтов и адресов. Обновляются сами.</Principle>
        <Principle art="voice" title="Голос бренда">Отвечайте покупателям, правьте карточки и выпускайте новинки — от имени компании, с её логотипом.</Principle>
      </ul>

      <div className="biz-chapters" id="features">
        <Chapter id="analytics" number="1.0" kicker="Аналитика" title={<>Как оценивают<br />и ищут ваши напитки</>}
          lead="Отзывы и оценки, поиски с вашим брендом, просмотры карточек и переходы в магазины — и всё это рядом с конкурентами."
          link={{ href: start.href, label: 'Открыть аналитику' }}
          screens={[
            <div key="reviews" className="biz-card">
              <div className="biz-card-row"><strong>Отзывы</strong><small>30 дней</small></div>
              <div className="biz-kpis"><div><b>48</b><small>за 30 дней</small><i>+20%</i></div><div><b>8,4</b><small>вкус</small></div><div><b>7,9</b><small>дизайн</small></div></div>
              <div className="biz-card-split"><div className="biz-spark">{[3, 4, 3.5, 5, 4.5, 6, 5.5, 7, 6.5, 8, 7.5, 9].map((value, index) => <span key={index} style={bar(value / 9)} />)}</div><MiniRadar drink={[.84, .79, .72, .6, .55]} catalog={[.7, .68, .5, .45, .4]} /></div>
            </div>,
            <div key="search" className="biz-card">
              <div className="biz-card-row"><strong>Частые запросы</strong><small>30 дней</small></div>
              <ul className="biz-queries">{[['ваш бренд манго', '124'], ['манго без сахара', '86'], ['ваш бренд цена', '41']].map(([query, value]) => <li key={query}><span>«{query}»</span><b>{value}</b></li>)}</ul>
              <div className="biz-missed"><small>Искали и не нашли</small><span>«ваш бренд юдзу» · 12</span></div>
            </div>,
            <div key="rivals" className="biz-card">
              <div className="biz-card-row"><strong>Доля внимания</strong><small>просмотры карточек</small></div>
              <div className="biz-share"><span style={{ flexGrow: 41 }} /><span style={{ flexGrow: 33 }} /><span style={{ flexGrow: 26 }} /></div>
              <ul className="biz-lineup">{[['Ваш бренд', '8,4', .82], ['Конкурент 1', '7,9', .66], ['Конкурент 2', '7,1', .52]].map(([name, score, share]) => <li key={name as string}>
                <span className="biz-can is-small" /><strong>{name}</strong><span className="biz-like"><span style={bar(share as number)} /></span><b>{score}</b></li>)}</ul>
            </div>,
          ]}
          items={[
            ['Отзывы и оценки', 'Все отзывы на подтверждённые напитки: оценки вкуса и дизайна, динамика по неделям, профиль оценок против среднего по каталогу.'],
            ['Поиск', 'Сколько раз бренд был в выдаче и сколько раз его назвали в запросе — обезличенно, по каталогу, магазинам и маркету.'],
            ['Искали и не нашли', 'Запросы с вашим брендом, по которым ничего не нашлось: спрос, который пока никто не закрыл.'],
            ['Карточки', 'Просмотры страниц ваших напитков, переходы к магазинам и конверсия — по каждому напитку и по сетям.'],
            ['Конкуренты', 'До трёх брендов рядом с вашими: отзывы, оценки, свайпы, поиски, просмотры и цена за 0,5 л.'],
            ['Отчёт на почту', 'По понедельникам: итоги недели против прошлой, свежие отзывы и сравнение с конкурентами.'],
            ['Экспорт CSV', 'Отзывы, поиски, карточки и сравнение — одной кнопкой в Excel.'],
          ]} />

        <Chapter id="replies" number="2.0" kicker="Работа с отзывами" title={<>Слышите покупателей —<br />и отвечаете им</>}
          lead="Нейросеть собирает, что хвалят и на что жалуются. Вы отвечаете от имени бренда — с логотипом и отметкой «Компания»."
          link={{ href: start.href, label: 'Ответить на отзыв' }}
          screens={[
            <div key="insights" className="biz-card">
              <div className="biz-card-head"><span className="biz-can" /><div><strong>Ваш бренд · Манго</strong><small>по 48 отзывам</small></div></div>
              <div className="biz-insight" data-tone="brand"><p><span><Icon d={THUMB} /></span>Хвалят</p><div className="biz-chips"><span>Сочный вкус</span><span>Не приторный</span><span>Яркая банка</span></div></div>
              <div className="biz-insight" data-tone="muted"><p><span><Icon d={THUMB} flip /></span>Жалуются</p><div className="biz-chips"><span>Мало газа</span><span>Нет в Магните</span></div></div>
            </div>,
            <div key="reply" className="biz-card">
              <div className="biz-review"><span className="biz-avatar">М</span><div><strong>maks_energy</strong><p>Вкус топ, но в Магните третью неделю нет</p></div></div>
              <div className="biz-review is-brand"><span className="biz-avatar is-brand">B</span><div><strong>Ваш бренд <i>Компания</i></strong><p>Спасибо! Поставки в Магнит вернутся на следующей неделе.</p></div></div>
              <div className="biz-chips is-templates"><span>Шаблон: Спасибо</span><span>Шаблон: Где купить</span></div>
            </div>,
          ]}
          items={[
            ['Разбор нейросетью', 'Выжимка по каждому напитку: хвалят, жалуются, что сделать. Обновляется сама, когда приходят новые отзывы.'],
            ['Ответы от имени компании', 'Ответ стоит под отзывом с логотипом, автор получает уведомление. Удалить чужой отзыв нельзя — только ответить.'],
            ['Шаблоны ответов', 'Сохраняйте частые ответы для всей команды: имя автора и напиток подставятся сами.'],
            ['Очередь «Без ответа»', 'Неотвеченные и низкие отзывы отдельно, счётчик в меню и «Опубликовать и к следующему».'],
            ['Уведомления', 'О новых отзывах — на сайте, в Telegram и в приложении.'],
          ]} />

        <Chapter id="catalog" number="3.0" kicker="Каталог и продажи" title={<>Вся линейка —<br />и новинки в день запуска</>}
          lead="Как оценивают и свайпают каждый вкус, правильные фото и состав на карточках, а лимитки — напрямую покупателям в маркете."
          link={{ href: start.href, label: 'Добавить напиток' }}
          screens={[
            <div key="lineup" className="biz-card">
              <div className="biz-card-row"><strong>Линейка бренда</strong><small>оценка · свайпы</small></div>
              <ul className="biz-lineup">{[['Манго', '8,4', .78], ['Классика', '8,1', .7], ['Без сахара', '7,6', .61], ['Юдзу', '7,2', .52]].map(([name, score, likes]) => <li key={name as string}>
                <span className="biz-can is-small" /><strong>{name}</strong><span className="biz-like"><span style={bar(likes as number)} /></span><b>{score}</b></li>)}</ul>
            </div>,
            <div key="new" className="biz-card">
              <div className="biz-card-head"><span className="biz-can is-new" /><div><strong>Ваш бренд · Юдзу</strong><small>330 и 450 мл · без сахара</small></div></div>
              <ol className="biz-steps-mini"><li className="is-done">Заявка</li><li className="is-done">Компания подтверждена</li><li className="is-current">В каталоге</li></ol>
            </div>,
            <div key="market" className="biz-card">
              <div className="biz-card-head"><span className="biz-can" /><div><strong>Лимитка · 12 банок</strong><small>от компании · 149 ₽ за банку</small></div></div>
              <div className="biz-order"><span className="biz-status">Новый заказ</span><span>3 банки · Москва</span></div>
              <div className="biz-order"><span className="biz-status is-done">Завершён</span><span>6 банок · Казань</span></div>
            </div>,
          ]}
          items={[
            ['Линейка бренда', 'Все вкусы бренда из каталога: средняя оценка, число отзывов и свайпы в дейтинге.'],
            ['Новые напитки', 'Подтверждённая компания добавляет новинку сразу, без модерации — она попадает в тирлисты, дейтинг и рекомендации.'],
            ['Правки карточек', 'Фото банки, полное название, состав и описание от бренда — с пометкой «Данные подтверждены брендом».'],
            ['Объявления от компании', 'Лимитки и наборы в маркете с вашим названием и логотипом, остаток резервируется под заказ.'],
            ['Заказы и чаты', 'Переписка с покупателями прямо в кабинете. Оплата и доставка — напрямую, CanRush не берёт платежи.'],
          ]} />

        <Chapter id="team" number="4.0" kicker="Команда" title={<>Кабинет на всю<br />команду</>}
          lead="Владелец приглашает коллег и раздаёт роли, журнал показывает, кто что сделал, а первые шаги подскажут, с чего начать."
          link={{ href: start.href, label: 'Пригласить команду' }}
          screens={[
            <div key="team" className="biz-card">
              <div className="biz-card-row"><strong>Команда</strong><small>3 из 10</small></div>
              <ul className="biz-members">{[['В', 'Вы', 'Владелец'], ['А', 'Анна', 'Менеджер'], ['М', 'Максим', 'Аналитик']].map(([letter, name, role], index) => <li key={name}>
                <span className={`biz-avatar${index === 0 ? ' is-brand' : ''}`}>{letter}</span><strong>{name}</strong><span className="biz-status">{role}</span></li>)}</ul>
              <span className="biz-invite">+ Пригласить по почте</span>
            </div>,
            <div key="log" className="biz-card">
              <div className="biz-card-row"><strong>Журнал</strong><small>сегодня</small></div>
              <ul className="biz-log">{[['Анна', 'ответила на отзыв', '12:40'], ['Вы', 'добавили конкурента', '11:05'], ['Максим', 'выгрузил CSV', '09:30']].map(([who, what, when]) => <li key={what}><b>{who}</b> {what}<small>{when}</small></li>)}</ul>
            </div>,
          ]}
          items={[
            ['Роли', 'Менеджер действует от имени компании, аналитик только смотрит и выгружает отчёты.'],
            ['Приглашения по почте', 'Письмо придёт на рабочую почту; войдя с ней, человек увидит приглашение в кабинете.'],
            ['Журнал действий', 'Ответы, напитки, объявления, выгрузки и изменения команды — кто и когда.'],
            ['Первые шаги', 'Чек-лист на старте: логотип, напитки, команда, первый ответ, конкуренты.'],
            ['Тема кабинета', 'Светлая, тёмная или как в системе — общая с сайтом.'],
          ]} />
      </div>

      <section className="biz-soon" aria-labelledby="soon-title">
        <p className="biz-kicker"><b>5.0</b>Скоро</p>
        <div><h2 id="soon-title">Продвижение</h2><p>Место в каталоге, рекомендациях и историях для тех, кому нравятся похожие вкусы. Всегда с пометкой «Реклама».</p></div>
      </section>

      <section className="biz-start" aria-labelledby="start-title">
        <h2 id="start-title">Как подключиться</h2>
        <ol>
          <li><b>01</b><strong>Войдите как бизнес</strong><span>Своим аккаунтом CanRush — через почту или Telegram.</span></li>
          <li><b>02</b><strong>Расскажите о компании</strong><span>Бренд, дистрибьютор или магазин, и как с вами связаться.</span></li>
          <li><b>03</b><strong>Прикрепите напитки</strong><span>После проверки откроются аналитика, ответы, новинки и команда.</span></li>
        </ol>
      </section>

      <section className="biz-faq" aria-labelledby="faq-title">
        <h2 id="faq-title">Частые<br />вопросы</h2>
        <div className="biz-faq-list">
          <details><summary>Кто может подключиться?</summary><p>Производители энергетиков, дистрибьюторы и магазины — офлайн и онлайн.</p></details>
          <details><summary>Как вы проверяете компанию?</summary><p>Вручную: связываемся через официальные контакты бренда или магазина. Напитки компании тоже проверяются по одному — так аналитика видна только настоящему владельцу бренда.</p></details>
          <details><summary>Откуда данные в аналитике?</summary><p>Из отзывов, избранного, календаря выпитого и дейтинга участников CanRush, а поиск и просмотры — из обезличенной истории: без имён, аккаунтов и адресов. Отзывы заблокированных участников в расчёт не входят.</p></details>
          <details><summary>Можно убрать плохой отзыв?</summary><p>Нет. Отзывы принадлежат участникам. Нарушения правил разбирают модераторы — так же, как для всех.</p></details>
          <details><summary>Сколько это стоит?</summary><p>Условия обсуждаем лично — напишите на hello@canrush.ru.</p></details>
          <details><summary>Какие правила для компаний?</summary><p>Они собраны в <Link href="/business/terms">Условиях для бизнеса</Link>: проверка компании, работа с отзывами и данными участников, карточки напитков, объявления и команда.</p></details>
        </div>
      </section>

      <section className="biz-final">
        <h2>Начнём с вашего<br />бренда?</h2>
        <p>Войдите как бизнес и расскажите о компании — или напишите нам.</p>
        <div className="biz-actions">{cta(true)}<a className="biz-button is-outline" href="mailto:hello@canrush.ru">hello@canrush.ru</a></div>
      </section>
    </div>
  </BrandShell>;
}
