import Image from 'next/image';
import Link from '@/components/navigation-progress';
import type { ReactNode } from 'react';

export interface HomeBentoListing { id: string; title: string; price: string; city: string; photo: string | null }
export interface HomeBentoQuote { text: string; username: string; avatarId: string | null; score: number; drink: string }
export interface HomeBentoDrink { key: string; imageUrl: string; rating: number | null; price: number | null }
export interface HomeBentoData {
  drinks: HomeBentoDrink[];
  listings: HomeBentoListing[];
  retailers: string[];
  retailerCount: number;
  storeCount: number;
  reviewCount: number;
  drinkCount: number;
  quote: HomeBentoQuote | null;
}

const count = new Intl.NumberFormat('ru-RU');
const score = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const price = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

function plural(value: number, one: string, few: string, many: string) {
  const tens = value % 100, ones = value % 10;
  if (tens >= 11 && tens <= 14) return many;
  return ones === 1 ? one : ones >= 2 && ones <= 4 ? few : many;
}

const Arrow = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;

/** Three feature tiles right after the hero: market, stores and prices, reviews. Each tile is one link with live data inside. */
export function HomeBento({ data, retailerBadges }: { data: HomeBentoData; retailerBadges: Record<string, ReactNode> }) {
  return <section className="home-bento" aria-labelledby="home-bento-title">
    <h2 id="home-bento-title" className="sr-only">Что можно делать на CanRush</h2>

    <Link className="home-bento-tile" data-tile="market" href="/market">
      <div className="home-bento-copy">
        <h3>Продавай и покупай энергетики на маркете</h3>
        <span className="home-bento-text">Редкие вкусы, лимитки и коллекции от участников. Договаривайтесь с продавцом напрямую.</span>
        <span className="home-bento-cta">Открыть маркет <Arrow /></span>
      </div>
      <span className="home-bento-visual home-bento-listings" aria-hidden="true">
        {data.listings.length ? data.listings.map(listing => <span key={listing.id} className="home-bento-listing">
          <span className="home-bento-thumb">{listing.photo ? <Image src={`/api/market-photos/${listing.photo}?size=thumbnail`} width={96} height={96} unoptimized alt="" /> : listing.title[0]?.toUpperCase()}</span>
          <span className="home-bento-listing-copy"><b>{listing.title}</b><small>{listing.city}</small></span>
          <span className="home-bento-listing-price">{listing.price}</span>
        </span>) : <span className="home-bento-listing home-bento-listing-empty"><span className="home-bento-thumb">+</span><span className="home-bento-listing-copy"><b>Ваше объявление</b><small>Разместите первым</small></span></span>}
      </span>
    </Link>

    <Link className="home-bento-tile" data-tile="stores" href="/prices">
      <div className="home-bento-copy">
        <h3>Находи в магазинах лучшее</h3>
        <span className="home-bento-text">Сравниваем цены по сетям города и отмечаем на карте магазины, которые нашли участники.</span>
        <span className="home-bento-cta">Сравнить цены <Arrow /></span>
      </div>
      <span className="home-bento-visual" aria-hidden="true">
        {data.retailers.length > 0 && <span className="home-bento-retailers">{data.retailers.map(name => <span key={name}>{retailerBadges[name]}</span>)}</span>}
        <span className="home-bento-figures">
          <span><b>{count.format(data.retailerCount)}</b> {plural(data.retailerCount, 'сеть', 'сети', 'сетей')}</span>
          <span><b>{count.format(data.storeCount)}</b> {plural(data.storeCount, 'магазин', 'магазина', 'магазинов')} на карте</span>
        </span>
      </span>
    </Link>

    <Link className="home-bento-tile" data-tile="reviews" href="/catalog?sort=rating">
      <div className="home-bento-copy">
        <h3>Смотри отзывы, оценки и цены</h3>
        <span className="home-bento-text">{count.format(data.drinkCount)} {plural(data.drinkCount, 'энергетик', 'энергетика', 'энергетиков')} с ценами и {count.format(data.reviewCount)} {plural(data.reviewCount, 'оценкой', 'оценками', 'оценками')} сообщества за дизайн и вкус.</span>
        <span className="home-bento-cta">Открыть рейтинг <Arrow /></span>
      </div>
      <span className="home-bento-visual home-bento-reviews" aria-hidden="true">
        {data.drinks.length > 0 && <span className="home-bento-cans">{data.drinks.map(drink => <span key={drink.key} className="home-bento-can">
          <span className="home-bento-can-tile"><Image src={drink.imageUrl} width={160} height={160} sizes="96px" alt="" /></span>
          {drink.rating !== null && <span className="home-bento-score">★ {score.format(drink.rating)}</span>}
          {drink.price !== null && <small>от {price.format(drink.price)} ₽</small>}
        </span>)}</span>}
        {data.quote && <span className="home-bento-quote">
          <span className="home-bento-quote-text">«{data.quote.text}»</span>
          <span className="home-bento-quote-author">
            <span className="home-bento-avatar">{data.quote.avatarId ? <Image src={`/api/profile-images/${data.quote.avatarId}`} width={28} height={28} unoptimized alt="" /> : data.quote.username[0]?.toUpperCase()}</span>
            <span><b>@{data.quote.username}</b><small>{data.quote.drink}</small></span>
            <span className="home-bento-score">{score.format(data.quote.score)}</span>
          </span>
        </span>}
      </span>
    </Link>
  </section>;
}
