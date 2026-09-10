export type ReviewField = 'design' | 'taste' | 'composition' | 'text';

export interface ReviewInputData {
  design: number;
  taste: number;
  composition: number;
  text: string;
}

export type ReviewFieldErrors = Partial<Record<ReviewField, string>>;

export type ReviewValidationResult =
  | { data: ReviewInputData; errors?: never }
  | { data?: never; errors: ReviewFieldErrors };

const CRITERIA: Array<{ field: 'design' | 'taste' | 'composition'; label: string }> = [
  { field: 'design', label: 'Дизайн' },
  { field: 'taste', label: 'Вкус' },
  { field: 'composition', label: 'Состав' },
];

export function parseRating(value: string): number | undefined {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 5) return undefined;
  return n;
}

export function validateReviewInput(values: {
  design: string;
  taste: string;
  composition: string;
  text: string;
}): ReviewValidationResult {
  const errors: ReviewFieldErrors = {};
  const parsed: Partial<ReviewInputData> = {};

  for (const { field } of CRITERIA) {
    const rating = parseRating(values[field]);
    if (rating === undefined) {
      errors[field] = 'Поставьте оценку от 1 до 5.';
    } else {
      parsed[field] = rating;
    }
  }

  const text = values.text.trim().replace(/\s+/gu, ' ');
  if (!text) {
    errors.text = 'Напишите отзыв.';
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
      composition: parsed.composition!,
      text: parsed.text!,
    },
  };
}
