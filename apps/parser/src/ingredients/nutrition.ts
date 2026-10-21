import { NUTRITION_FIELDS, NUTRITION_RANGES, isIngredientNutrition, type IngredientNutrition, type NutritionField } from '@canrush/shared';
import type { ChatMessage } from './gigachat.js';

// «Энергетическ…» alone is the shop menu («Энергетические напитки»), so only the label's own wording counts.
const KEYWORDS = /состав|пищев|энергетическая ценность|ккал|калорийн|таурин|кофеин|белк|углевод|жир/gi;
const WINDOW = 300;
const EXCERPT_CHARS = 4000;

/**
 * The parts of a shop page around the composition and the nutrition table, joined: on most pages the table sits
 * thousands of characters below the composition, behind menus, prices and similar products.
 */
export function nutritionExcerpt(text: string): string {
  const ranges: [number, number][] = [];
  for (const match of text.matchAll(KEYWORDS)) {
    const from = Math.max(0, match.index - WINDOW), to = Math.min(text.length, match.index + match[0].length + WINDOW);
    const last = ranges.at(-1);
    if (last && from <= last[1]) last[1] = Math.max(last[1], to); else ranges.push([from, to]);
  }
  return ranges.map(([from, to]) => text.slice(from, to).trim()).join('\n…\n').slice(0, EXCERPT_CHARS);
}

export function nutritionPrompt(excerpt: string): ChatMessage[] {
  return [
    { role: 'system', content: 'Ты переносишь числа с этикетки энергетического напитка из текста страницы магазина в JSON. '
      + 'Бери только числа, которые написаны в тексте. Ничего не вычисляй, не пересчитывай на банку и не угадывай: если значения нет, пиши null. '
      + 'Ответь одним JSON-объектом без пояснений.' },
    { role: 'user', content: `Текст страницы:\n"""\n${excerpt}\n"""\n\n`
      + 'Верни JSON с ключами: per ("100ml" или "100g" — на какой объём указана пищевая ценность; если не сказано, "100ml"), '
      + 'energyKcal (ккал), protein, fat, carbs, sugar (граммы), taurineMg и caffeineMg (миллиграммы на 100 мл). Каждое значение — число или null.' },
  ];
}

/** Where each value is written on a label; a match swallows the word's ending («Углеводы», «сахара»). */
const LABELS: Record<NutritionField, RegExp> = {
  energyKcal: /ккал|калорийн[а-яё]*/gi, protein: /бел(?:ок|к[а-яё]*)/gi, fat: /жир[а-яё]*/gi, carbs: /углевод[а-яё]*/gi,
  sugar: /сахар[а-яё]*/gi, taurineMg: /таурин[а-яё]*/gi, caffeineMg: /кофеин[а-яё]*/gi,
};
const HOMOGLYPHS: Record<string, string> = { a: 'а', c: 'с', e: 'е', o: 'о', p: 'р', x: 'х', y: 'у', A: 'А', C: 'С', E: 'Е', O: 'О', P: 'Р', X: 'Х', Y: 'У' };
/** Number glued to the label from the left: «14Углеводы», «60 ккал» (a single space at most, never a line break). */
const BEFORE = /^ ?$/;
/** Text allowed between a label and the number after it: «Углеводы⏎⏎11.3», «таурин (230», «кофеин (не более 30», «Жиры: 0». */
const AFTER = /^[\s:—–(-]*(?:не более|не менее|до|около)?\s*$/i;

/**
 * Decimal commas as points and Latin look-alikes inside Cyrillic words as Cyrillic («кoфеин» with a Latin o).
 * Every replacement keeps the length, so positions in the result match the original text.
 */
export function normalizeLabelText(text: string): string {
  return text.replace(/(\d),(\d)/g, '$1.$2').replace(/(?<=[а-яё])[aceopxy]|[aceopxy](?=[а-яё])/gi, (ch) => HOMOGLYPHS[ch] ?? ch);
}

/**
 * The number a label owns. Shop pages lay the table out two ways: glued into one line («0.2Белки14Углеводы60 ккал»),
 * where the number precedes its label, or as label-then-value lines («Углеводы⏎⏎11.3»). A number glued in front wins;
 * otherwise the number right after the label counts. Anything farther away never belongs to it.
 */
export function labelledNumbers(text: string, field: NutritionField): number[] {
  const normalized = normalizeLabelText(text);
  const numbers = [...normalized.matchAll(/\d+(?:\.\d+)?/g)].map((m) => ({ value: Number(m[0]), start: m.index, end: m.index + m[0].length }));
  const found = new Set<number>();
  for (const label of normalized.matchAll(LABELS[field])) {
    const from = label.index, to = label.index + label[0].length;
    const before = numbers.filter((n) => n.end <= from).at(-1);
    const after = numbers.find((n) => n.start >= to);
    if (before && BEFORE.test(normalized.slice(before.end, from))) found.add(before.value);
    else if (after && AFTER.test(normalized.slice(to, after.start))) found.add(after.value);
  }
  return [...found];
}

/** «На 100 грамм» or «на 100 мл» as written in the text; the model's guess is only a fallback. */
export function nutritionBasis(text: string): '100ml' | '100g' | null {
  if (/на\s*100\s*(?:г(?![а-яё])|гр)/i.test(text)) return '100g';
  if (/на\s*100\s*мл/i.test(text)) return '100ml';
  return null;
}

export interface NutritionResult { nutrition: IngredientNutrition | null; dropped: string[] }

/**
 * Keeps a value only when it is plausible and written next to its own label in the source text (mg may appear
 * as grams, «0,4 г» for 400 mg). Anything the model computed, invented or took from another line is dropped.
 */
export function verifyNutrition(reply: string, source: string, model: string, extractedAt: string): NutritionResult {
  const dropped: string[] = [];
  let parsed: Record<string, unknown>;
  try {
    const json = /\{[\s\S]*\}/.exec(reply.replace(/```(?:json)?/g, ''))?.[0];
    parsed = JSON.parse(json ?? '') as Record<string, unknown>;
  } catch {
    return { nutrition: null, dropped: ['invalid_json'] };
  }
  const written = (value: number, field: NutritionField) => labelledNumbers(source, field)
    .some((n) => Math.abs(n - value) < 1e-9 || (field.endsWith('Mg') && Math.abs(n * 1000 - value) < 1e-6));
  const values: Partial<Record<NutritionField, number>> = {};
  for (const field of NUTRITION_FIELDS) {
    const raw = parsed[field];
    if (raw === null || raw === undefined) continue;
    const value = typeof raw === 'string' ? Number(raw.replace(',', '.')) : raw;
    const [min, max] = NUTRITION_RANGES[field];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) dropped.push(`${field}:out_of_range`);
    else if (!written(value, field)) dropped.push(`${field}:not_in_source`);
    else values[field] = value;
  }
  const nutrition = { per: nutritionBasis(source) ?? (parsed.per === '100g' ? '100g' as const : '100ml' as const), ...values, method: 'gigachat' as const, model, extractedAt };
  return { nutrition: isIngredientNutrition(nutrition) ? nutrition : null, dropped };
}
