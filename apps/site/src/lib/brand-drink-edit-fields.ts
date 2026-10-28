import { BusinessError } from '@/lib/business-fields';

/** A company's proposed correction of a drink card: the fields it may change (empty ones stay as they are). */
export interface DrinkEditInput { fullName: string | null; ingredients: string | null; description: string | null; note: string | null }

export const DRINK_EDIT_LIMITS = { fullName: 80, ingredients: 1500, ingredientsMin: 35, description: 600, note: 300 } as const;

const field = (form: FormData, key: string) => { const value = form.get(key); return typeof value === 'string' ? value.replace(/\r\n?/g, '\n').trim() : ''; };

/**
 * The fields of the edit form, checked the same in the browser and on the server. The full name is one line, the
 * composition keeps its lines; a new photo is checked separately. Nothing to change is an error.
 */
export function parseDrinkEdit(form: FormData, hasPhoto: boolean): DrinkEditInput {
  const fullName = field(form, 'fullName').replace(/\s+/g, ' ');
  const ingredients = field(form, 'ingredients').replace(/[^\S\n]+/g, ' ').replace(/\n{3,}/g, '\n\n');
  const description = field(form, 'description').replace(/[^\S\n]+/g, ' ').replace(/\n{3,}/g, '\n\n');
  const note = field(form, 'note').replace(/\s+/g, ' ');
  if (fullName.length > DRINK_EDIT_LIMITS.fullName) throw new BusinessError(`Полное название — до ${DRINK_EDIT_LIMITS.fullName} символов.`);
  if (ingredients && ingredients.length < DRINK_EDIT_LIMITS.ingredientsMin) throw new BusinessError(`Состав — целиком с этикетки, от ${DRINK_EDIT_LIMITS.ingredientsMin} символов.`);
  if (ingredients.length > DRINK_EDIT_LIMITS.ingredients) throw new BusinessError(`Состав — до ${DRINK_EDIT_LIMITS.ingredients} символов.`);
  if (description.length > DRINK_EDIT_LIMITS.description) throw new BusinessError(`Описание — до ${DRINK_EDIT_LIMITS.description} символов.`);
  if (note.length > DRINK_EDIT_LIMITS.note) throw new BusinessError(`Комментарий — до ${DRINK_EDIT_LIMITS.note} символов.`);
  if (!fullName && !ingredients && !description && !hasPhoto) throw new BusinessError('Измените хотя бы одно поле или добавьте фото.');
  return { fullName: fullName || null, ingredients: ingredients || null, description: description || null, note: note || null };
}
