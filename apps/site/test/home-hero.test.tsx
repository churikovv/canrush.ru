import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CatalogGroup, FlavorVariant } from '@canrush/shared';
import { HomeHero } from '@/components/home-hero';
import { buildHomeHero } from '@/lib/home-hero';
import type { FeaturedReview, ReviewSummary } from '@/lib/reviews';

const variant = (retailer: string, price: number, volumeMl = 449): FlavorVariant => ({ source: 'edadeal', retailer, price, volumeMl, url: 'https://example.test', fetchedAt: '2026-10-01T00:00:00Z' });
const group = (brand: string, flavor: string, variants: FlavorVariant[], coverImageUrl?: string): CatalogGroup => ({ brand, flavor, variants, minPrice: Math.min(...variants.map(v => v.price)), coverImageUrl });
const key = (brand: string, flavor: string) => `${brand}\u0000${flavor}`;

const redbull = group('Red Bull', 'original', [variant('Магнит', 139), variant('Пятёрочка', 119.99), variant('Магнит', 99, 250), variant('Лента', 129), variant('Дикси', 149), variant('Перекрёсток', 159)], '/images/redbull.jpg');
const monster = group('Monster', 'monster_mango_loco', [variant('Лента', 109)], '/images/monster.jpg');
const burn = group('Burn', 'original', [variant('Яндекс Лавка', 89)]);
const summaries = new Map<string, ReviewSummary>([
  [key('Red Bull', 'original'), { count: 12, design: 9, taste: 8.6, overall: 8.8 }],
  [key('Monster', 'monster_mango_loco'), { count: 3, design: 8, taste: 8, overall: 8 }],
]);
const review = (username: string): FeaturedReview => ({ text: 'Отличный вкус, бодрит и не приторный.', score: 9, username, name: username, avatarId: null });
const reviews = new Map([[key('Red Bull', 'original'), review('alice')], [key('Monster', 'monster_mango_loco'), review('bob')]]);

const adrenaline = group('Adrenaline', 'original', [variant('Лента', 119)], '/images/adrenaline.jpg');

function hero() {
  return buildHomeHero({ groups: [redbull, monster, burn, adrenaline], ranked: [redbull, monster, burn, adrenaline], featured: [monster], summaries, reviews, counts: { reviews: 1234, tierLists: 56 } });
}

describe('home hero data', () => {
  it('counts retailers across the catalog, widest choice first', () => {
    expect(hero().stats).toEqual({ drinks: 4, retailers: 6, reviews: 1234, tierLists: 56 });
    expect(hero().retailers.slice(0, 2)).toEqual(['Лента', 'Дикси']);
  });

  it('puts featured drinks first, skips drinks without a photo and mixes in a review', () => {
    const slides = hero().slides;
    expect(slides.map(slide => slide.kind === 'review' ? `review:${slide.review.username}` : slide.drink.brand)).toEqual(['Monster', 'Red Bull', 'Adrenaline', 'review:bob']);
    expect(slides[1]).toMatchObject({ kind: 'drink', drink: { minPrice: 99, retailer: 'Магнит', retailerCount: 5, rating: 8.8, reviewCount: 12 } });
  });

  it('shows a review even when there are too few drinks to reach the review slot', () => {
    const data = buildHomeHero({ groups: [redbull], ranked: [redbull], featured: [redbull], summaries, reviews, counts: { reviews: 1, tierLists: 0 } });
    expect(data.slides.map(slide => slide.kind)).toEqual(['drink', 'review']);
  });

  it('works with an empty catalog', () => {
    const data = buildHomeHero({ groups: [], ranked: [], featured: [], summaries: new Map(), reviews: new Map(), counts: { reviews: 0, tierLists: 0 } });
    expect(data).toEqual({ stats: { drinks: 0, retailers: 0, reviews: 0, tierLists: 0 }, slides: [], retailers: [] });
  });
});

describe('home hero markup', () => {
  const badge = { tag: 'Топ месяца', text: '@alice лидирует в этом месяце', href: '/leaderboard' };

  it('renders a visible h1, a catalog search form and real numbers', () => {
    const html = renderToStaticMarkup(createElement(HomeHero, { data: hero(), badge, retailerBadges: { Магнит: createElement('i', { 'data-badge': 'Магнит' }) } }));
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toMatch(/<form[^>]*action="\/catalog"[^>]*method="get"/);
    expect(html).toMatch(/<input type="search"[^>]*name="q"/);
    expect(html).toContain('href="/leaderboard"');
    expect(html).toContain('<b>6</b> магазинах');
    expect(html).toContain(`<b>${(1234).toLocaleString('ru-RU')}</b> оценки`);
    expect(html).toContain('<b>56</b> тирлистов');
    expect(html).toContain('data-badge="Магнит"');
    expect(html).toContain('@bob');
  });

  it('duplicates the carousel only for the seamless loop, hidden from assistive tech', () => {
    const html = renderToStaticMarkup(createElement(HomeHero, { data: hero(), badge, retailerBadges: {} }));
    expect(html.match(/class="home-hero-track"/g)).toHaveLength(2);
    expect(html).toMatch(/<ul class="home-hero-track" aria-hidden="true" inert="">/);
    expect(html).toContain('--marquee-duration:20s');
  });

  it('uses no external runtime assets', () => {
    const html = renderToStaticMarkup(createElement(HomeHero, { data: hero(), badge, retailerBadges: {} }));
    expect(html).not.toMatch(/(src|href)="https?:/);
  });

  it('drops the gallery when there is nothing to show', () => {
    const data = buildHomeHero({ groups: [], ranked: [], featured: [], summaries: new Map(), reviews: new Map(), counts: { reviews: 0, tierLists: 0 } });
    const html = renderToStaticMarkup(createElement(HomeHero, { data, badge: null, retailerBadges: {} }));
    expect(html).not.toContain('home-hero-gallery');
    expect(html).toContain('Оценки и отзывы сообщества');
  });
});
