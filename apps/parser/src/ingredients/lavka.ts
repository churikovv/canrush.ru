import { NUTRITION_RANGES, isIngredientNutrition, type IngredientNutrition, type NutritionField } from '@canrush/shared';
import { extractLavkaState } from '../adapters/lavka.js';
import { normalizeLabelText } from './nutrition.js';

/** Fields of a Lavka card's nutrition block (`options.ingredients.pfcTraits`). */
const PFC: Record<string, NutritionField> = { calories: 'energyKcal', protein: 'protein', fat: 'fat', carbohydrate: 'carbs', sugar: 'sugar' };

interface LavkaCardGood {
  deepLink?: string;
  longTitle?: string;
  title?: string;
  amount?: string;
  options?: { ingredients?: { pfcTraits?: { id?: string; measures?: { per100g?: string } }[]; pfcSettings?: { per100gTitle?: string } } };
  descriptionBlocks?: { type?: string; value?: string; attributes?: string[] }[];
}

export interface LavkaCard {
  title: string;
  /** «Полный состав» as written by Lavka; the «Краткий состав» block is AI-made (`aiIngredients`) and is never used. */
  ingredients: string | null;
  nutrition: IngredientNutrition | null;
}

const DOSE_LABELS = { taurineMg: 'таурин', caffeineMg: 'кофеин' } as const;
const DOSE_UNITS: Record<string, number> = { мг: 1, г: 1000, '%': 1000 };

/**
 * A dose written in the composition, in mg per 100 ml: «таурин (400 мг/100 мл)», «таурин 0,4 г», «таурин (0,4%)» —
 * a per cent of a drink is grams per 100 g. A number without a unit is ambiguous and is never taken; two different
 * doses for one label mean no value either.
 */
export function compositionDose(text: string, field: keyof typeof DOSE_LABELS): number | undefined {
  const pattern = new RegExp(`${DOSE_LABELS[field]}[а-яё]*\\s*[(:—–-]*\\s*(?:не более|не менее|до|около)?\\s*(\\d+(?:\\.\\d+)?)\\s*(мг|г|%)(?![а-яё])`, 'gi');
  const doses = new Set([...normalizeLabelText(text).matchAll(pattern)].map((m) => Math.round(Number(m[1]) * DOSE_UNITS[m[2]!.toLowerCase()]! * 1000) / 1000));
  const [value] = doses;
  const [min, max] = NUTRITION_RANGES[field];
  return doses.size === 1 && value! >= min && value! <= max ? value : undefined;
}

/**
 * Reads a product card page of the big Lavka. The card answers 404 yet still renders its SSR state, so the caller
 * accepts that status; the good is matched by its deep link, never «the first one on the page».
 */
export function parseLavkaCard(html: string, deepLink: string, extractedAt: string): LavkaCard | null {
  const state = extractLavkaState(html) as { products?: { supermarket?: LavkaCardGood[] } } | undefined;
  const good = state?.products?.supermarket?.find((item) => item.deepLink === deepLink);
  if (!good) return null;
  const ingredients = good.descriptionBlocks?.find((block) => block.attributes?.includes('ingredientsLoc'))?.value?.trim() || null;
  const values: Partial<Record<NutritionField, number>> = {};
  for (const trait of good.options?.ingredients?.pfcTraits ?? []) {
    const field = trait.id ? PFC[trait.id] : undefined;
    const value = Number(trait.measures?.per100g?.replace(',', '.'));
    if (!field || !trait.measures?.per100g || !Number.isFinite(value)) continue;
    const [min, max] = NUTRITION_RANGES[field];
    if (value >= min && value <= max) values[field] = value;
  }
  if (ingredients) {
    for (const field of ['taurineMg', 'caffeineMg'] as const) {
      const value = compositionDose(ingredients, field);
      if (value !== undefined) values[field] = value;
    }
  }
  const per = /100\s*мл/i.test(good.options?.ingredients?.pfcSettings?.per100gTitle ?? '') ? '100ml' as const : '100g' as const;
  const nutrition = { per, ...values, method: 'store' as const, extractedAt };
  const title = [good.longTitle ?? good.title, good.amount].filter(Boolean).join(', ').replace(/\u00ad/g, '');
  return { title, ingredients, nutrition: isIngredientNutrition(nutrition) ? nutrition : null };
}
