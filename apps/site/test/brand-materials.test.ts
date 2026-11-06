import { describe, expect, it } from 'vitest';
import { badgeEmbedCode, badgeImageUrl, badgeTheme, pickTarget, posterFormat, printedAddress, targetPage, targetReviewLink, type MaterialTarget } from '@/lib/brand-materials-fields';
import { badgeScore, ratingBadgeSvg } from '@/lib/rating-badge';

const drink: MaterialTarget = { kind: 'drink', brand: 'Tornado', flavor: 'mango', slug: 'tornado-mango', name: 'Tornado · Манго' };
const brand: MaterialTarget = { kind: 'brand', brand: 'Dr.Drinks & Co', name: 'Dr.Drinks & Co' };

describe('QR poster and badge links', () => {
  it('sends the QR code to the review form and the badge to the drink page', () => {
    expect(targetReviewLink(drink)).toBe('https://canrush.ru/catalog/tornado-mango?tab=reviews#write-review');
    expect(targetPage(drink)).toBe('https://canrush.ru/catalog/tornado-mango');
    expect(targetPage(brand)).toBe('https://canrush.ru/catalog?brand=Dr.Drinks+%26+Co');
    expect(targetReviewLink(brand)).toBe(targetPage(brand));
    expect(printedAddress(drink)).toBe('canrush.ru/catalog/tornado-mango');
  });

  it('builds the badge address and escapes the embed code', () => {
    expect(badgeImageUrl(drink, 'light')).toBe('https://canrush.ru/badge/tornado-mango.svg');
    expect(badgeImageUrl(brand, 'dark')).toBe('https://canrush.ru/badge/brand/Dr.Drinks%20%26%20Co.svg?theme=dark');
    const code = badgeEmbedCode(brand, 'light');
    expect(code).toContain('href="https://canrush.ru/catalog?brand=Dr.Drinks+%26+Co"');
    expect(code).toContain('alt="Dr.Drinks &amp; Co — оценка участников CanRush"');
    expect(code).toContain('rel="noopener"');
  });

  it('reads the address of the cabinet and the print page', () => {
    expect(badgeTheme('dark')).toBe('dark');
    expect(badgeTheme('neon')).toBe('light');
    expect(posterFormat('labels')).toBe('labels');
    expect(posterFormat(undefined)).toBe('a4');
    const targets = [{ kind: 'brand', brand: 'Tornado', name: 'Tornado' } as MaterialTarget, drink];
    expect(pickTarget(targets, { drink: 'tornado-mango' })).toBe(drink);
    expect(pickTarget(targets, { drink: 'someone-elses' })).toBe(targets[0]);
    expect(pickTarget(targets, { brand: 'Tornado' })).toBe(targets[0]);
    expect(pickTarget([], {})).toBeNull();
  });
});

describe('rating badge', () => {
  it('shows the average out of 10 and the reviews', () => {
    const svg = ratingBadgeSvg({ name: 'Tornado · Манго', reviews: 123, score: 8.06, theme: 'light' });
    expect(svg).toContain('>8.1<');
    expect(svg).toContain('· 123 отзыва');
    expect(svg).toContain('aria-label="Tornado · Манго: 8.1 из 10 на CanRush, 123 отзыва"');
    expect(svg).toContain('fill="#ffffff"');
    expect(ratingBadgeSvg({ name: 'X', reviews: 5, score: 7, theme: 'dark' })).toContain('fill="#12151c"');
  });

  it('asks to rate while there are too few reviews, and escapes the name', () => {
    const svg = ratingBadgeSvg({ name: 'A & <B>', reviews: 2, score: 10, theme: 'light' });
    expect(svg).toContain('Оцените первым');
    expect(svg).not.toContain('/10');
    expect(svg).toContain('A &amp; &lt;B&gt;');
    expect(badgeScore(10)).toBe('10.0');
    expect(badgeScore(6.849)).toBe('6.8');
  });
});
