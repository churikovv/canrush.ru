import { isCountryCode } from '@/lib/countries';

export const MIN_REVIEW_LENGTH = 30;
export const DETAILED_REVIEW_LENGTH = 150;
/** Between publishable and detailed: a good review that is close to detailed, so the next step feels near. */
export const GOOD_REVIEW_LENGTH = 90;
export function normalizeReviewText(text: string): string {
  return text.replace(/[\u200B-\u200D\uFEFF]/gu, '').trim().replace(/\s+/gu, ' ');
}
const symbols = (n: number) => {
  const tens = n % 100, ones = n % 10;
  return `${n} ${tens > 10 && tens < 20 ? 'символов' : ones === 1 ? 'символ' : ones > 1 && ones < 5 ? 'символа' : 'символов'}`;
};

/**
 * The note under the review text: how far it is from publishable (MIN_REVIEW_LENGTH), good (GOOD_REVIEW_LENGTH) and
 * detailed (DETAILED_REVIEW_LENGTH). `title` counts down, `status` changes only with the level (for screen readers),
 * `progress` is the share of the way to detailed.
 */
export function reviewTextGuidance(value: string) {
  const length = normalizeReviewText(value).length;
  const progress = Math.min(1, length / DETAILED_REVIEW_LENGTH);
  if (length < MIN_REVIEW_LENGTH) return { level: 'short', progress, title: `Ещё ${symbols(MIN_REVIEW_LENGTH - length)}`, hint: 'до публикации', status: `Нужно минимум ${symbols(MIN_REVIEW_LENGTH)}.` } as const;
  if (length < GOOD_REVIEW_LENGTH) return { level: 'enough', progress, title: 'Можно публиковать', hint: 'а пара деталей сделает отзыв лучше', status: 'Отзыв можно публиковать.' } as const;
  if (length < DETAILED_REVIEW_LENGTH) return { level: 'good', progress, title: 'Хороший отзыв', hint: `ещё ${DETAILED_REVIEW_LENGTH - length} до подробного`, status: 'Хороший отзыв.' } as const;
  return { level: 'detailed', progress, title: 'Подробный отзыв', hint: 'такие помогают с выбором', status: 'Подробный отзыв.' } as const;
}

export type ReviewField = 'design' | 'taste' | 'text' | 'country';

export interface ReviewInputData {
  design: number;
  taste: number;
  text: string;
  /** Where the can was made (ISO code from `countries.ts`), null when the member did not say. */
  country?: string | null;
}

export type ReviewFieldErrors = Partial<Record<ReviewField, string>>;

export type ReviewValidationResult =
  | { data: ReviewInputData; errors?: never }
  | { data?: never; errors: ReviewFieldErrors };

const CRITERIA: Array<{ field: 'design' | 'taste'; label: string }> = [
  { field: 'design', label: 'Дизайн' },
  { field: 'taste', label: 'Вкус' },
];

export function parseRating(value: string): number | undefined {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 10) return undefined;
  return n;
}

export function validateReviewInput(values: {
  design: string;
  taste: string;
  text: string;
  country?: string;
}): ReviewValidationResult {
  const errors: ReviewFieldErrors = {};
  const parsed: Partial<ReviewInputData> = {};

  for (const { field } of CRITERIA) {
    const rating = parseRating(values[field]);
    if (rating === undefined) {
      errors[field] = 'Поставьте оценку от 1 до 10.';
    } else {
      parsed[field] = rating;
    }
  }

  const text = normalizeReviewText(values.text);
  if (!text) {
    errors.text = 'Напишите отзыв.';
  } else if (text.length < MIN_REVIEW_LENGTH) {
    errors.text = `Поделитесь ещё впечатлениями — нужно минимум ${MIN_REVIEW_LENGTH} символов.`;
  } else if (text.length > 1000) {
    errors.text = 'Отзыв должен быть не длиннее 1000 символов.';
  } else {
    parsed.text = text;
  }

  const country = values.country?.trim() || null;
  if (country && !isCountryCode(country)) errors.country = 'Выберите страну из списка.';

  if (Object.keys(errors).length > 0) return { errors };

  return {
    data: {
      design: parsed.design!,
      taste: parsed.taste!,
      text: parsed.text!,
      country,
    },
  };
}
