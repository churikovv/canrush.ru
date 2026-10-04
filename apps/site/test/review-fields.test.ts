import { describe, expect, it } from 'vitest';
import { parseRating, validateReviewInput, reviewTextGuidance } from '../src/lib/review-fields.js';

describe('review fields', () => {
  it('парсит корректные оценки', () => {
    expect(parseRating('1')).toBe(1);
    expect(parseRating('5')).toBe(5);
    expect(parseRating('10')).toBe(10);
  });

  it('отклоняет некорректные оценки', () => {
    expect(parseRating('0')).toBeUndefined();
    expect(parseRating('11')).toBeUndefined();
    expect(parseRating('abc')).toBeUndefined();
    expect(parseRating('2.5')).toBeUndefined();
  });

  it('валидирует корректный отзыв', () => {
    const result = validateReviewInput({
      design: '5',
      taste: '4',
      text: '  Отличный энергетик, приятный вкус и дизайн!  ',
    });
    expect(result.data).toEqual({
      design: 5,
      taste: 4,
      text: 'Отличный энергетик, приятный вкус и дизайн!',
    });
  });

  it('отклоняет отзыв без оценок и текста', () => {
    const result = validateReviewInput({
      design: '',
      taste: '',
      text: '',
    });
    expect(result.errors).toMatchObject({
      design: expect.any(String),
      taste: expect.any(String),
      text: expect.any(String),
    });
  });

  it('отклоняет слишком длинный отзыв', () => {
    const result = validateReviewInput({
      design: '5',
      taste: '5',
      text: 'а'.repeat(1001),
    });
    expect(result.errors?.text).toBeTruthy();
  });

  it('отклоняет оценку вне диапазона', () => {
    const result = validateReviewInput({
      design: '0',
      taste: '5',
      text: 'Текст отзыва',
    });
    expect(result.errors?.design).toBeTruthy();
  });
});

it('requires 30 normalized characters and gives consistent guidance at boundaries', () => {
  for (const text of ['а'.repeat(29), 'вкусно' + ' '.repeat(100), 'а'.repeat(29) + '\u200b'.repeat(100)]) {
    expect(validateReviewInput({ design: '8', taste: '9', text }).errors?.text).toBeTruthy();
    expect(reviewTextGuidance(text).level).toBe('short');
  }
  for (const length of [30, 149, 150, 1000]) {
    const text = 'а'.repeat(length);
    expect(validateReviewInput({ design: '8', taste: '9', text }).data?.text).toBe(text);
    expect(reviewTextGuidance(text).level).toBe(length < 150 ? 'enough' : 'detailed');
  }
});
