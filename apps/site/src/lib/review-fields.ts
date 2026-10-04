export const MIN_REVIEW_LENGTH = 30;
export const DETAILED_REVIEW_LENGTH = 150;
export function normalizeReviewText(text: string): string {
  return text.replace(/[\u200B-\u200D\uFEFF]/gu, '').trim().replace(/\s+/gu, ' ');
}
export function reviewTextGuidance(value: string) {
  const length = normalizeReviewText(value).length;
  if (length < MIN_REVIEW_LENGTH) return { level: 'short', message: `Поделитесь ещё впечатлениями — нужно минимум ${MIN_REVIEW_LENGTH} символов.` } as const;
  if (length < DETAILED_REVIEW_LENGTH) return { level: 'enough', message: 'Отзыв уже можно опубликовать. Дополните его впечатлениями о вкусе, дизайне или составе.' } as const;
  return { level: 'detailed', message: 'Хороший, подробный отзыв — он поможет другим людям с выбором.' } as const;
}

export type ReviewField = 'design' | 'taste' | 'text';

export interface ReviewInputData {
  design: number;
  taste: number;
  text: string;
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

  if (Object.keys(errors).length > 0) return { errors };

  return {
    data: {
      design: parsed.design!,
      taste: parsed.taste!,
      text: parsed.text!,
    },
  };
}
