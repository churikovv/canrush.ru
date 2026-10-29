import '@/styles/shared.css';
import '@/styles/profile.css';
import '@/styles/feed.css';
import '@/styles/market.css';
import '@/styles/company.css';
import type { Metadata } from 'next';
import Image from 'next/image';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { BrandShell } from '@/components/brand-shell';
import { CompanyDeckUpload, CompanyFile, CompanyFollowButton, CompanyPhotos, CompanyPostForm, CompanyPostMenu } from '@/components/company-wall';
import { PdfPages } from '@/components/pdf-pages';
import { CoverImage } from '@/components/cover-image';
import { FormAlert } from '@/components/form-alert';
import { MarketCompanyLogo } from '@/components/market-company-logo';
import Link from '@/components/navigation-progress';
import { ProfileNavigation } from '@/components/profile-navigation';
import { isSiteStaffEmail } from '@/lib/admin';
import { auth } from '@/lib/auth';
import { BUSINESS_KINDS, BUSINESS_STATUS_LABELS } from '@/lib/business-fields';
import { getCompanyProfile, type CompanyPost } from '@/lib/business-profile';
import { telHref } from '@/lib/business-profile-fields';
import { pluralRu } from '@/lib/drink-calendar-fields';
import { formatPrice } from '@/lib/market-fields';
import { SITE_URL } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const profile = await getCompanyProfile(id, null);
  if (!profile) return { title: 'Компания', robots: { index: false, follow: false } };
  const { business } = profile;
  const description = business.about?.slice(0, 160) || `${BUSINESS_KINDS.find(kind => kind.value === business.kind)?.label ?? 'Компания'} «${business.name}» на CanRush: напитки, объявления и презентации.`;
  return {
    title: business.name, description, alternates: { canonical: `/company/${business.id}` },
    openGraph: { type: 'profile', title: business.name, description, url: `/company/${business.id}`, ...(business.logoId ? { images: [{ url: `${SITE_URL}/api/business-logos/${business.logoId}` }] } : {}) },
  };
}

const day = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Moscow' });
const STORE_ICON = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9 5 3h14l2 6M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0V9ZM5 14v7h14v-7M10 21v-4h4v4" /></svg>;
const PHONE_ICON = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" /></svg>;
const MAIL_ICON = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>;
const SITE_ICON = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>;
const PIN_ICON = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></svg>;
const CHECK = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 12.5 4 4 8-9" /></svg>;
const PDF_ICON = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></svg>;
type Tab = 'feed' | 'drinks' | 'market' | 'about';
const TABS: { key: Tab; label: string }[] = [{ key: 'feed', label: 'Лента' }, { key: 'drinks', label: 'Напитки' }, { key: 'market', label: 'Маркет' }, { key: 'about', label: 'О бренде' }];

/**
 * A brand's page in the manner of a social profile: a wide banner, the round logo with the check over it, «Официальный
 * профиль», subscribe, the numbers and tabs — «Лента» (a «Презентация» block with one deck open whole and the others
 * listed, then the home feed's composer and the news: text and photos), «Напитки» (its drinks), «Маркет» (its open
 * listings — only while there are any) and «О бренде» (the brand's story, contacts, details and the store). Sections
 * the team switched off stay hidden from visitors; the team sees everything, before approval too.
 */
