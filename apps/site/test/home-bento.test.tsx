import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HomeBento, type HomeBentoData } from '@/components/home-bento';

const data: HomeBentoData = {
  drinks: [{ key: 'a', imageUrl: '/images/redbull.jpg', rating: 8.8, price: 99 }],
  listings: [{ id: 'l1', title: 'Monster Ultra Paradise', price: '199 ₽', city: 'Москва', photo: 'p1' }],
  retailers: ['Магнит'], retailerCount: 26, storeCount: 3, reviewCount: 1234, drinkCount: 262,
  quote: { text: 'Бодрит и не приторный.', username: 'alice', avatarId: null, score: 9, drink: 'Red Bull Оригинальный' },
};

describe('home bento', () => {
  it('renders three linked tiles with headings', () => {
    const html = renderToStaticMarkup(createElement(HomeBento, { data, retailerBadges: { Магнит: createElement('i', { 'data-badge': 'Магнит' }) } }));
    expect([...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map(match => match[1])).toEqual(['/market', '/prices', '/catalog?sort=rating']);
    for (const title of ['Продавай и покупай энергетики на маркете', 'Находи в магазинах лучшее', 'Смотри отзывы, оценки и цены']) expect(html).toContain(`<h3>${title}</h3>`);
    expect(html).toContain('/api/market-photos/p1?size=thumbnail');
    expect(html).toContain('data-badge="Магнит"');
    expect(html).toContain('<b>3</b> магазина на карте');
    expect(html).toContain('@alice');
  });

  it('invites to post a listing when the market is empty', () => {
    const html = renderToStaticMarkup(createElement(HomeBento, { data: { ...data, listings: [], quote: null }, retailerBadges: {} }));
    expect(html).toContain('Ваше объявление');
    expect(html).not.toContain('@alice');
  });
});
