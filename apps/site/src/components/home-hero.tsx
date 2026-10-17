import Image from 'next/image';
import Link from '@/components/navigation-progress';
import type { CSSProperties, ReactNode } from 'react';
import type { HomeHeroData, HomeHeroSlide } from '@/lib/home-hero';

export interface HomeHeroBadge { tag: string; text: string; href: string }

const score = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const price = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
const count = new Intl.NumberFormat('ru-RU');
const SECONDS_PER_SLIDE = 5;

function plural(value: number, one: string, few: string, many: string) {
  const tens = value % 100, ones = value % 10;
  if (tens >= 11 && tens <= 14) return many;
  return ones === 1 ? one : ones >= 2 && ones <= 4 ? few : many;
}

const Star = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.3l6.5-.9z" /></svg>;

function Slide({ slide, eager, retailerBadges }: { slide: HomeHeroSlide; eager: boolean; retailerBadges: Record<string, ReactNode> }) {
  const { drink } = slide;
  if (slide.kind === 'review') return <li className="home-hero-slide" data-kind="review">
    <Link href={drink.href} aria-label={`Отзыв @${slide.review.username} о ${drink.brand} ${drink.flavor}`}>
      <span className="home-hero-tile">
        <span className="home-hero-quote">«{slide.review.text}»</span>
        <span className="home-hero-quote-author">
          <span className="home-hero-avatar" aria-hidden="true">{slide.review.avatarId ? <Image src={`/api/profile-images/${slide.review.avatarId}`} width={28} height={28} unoptimized alt="" /> : slide.review.username[0]?.toUpperCase()}</span>
          <span>@{slide.review.username}</span>
          <b><Star />{score.format(slide.review.score)}</b>
        </span>
      </span>
      <span className="home-hero-slide-title">Отзыв</span>
      <span className="home-hero-slide-meta">{drink.brand} {drink.flavor}</span>
    </Link>
  </li>;
  return <li className="home-hero-slide">
    <Link href={drink.href} aria-label={`${drink.brand}, ${drink.flavor}`}>
      <span className="home-hero-tile">
        <Image src={drink.imageUrl} width={240} height={240} sizes="(max-width: 639px) 160px, 200px" alt="" priority={eager} />
        {drink.retailer && <span className="home-hero-retailer">{retailerBadges[drink.retailer]}{drink.retailerCount > 1 && <small>+{drink.retailerCount - 1}</small>}</span>}
        {drink.minPrice !== null && <span className="home-hero-price"><small>от</small> {price.format(drink.minPrice)} ₽</span>}
      </span>
      <span className="home-hero-slide-title">{drink.flavor}</span>
      <span className="home-hero-slide-meta">{drink.brand}{drink.rating !== null && <b><Star />{score.format(drink.rating)}</b>}</span>
    </Link>
  </li>;
}

/**
 * First screen of the home page (after Tailark "hero-section-6"): badge, h1, catalog search and benefits on the
 * page background, with a carousel of drinks and reviews behind it that fades into the background on the left.
 * Server-only markup: the search is a plain GET form and the carousel is a CSS marquee, so both work before hydration.
 */
export function HomeHero({ data, badge, retailerBadges }: { data: HomeHeroData; badge: HomeHeroBadge | null; retailerBadges: Record<string, ReactNode> }) {
  const { stats, slides } = data;
  const perks: ReactNode[] = [
    stats.retailers > 0 && <>Цены в <b>{count.format(stats.retailers)}</b> {plural(stats.retailers, 'магазине', 'магазинах', 'магазинах')} на <b>{count.format(stats.drinks)}</b> {plural(stats.drinks, 'напиток', 'напитка', 'напитков')}</>,
    stats.reviews > 0 ? <><b>{count.format(stats.reviews)}</b> {plural(stats.reviews, 'оценка', 'оценки', 'оценок')} и отзывов сообщества</> : <>Оценки и отзывы сообщества</>,
    stats.tierLists > 0 ? <><b>{count.format(stats.tierLists)}</b> {plural(stats.tierLists, 'тирлист', 'тирлиста', 'тирлистов')} от любителей энергетиков</> : <>Тирлисты от любителей энергетиков</>,
  ].filter(Boolean);

  return <section className="home-hero" aria-labelledby="home-title" data-gallery={slides.length ? true : undefined}>
    <div className="home-hero-copy">
      {badge && <Link className="home-hero-badge" href={badge.href}>
        <span className="home-hero-badge-tag">{badge.tag}</span>
        <span className="home-hero-badge-text">{badge.text}</span>
        <span className="home-hero-badge-arrow" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
      </Link>}
      <h1 id="home-title" className="home-hero-title">Энергетики: цены, оценки и&nbsp;отзывы</h1>
      <p className="home-hero-lead">Сравниваем цены в магазинах вашего города и собираем честные оценки сообщества — найдите свой вкус и купите дешевле.</p>
      <form className="home-hero-search" action="/catalog" method="get" role="search">
        <label>
          <span className="sr-only">Найти энергетик</span>
          <Image src="/brand/icons/catalog-search.svg" width={22} height={22} alt="" />
          <input name="q" type="search" placeholder="Бренд или вкус" autoComplete="off" enterKeyHint="search" spellCheck={false} maxLength={80} />
        </label>
        <button type="submit">Найти</button>
      </form>
      <ul className="home-hero-perks">{perks.map((perk, index) => <li key={index}>{perk}</li>)}</ul>
    </div>

    {slides.length > 0 && <div className="home-hero-gallery" role="region" aria-label="Энергетики и отзывы">
      <div className="home-hero-marquee" style={{ '--marquee-duration': `${slides.length * SECONDS_PER_SLIDE}s` } as CSSProperties}>
        <ul className="home-hero-track">{slides.map((slide, index) => <Slide key={`${slide.kind}:${slide.drink.key}`} slide={slide} eager={index < 4} retailerBadges={retailerBadges} />)}</ul>
        {/* Second copy makes the loop seamless; hidden from assistive tech and the tab order. */}
        <ul className="home-hero-track" aria-hidden="true" inert>{slides.map(slide => <Slide key={`${slide.kind}:${slide.drink.key}`} slide={slide} eager={false} retailerBadges={retailerBadges} />)}</ul>
      </div>
    </div>}
  </section>;
}
