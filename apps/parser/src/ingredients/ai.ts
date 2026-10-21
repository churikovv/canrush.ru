import { NUTRITION_FIELDS, NUTRITION_RANGES, isIngredientNutrition, type IngredientNutrition, type NutritionField } from '@canrush/shared';
import { extractIngredients } from './core.js';
import type { ChatMessage } from './gigachat.js';

/**
 * A composition and label numbers written by GigaChat from general knowledge, for products with no source page.
 * Published as `ai_generated` with an «ИИ» chip; anything sourced replaces it.
 */
export function aiPrompt(title: string, volumeMl: number): ChatMessage[] {
  return [
    { role: 'system', content: 'Ты знаешь энергетические напитки, которые продаются в России. Отвечай только про этот напиток: бренд, вкус и версию '
      + '(с сахаром или без). Если не знаешь его состав уверенно, ответь known: false — это лучше, чем придумать. Ответь одним JSON-объектом без пояснений.' },
    { role: 'user', content: `Напиток: «${title}», ${volumeMl} мл.\n`
      + 'Верни JSON: known (true или false), ingredients (состав как на этикетке, через запятую, или null), '
      + 'per ("100ml"), energyKcal (ккал), protein, fat, carbs, sugar (граммы), taurineMg и caffeineMg (миллиграммы) — на 100 мл, числа или null.' },
  ];
}

/** «Без сахара», «Zero», «Sugar free» in the title or a `…:sugarfree` flavor key. */
export function isSugarFree(flavor: string, title: string): boolean {
  return flavor === 'sugarfree' || flavor.endsWith(':sugarfree') || /без\s+сахара|zero|sugar\s*-?\s*free/i.test(title);
}
/** What a drink without sugar can plausibly declare per 100 ml. */
const SUGAR_FREE_LIMITS: Partial<Record<NutritionField, number>> = { sugar: 1, carbs: 2, energyKcal: 15 };

export interface AiResult { ingredients: string | null; nutrition: IngredientNutrition | null; dropped: string[] }

export function verifyAiReply(reply: string, flavor: string, title: string, model: string, generatedAt: string): AiResult {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(/\{[\s\S]*\}/.exec(reply.replace(/```(?:json)?/g, ''))?.[0] ?? '') as Record<string, unknown>;
  } catch {
    return { ingredients: null, nutrition: null, dropped: ['invalid_json'] };
  }
  if (parsed.known !== true) return { ingredients: null, nutrition: null, dropped: ['unknown'] };
  const dropped: string[] = [];
  const sugarFree = isSugarFree(flavor, title);
  let ingredients = typeof parsed.ingredients === 'string' ? parsed.ingredients.trim().replace(/\s+/g, ' ') : null;
  if (ingredients && (ingredients.length < 35 || ingredients.length > 2500 || !/вод/i.test(ingredients))) { dropped.push('ingredients:implausible'); ingredients = null; }
  // The shared sugar check: «сахар» in a list for a sugar-free version means the model described another drink.
  if (ingredients && extractIngredients(`Состав: ${ingredients}`, sugarFree ? `${title} без сахара` : title).warnings.includes('possible_sugar_conflict')) {
    return { ingredients: null, nutrition: null, dropped: ['sugar_conflict'] };
  }
  const values: Partial<Record<NutritionField, number>> = {};
  for (const field of NUTRITION_FIELDS) {
    const raw = parsed[field];
    if (raw === null || raw === undefined) continue;
    const value = typeof raw === 'string' ? Number(raw.replace(',', '.')) : raw;
    const [min, max] = NUTRITION_RANGES[field];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) { dropped.push(`${field}:out_of_range`); continue; }
    values[field] = value;
  }
  // Numbers of a sugared drink on a sugar-free one mean the model mixed up versions: none of them can be trusted.
  if (sugarFree && Object.entries(SUGAR_FREE_LIMITS).some(([field, limit]) => (values[field as NutritionField] ?? 0) > limit!)) {
    return { ingredients, nutrition: null, dropped: [...dropped, 'nutrition:sugar_conflict'] };
  }
  const nutrition = { per: '100ml' as const, ...values, method: 'ai' as const, model, extractedAt: generatedAt };
  return { ingredients, nutrition: isIngredientNutrition(nutrition) ? nutrition : null, dropped };
}

/** Share of the reference list's words the model also named: a rough check of a list, not a proof. */
export function ingredientOverlap(reference: string, candidate: string): number {
  const words = (text: string) => new Set(text.toLowerCase().match(/[а-яёa-z]{4,}/g) ?? []);
  const expected = words(reference), got = words(candidate);
  return expected.size ? [...expected].filter((word) => got.has(word)).length / expected.size : 0;
}
