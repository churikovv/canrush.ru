'use client';
import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { useEffect, useRef, useState } from 'react';
import type { FeaturedReview } from '@/lib/reviews';

export interface HomeHeroSlide {
  key: string;
  href: string;
  brand: string;
  flavor: string;
  imageUrl: string | null;
  rating: number | null;
  reviewCount: number;
  retailers: number;
  minPrice: number | null;
  review: FeaturedReview | null;
}

const AUTOPLAY_MS = 7000;
const number = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const price = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

function plural(count: number, one: string, few: string, many: string) {
  const tens = count % 100, ones = count % 10;
  if (tens >= 11 && tens <= 14) return many;
  return ones === 1 ? one : ones >= 2 && ones <= 4 ? few : many;
}

/** Slides are server-rendered into a scroll-snap track, so swiping works before hydration; JS adds arrows, dots and autoplay. */
export function HomeHero({ slides }: { slides: HomeHeroSlide[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const root = track.current;
    if (!root) return;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.index));
    }, { root, threshold: 0.6 });
    for (const slide of root.children) observer.observe(slide);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (slides.length < 2 || paused || touched || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => { if (document.visibilityState === 'visible') go((active + 1) % slides.length, false); }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  });

  function go(index: number, manual = true) {
    const root = track.current;
    const target = root?.children[index] as HTMLElement | undefined;
    if (!root || !target) return;
    if (manual) setTouched(true);
    root.scrollTo({ left: target.offsetLeft - root.offsetLeft, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  return <section className="home-hero" aria-roledescription="карусель" aria-label="Лучшие энергетики"
    onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={() => setPaused(false)}>
    <div className="home-hero-track" ref={track} onPointerDown={() => setTouched(true)}>
      {slides.map((slide, index) => <article key={slide.key} className="home-hero-slide" data-index={index} aria-roledescription="слайд" aria-label={`${index + 1} из ${slides.length}`} aria-hidden={index !== active || undefined} inert={index !== active || undefined}>
        <div className="home-hero-copy">
          <ul className="home-hero-meta">
            {slide.rating !== null && <li className="home-hero-rating"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.3l6.5-.9z" /></svg><b>{number.format(slide.rating)}</b><span>/ {slide.reviewCount} {plural(slide.reviewCount, 'оценка', 'оценки', 'оценок')}</span></li>}
            <li>{slide.brand}</li>
            {slide.retailers > 0 && <li>{slide.retailers} {plural(slide.retailers, 'магазин', 'магазина', 'магазинов')}</li>}
          </ul>
          <h2 className="home-hero-title"><span>{slide.brand}</span> <span>{slide.flavor}</span></h2>
          {slide.review ? <figure className="home-hero-review">
            <blockquote>«{slide.review.text}»</blockquote>
            <figcaption>
              <span className="home-hero-avatar" aria-hidden="true">{slide.review.avatarId ? <Image src={`/api/profile-images/${slide.review.avatarId}`} width={28} height={28} unoptimized alt="" /> : slide.review.username[0]?.toUpperCase()}</span>
              <span>@{slide.review.username}</span><b>{number.format(slide.review.score)} / 10</b>
            </figcaption>
          </figure> : <p className="home-hero-review home-hero-review-empty">Отзывов пока нет — станьте первым, кто оценит этот напиток.</p>}
          <div className="home-hero-actions">
            <Link className="home-hero-primary" href={slide.href}>Смотреть подробнее</Link>
            <Link className="home-hero-secondary" href="/catalog?sort=rating">Весь рейтинг</Link>
          </div>
        </div>
        <div className="home-hero-art">
          <div className="home-hero-card">
            {slide.imageUrl && <Image src={slide.imageUrl} width={420} height={420} sizes="(max-width: 639px) 160px, 340px" alt={`${slide.brand}, ${slide.flavor}`} priority={index === 0} />}
            {slide.minPrice !== null && <span className="home-hero-price"><small>от</small>{price.format(slide.minPrice)} ₽</span>}
          </div>
        </div>
      </article>)}
    </div>
    {slides.length > 1 && <>
      <button type="button" className="home-hero-arrow" data-direction="prev" aria-label="Предыдущий напиток" onClick={() => go((active - 1 + slides.length) % slides.length)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m15 6-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
      <button type="button" className="home-hero-arrow" data-direction="next" aria-label="Следующий напиток" onClick={() => go((active + 1) % slides.length)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
      <div className="home-hero-dots">
        {slides.map((slide, index) => <button key={slide.key} type="button" aria-label={`Слайд ${index + 1}: ${slide.brand} ${slide.flavor}`} aria-current={index === active || undefined} onClick={() => go(index)} />)}
      </div>
    </>}
  </section>;
}