export default async function CompanyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ deck?: string; tab?: string }> }) {
  const [{ id }, query, session] = await Promise.all([params, searchParams, auth.api.getSession({ headers: await headers() })]);
  const profile = await getCompanyProfile(id, session?.user.id ?? null);
  if (!profile) notFound();
  const { business, role, store, drinks, listings, posts, presentation, followers, following } = profile;
  const hidden = new Set(business.profileHidden);
  const editor = role === 'owner' || role === 'manager';
  const staff = session ? await isSiteStaffEmail(session.user.email) : false;
  const kind = BUSINESS_KINDS.find(item => item.value === business.kind)?.label ?? 'Компания';
  const approved = business.status === 'approved';
  const open = !hidden.has('presentations');
  const showDrinks = !hidden.has('drinks') && drinks.length > 0;
  const showListings = !hidden.has('listings') && listings.length > 0;
  // «Маркет» is there only while the company sells something.
  const tabs = TABS.filter(item => item.key !== 'market' || showListings);
  const tab: Tab = tabs.some(item => item.key === query.tab) ? query.tab as Tab : 'feed';
  const href = (next: Tab) => `/company/${business.id}${next === 'feed' ? '' : `?tab=${next}`}`;
  // In «Лента» the decks stand apart from the news: the «Презентация» block opens one whole (the one picked by `?deck=`,
  // else the pinned or newest) and lists the others; the posts under it are news — text and photos.
  const decks = posts.filter(post => post.fileName && post.fileSize);
  const current = decks.find(post => post.id === query.deck) ?? (presentation && decks.find(post => post.id === presentation.id)) ?? null;
  const others = decks.filter(post => post !== current);
  const news = posts.filter(post => !post.fileName);
  const badge = approved ? <span className="company-check" title="Проверено CanRush" aria-label="Проверено CanRush">{CHECK}</span> : null;
  const author = (createdAt: Date, by: string | null) => <span className="company-post-meta"><strong>{business.name}{badge}</strong><small>{day.format(createdAt)}{editor && by ? ` · ${by}` : ''}</small></span>;

  return <BrandShell headerAction={<ProfileNavigation active="community" />}>
    <article className="company-page">
      {!approved && <FormAlert tone="warning" title={BUSINESS_STATUS_LABELS[business.status]}>Профиль видите только вы и команда — он откроется всем, когда компанию подтвердят.</FormAlert>}
      <header className="company-head">
        <div className="company-banner">
          {/* eslint-disable-next-line @next/next/no-img-element -- served from the database */}
          {business.bannerId ? <img src={`/api/business-banners/${business.bannerId}`} alt="" /> : <span className="company-banner-blank" aria-hidden="true" />}
        </div>
        <div className="company-head-body">
          <div className="company-head-top">
            <span className="company-avatar"><MarketCompanyLogo name={business.name} logoId={business.logoId} size={88} />{approved && <span className="company-avatar-check" aria-hidden="true">{CHECK}</span>}</span>
            <div className="company-head-actions">
              {approved && <CompanyFollowButton businessId={business.id} following={following} followers={followers} signedIn={Boolean(session)} />}
              {role === 'owner' && <Link className="company-icon-button" href="/business/cabinet?section=settings&tab=profile" aria-label="Настроить профиль" title="Настроить профиль"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg></Link>}
            </div>
          </div>
          <h1>{business.name}{badge}</h1>
          <p className="company-official">{approved ? 'Официальный профиль' : 'Профиль на проверке'} · {kind}</p>
          {(business.bio ?? business.about) && <p className="company-about company-bio">{business.bio ?? business.about}</p>}
          <p className="company-stats">
            <span><b>{followers.toLocaleString('ru-RU')}</b> {pluralRu(followers, 'подписчик', 'подписчика', 'подписчиков')}</span>
            {showDrinks && <span><b>{drinks.length}</b> {pluralRu(drinks.length, 'напиток', 'напитка', 'напитков')}</span>}
            {open && posts.length > 0 && <span><b>{posts.length}</b> {pluralRu(posts.length, 'публикация', 'публикации', 'публикаций')}</span>}
          </p>
        </div>
        <nav className="company-tabs" aria-label="Разделы профиля">{tabs.map(item => <Link key={item.key} href={href(item.key)} scroll={false} aria-current={item.key === tab ? 'page' : undefined}>{item.label}</Link>)}</nav>
      </header>

      {tab === 'feed' && <>
        {!open && editor && <p className="company-muted company-hidden-note">Лента скрыта от посетителей в настройках профиля.</p>}
        {(open || editor) && (current?.fileName || (editor && approved)) && <section className="company-section company-presentation" id="company-presentation" aria-labelledby="company-presentation-title">
          <div className="company-section-head"><h2 id="company-presentation-title">Презентация</h2>
            {current && <CompanyPostMenu businessId={business.id} postId={current.id} editor={editor} signedIn={Boolean(session)} staff={staff} pdf pinned={current.id === business.presentationId} />}</div>
          {current?.fileName && current.fileSize && <>
            <div className="company-deck-head"><span className="company-file-icon">{PDF_ICON}</span><span className="company-file-text"><strong className="company-deck-title">{current.fileName.replace(/\.pdf$/iu, '')}</strong><small>{day.format(current.createdAt)}</small></span></div>
            {current.text && <p className="company-post-text">{current.text}</p>}
            <PdfPages key={current.id} src={`/api/business-files/${current.id}`} title={current.fileName} />
            <CompanyFile postId={current.id} name={current.fileName} size={current.fileSize} />
            {others.length > 0 && <DeckList businessId={business.id} decks={others} pinnedId={business.presentationId} editor={editor} signedIn={Boolean(session)} staff={staff} title="Другие презентации" />}
          </>}
          {editor && approved && <CompanyDeckUpload businessId={business.id} hasDeck={Boolean(current)} />}
        </section>}
        {editor && approved && <section className="community-panel feed-composer" aria-label="Новая запись"><CompanyPostForm businessId={business.id} mode="news" /></section>}
        {(open || editor) && news.map(post => <section key={post.id} className="company-section company-post">
          <div className="company-post-head">
            <MarketCompanyLogo name={business.name} logoId={business.logoId} size={40} />
            {author(post.createdAt, post.author)}
            <CompanyPostMenu businessId={business.id} postId={post.id} editor={editor} signedIn={Boolean(session)} staff={staff} />
          </div>
          {post.text && <p className="company-post-text">{post.text}</p>}
          {post.photos.length > 0 && <CompanyPhotos photos={post.photos} />}
        </section>)}
        {!news.length && !current && open && !editor && <p className="company-empty company-section">Компания пока ничего не опубликовала.</p>}
      </>}

      {tab === 'drinks' && <>
        {showDrinks || (editor && drinks.length > 0) ? <section className="company-section" aria-labelledby="company-drinks">
          <div className="company-section-head"><h2 id="company-drinks">Напитки</h2><span className="company-muted">{drinks.length}</span></div>
          <ul className="company-drinks">{drinks.map(drink => <li key={drink.href}><Link href={drink.href}>
            <span className="company-drink-cover">{drink.cover ? <CoverImage src={drink.cover} width={160} height={160} alt="" /> : null}</span>
            <small>{drink.brand}</small><strong>{drink.name}</strong>
          </Link></li>)}</ul>
        </section> : null}
        {!(showDrinks || (editor && drinks.length > 0)) && <p className="company-empty company-section">{editor ? 'Прикрепите напитки компании в кабинете — они появятся здесь.' : 'Напитков компании пока нет в каталоге.'}</p>}
      </>}

      {tab === 'market' && showListings && <>
        {showListings && <section className="company-section" aria-labelledby="company-listings">
          <div className="company-section-head"><h2 id="company-listings">Объявления компании</h2><Link className="company-store-link" href="/market">Весь маркет ↗</Link></div>
          <div className="market-grid">{listings.map(listing => <article className="market-card" key={listing.id}>
            <Link href={`/market/${listing.id}`} className="market-card-link">
              {listing.photos[0] && <div className="market-card-image"><Image src={`/api/market-photos/${listing.photos[0]}`} alt={listing.title} width={480} height={480} unoptimized /></div>}
              <div className="market-card-copy"><strong className="market-card-price">{formatPrice(listing.price)}<small> / шт.</small></strong><h2>{listing.title}</h2><p className="market-city">{listing.city}</p></div>
            </Link>
          </article>)}</div>
        </section>}
      </>}

      {tab === 'about' && <>
        <section className="company-section" aria-labelledby="company-about-title">
          <h2 id="company-about-title">О бренде</h2>
          {(business.story ?? business.about) ? <p className="company-about company-story">{business.story ?? business.about}</p> : <p className="company-empty">{editor ? 'Расскажите о бренде в кабинете: «Настройки → Профиль → Описание и контакты».' : 'Компания пока ничего о себе не рассказала.'}</p>}
        </section>
        {(business.publicEmail || business.phone || business.address || business.website || business.telegram) && <section className="company-section" aria-labelledby="company-contacts-title">
          <h2 id="company-contacts-title">Контакты</h2>
          <ul className="company-contacts">
            {business.phone && <li><a href={telHref(business.phone)}><span className="company-contact-icon">{PHONE_ICON}</span><span><small>Телефон</small>{business.phone}</span></a></li>}
            {business.publicEmail && <li><a href={`mailto:${business.publicEmail}`}><span className="company-contact-icon">{MAIL_ICON}</span><span><small>Почта</small>{business.publicEmail}</span></a></li>}
            {business.website && <li><a href={business.website} target="_blank" rel="noopener noreferrer nofollow"><span className="company-contact-icon">{SITE_ICON}</span><span><small>Сайт</small>{business.website.replace(/^https?:\/\//u, '').replace(/\/$/u, '')}</span></a></li>}
            {business.telegram && <li><a href={`https://t.me/${business.telegram}`} target="_blank" rel="noopener noreferrer"><span className="company-contact-icon"><Image src="/brand/icons/telegram.svg" width={18} height={18} alt="" /></span><span><small>Telegram</small>@{business.telegram}</span></a></li>}
            {business.address && <li><a href={`https://yandex.ru/maps/?text=${encodeURIComponent(business.address)}`} target="_blank" rel="noopener noreferrer"><span className="company-contact-icon">{PIN_ICON}</span><span><small>Адрес</small>{business.address}</span></a></li>}
          </ul>
        </section>}
        <section className="company-section" aria-label="О компании">
          <dl className="company-facts">
            <div><dt>Кто это</dt><dd>{kind}</dd></div>
            <div><dt>На CanRush</dt><dd>с {day.format(business.createdAt)}</dd></div>
            {approved && <div><dt>Проверка</dt><dd>Компания подтверждена командой CanRush</dd></div>}
          </dl>
        </section>
        {store && <section className="company-section company-store" aria-labelledby="company-store">
          <span className="company-store-icon">{STORE_ICON}</span>
          <div><h2 id="company-store">{store.name}</h2><p>{store.city} · {store.address}</p></div>
          <Link className="community-button company-store-button" href={`/market/stores/${store.id}`}>{STORE_ICON}Перейти в магазин</Link>
        </section>}
      </>}
    </article>
  </BrandShell>;
}

/** Presentations as rows: «Смотреть» opens one in the «Презентация» block of «Лента», with the post's «⋯». */
function DeckList({ businessId, decks, pinnedId, editor, signedIn, staff, title }: { businessId: string; decks: CompanyPost[]; pinnedId: string | null; editor: boolean; signedIn: boolean; staff: boolean; title: string }) {
  return <div className="company-decks">
    <h3>{title}</h3>
    <ul>{decks.map(post => <li key={post.id}>
      <Link className="company-deck" href={`/company/${businessId}?deck=${post.id}#company-presentation`}>
        <span className="company-file-icon">{PDF_ICON}</span>
        <span className="company-file-text"><strong>{post.fileName!.replace(/\.pdf$/iu, '')}</strong><small>{day.format(post.createdAt)}{post.id === pinnedId ? ' · закреплена' : ''}</small></span>
        <span className="company-file-open">Смотреть</span>
      </Link>
      <CompanyPostMenu businessId={businessId} postId={post.id} editor={editor} signedIn={signedIn} staff={staff} pdf pinned={post.id === pinnedId} />
    </li>)}</ul>
  </div>;
}
