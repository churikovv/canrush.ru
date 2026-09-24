import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProfileReviews } from '../src/components/profile-reviews';
import type { ReviewData } from '../src/lib/reviews';
const review: ReviewData = {
  id: 'review-1', author: { username: 'reader', name: 'Reader', telegramChannel: null },
  brand: 'Burn', flavor: 'original', design: 4, taste: 5, composition: 3,
  text: 'Отличный вкус', photos: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'],
  createdAt: new Date('2026-09-24'), updatedAt: new Date('2026-09-24'),
};
const base = { username: 'reader', ownerName: 'Reader', count: 1, page: 1, pages: 1 };
describe('profile review list', () => {
  it('shows public review content and photos, with links back to author and product reviews', () => {
    const html = renderToStaticMarkup(createElement(ProfileReviews, { ...base, reviews: [review] }));
    expect(html).toContain('Отличный вкус');
    expect(html).toContain('href="/profile/reader"');
    expect(html).toContain('?tab=reviews');
    expect(html).toContain('Открыть фотографию 1 из 1');
    expect(html).not.toContain('Удалить отзыв');
  });
  it('shows an empty state instead of an empty feed', () => {
    const html = renderToStaticMarkup(createElement(ProfileReviews, { ...base, count: 0, reviews: [] }));
    expect(html).toContain('Пользователь пока не оставил отзывов');
    expect(html).not.toContain('Страницы отзывов');
  });
  it('keeps pagination within the same author profile', () => {
    const html = renderToStaticMarkup(createElement(ProfileReviews, { ...base, page: 2, pages: 3, count: 41, reviews: [review] }));
    expect(html).toContain('/profile/reader/reviews?page=1');
    expect(html).toContain('/profile/reader/reviews?page=3');
  });
});
