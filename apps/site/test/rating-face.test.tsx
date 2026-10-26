import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RatingFace, ratingMood } from '../src/components/rating-face';
import { countryFlag, countryName, FREQUENT_COUNTRIES, OTHER_COUNTRIES } from '../src/lib/countries';

describe('rating face', () => {
  it('has five moods over 1–10, two scores each', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(value => ratingMood('taste', value).word))
      .toEqual(['невкусно', 'невкусно', 'так себе', 'так себе', 'нормально', 'нормально', 'вкусно', 'вкусно', 'очень вкусно', 'очень вкусно']);
    expect(ratingMood('design', 10)).toMatchObject({ eyes: 'heart', extra: 'sparkles', word: 'очень красиво' });
    expect(ratingMood('taste', 10)).toMatchObject({ mouth: 'yum' });
    // Out of range values clamp instead of breaking the face.
    expect(ratingMood('design', 0).word).toBe('не нравится');
    expect(ratingMood('design', 12).word).toBe('очень красиво');
  });

  it('draws a decorative svg the slider describes in words', () => {
    const html = renderToStaticMarkup(createElement(RatingFace, { kind: 'design', value: 9 }));
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('<svg');
    expect(html).toContain('#006EFF');
    expect(html).toContain('#E8291C');
  });
});

describe('countries', () => {
  it('lists every country once, frequent ones first', () => {
    const codes = [...FREQUENT_COUNTRIES, ...OTHER_COUNTRIES].map(country => country.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(FREQUENT_COUNTRIES[0]).toEqual({ code: 'RU', name: 'Россия' });
    expect(countryName('AT')).toBe('Австрия');
    expect(countryName(null)).toBeNull();
    expect(countryFlag('DE')).toBe('🇩🇪');
  });
});
