/** A source excerpt explicitly selected for a catalog group, not a lab-verified recipe. */
export interface PublishedIngredients {
  brand: string;
  flavor: string;
  productTitle: string;
  volumeMl: number;
  market: 'RU' | 'BY';
  ingredients: string;
  sourceName: string;
  /** The page the text came from; absent only for `ai_generated`, which has no page. */
  sourceUrl?: string;
  /** When the source was read, or when the model wrote an `ai_generated` text. */
  fetchedAt: string;
  /**
   * `source_reported` — copied from a reviewed source, `unverified` — from a source not yet checked by hand,
   * `ai_generated` — a model wrote the composition and numbers from general knowledge, without a page: shown with an «ИИ» chip.
   */
  status: 'source_reported' | 'unverified' | 'ai_generated';
  /** The model that wrote an `ai_generated` text. */
  model?: string;
  /** Explains the specific uncertainty before showing preliminary source text. */
  reviewNote?: string;
  /** Label numbers from the same source page: structured store fields or read by a model and found verbatim in its text. */
  nutrition?: IngredientNutrition;
}

/** Field → plausible range for one label of an energy drink, per 100 ml (or 100 g). */
export const NUTRITION_RANGES = {
  energyKcal: [0, 120], protein: [0, 5], fat: [0, 5], carbs: [0, 25], sugar: [0, 25], taurineMg: [0, 1000], caffeineMg: [0, 50],
} as const;
export type NutritionField = keyof typeof NUTRITION_RANGES;
export const NUTRITION_FIELDS = Object.keys(NUTRITION_RANGES) as NutritionField[];

export interface IngredientNutrition extends Partial<Record<NutritionField, number>> {
  per: '100ml' | '100g';
  /**
   * Never a verified lab value: `store` — the shop card's own nutrition fields, `gigachat` — read from the page text,
   * `ai` — written by a model from general knowledge (only on `ai_generated` records).
   */
  method: 'gigachat' | 'store' | 'ai';
  /** The model; absent for store fields. */
  model?: string;
  extractedAt: string;
}

export function isIngredientNutrition(value: unknown): value is IngredientNutrition {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  if (!['100ml', '100g'].includes(row.per as string) || !['gigachat', 'store', 'ai'].includes(row.method as string)) return false;
  const model = row.model;
  if (row.method !== 'store' ? typeof model !== 'string' || !model.trim() || model.length > 60 : model !== undefined) return false;
  if (!Number.isFinite(Date.parse(row.extractedAt as string))) return false;
  const known = new Set<string>(['per', 'method', 'model', 'extractedAt', ...NUTRITION_FIELDS]);
  if (Object.keys(row).some((key) => !known.has(key))) return false;
  const present = NUTRITION_FIELDS.filter((field) => row[field] !== undefined);
  return present.length > 0 && present.every((field) => {
    const number = row[field];
    const [min, max] = NUTRITION_RANGES[field];
    return typeof number === 'number' && Number.isFinite(number) && number >= min && number <= max;
  });
}

export function isPublishedIngredients(value: unknown): value is PublishedIngredients {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  for (const key of ['brand', 'flavor', 'productTitle', 'ingredients', 'sourceName', 'fetchedAt']) {
    if (typeof row[key] !== 'string' || !row[key].trim()) return false;
  }
  if ((row.ingredients as string).length > 2500 || (row.ingredients as string).length < 35) return false;
  if (!['source_reported', 'unverified', 'ai_generated'].includes(row.status as string) || !['RU', 'BY'].includes(row.market as string)) return false;
  if (row.reviewNote !== undefined && (typeof row.reviewNote !== 'string' || !row.reviewNote.trim() || row.reviewNote.length > 500)) return false;
  if (row.status === 'unverified' && typeof row.reviewNote !== 'string') return false;
  if (!Number.isInteger(row.volumeMl) || (row.volumeMl as number) <= 0 || (row.volumeMl as number) > 5000) return false;
  if (!Number.isFinite(Date.parse(row.fetchedAt as string))) return false;
  if (row.nutrition !== undefined && !isIngredientNutrition(row.nutrition)) return false;
  // Model-written numbers live only on model-written records, so a sourced card never shows them as the shop's.
  const aiNutrition = (row.nutrition as { method?: unknown } | undefined)?.method === 'ai';
  if (row.status === 'ai_generated') {
    // Written from general knowledge: no page to point at, and any numbers are marked as the model's.
    const model = row.model;
    return row.sourceUrl === undefined && (row.nutrition === undefined || aiNutrition) && typeof model === 'string' && !!model.trim() && model.length <= 60;
  }
  if (row.model !== undefined || aiNutrition) return false;
  try {
    const url = new URL(row.sourceUrl as string);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
}
