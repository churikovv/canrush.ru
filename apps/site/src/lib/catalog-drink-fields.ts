/** Form rules for a drink a member adds to the catalog (shared by the form in the browser and the server). */
export class CatalogDrinkError extends Error {}

export const DRINK_VOLUME_PRESETS = [250, 330, 450, 500] as const;
export const MAX_DRINK_VOLUMES = 6;
export const MAX_DRINK_FLAVORS = 3;
export const MAX_DRINK_INGREDIENTS = 1500;
/** Pending requests one member may have at once. */
export const MAX_PENDING_DRINKS = 10;

export interface CatalogDrinkInput { brand: string; flavor: string; volumes: number[]; ingredients: string }

const collapse = (value: string) => value.replace(/\s+/gu, ' ').trim();
const capitalise = (value: string) => value.charAt(0).toLocaleUpperCase('ru-RU') + value.slice(1);

/** A member's own flavour as it is stored: spaces collapsed, first letter capital. */
export function ownFlavorName(value: string): string {
  return capitalise(collapse(value));
}

/**
 * The catalog identity of the flavour: one flavour as is, two or three as a sorted `blend:` — known keys and the
 * member's own names alike (`flavorName` shows an unknown part as written); `:sugarfree` marks a zero-sugar can, as in
 * the parser's keys, so `flavorName` shows «… · без сахара».
 */
export function drinkFlavorKey({ flavors, custom = [], sugarFree }: { flavors: string[]; custom?: string[]; sugarFree: boolean }): string {
  const parts = [...new Set([...flavors, ...custom.map(ownFlavorName).filter(Boolean)])].sort();
  const base = parts.length > 1 ? `blend:${parts.join('+')}` : parts[0] ?? '';
  return base && sugarFree ? `${base}:sugarfree` : base;
}

/** Checks the own flavour name: free text, but without the characters the catalog keys are built from. */
export function customFlavorProblem(value: string): string | null {
  const name = collapse(value);
  if (!name) return null;
  if (name.length < 2 || name.length > 60) return 'Название вкуса — от 2 до 60 символов.';
  if (/[:+]/u.test(name) || /^(?:blend|unknown|unresolved|sugarfree)$/iu.test(name)) return 'Название вкуса не должно содержать «:» и «+».';
  return null;
}

/** Reads and checks the form; `knownFlavors` are the keys the browser could offer. */
export function parseCatalogDrink(form: FormData, knownFlavors: ReadonlySet<string>): CatalogDrinkInput {
  const brand = collapse(String(form.get('brand') ?? ''));
  if (brand.length < 2 || brand.length > 40) throw new CatalogDrinkError('Укажите бренд — от 2 до 40 символов.');
  const custom = form.getAll('customFlavor').map(String).filter(value => collapse(value));
  const problem = custom.map(customFlavorProblem).find(Boolean);
  if (problem) throw new CatalogDrinkError(problem);
  const flavors = form.getAll('flavor').map(String);
  if (flavors.some(key => !knownFlavors.has(key))) throw new CatalogDrinkError('Неизвестный вкус в списке. Обновите страницу.');
  if (flavors.length + custom.length > MAX_DRINK_FLAVORS) throw new CatalogDrinkError(`Можно указать до ${MAX_DRINK_FLAVORS} вкусов.`);
  if (!custom.length && !flavors.length) throw new CatalogDrinkError('Укажите вкус: выберите из подсказок или впишите свой.');
  const flavor = drinkFlavorKey({ flavors, custom, sugarFree: form.get('sugarFree') === 'on' });
  const volumes = [...new Set(form.getAll('volume').map(value => Number(value)))].sort((a, b) => a - b);
  if (!volumes.length || volumes.length > MAX_DRINK_VOLUMES || volumes.some(volume => !Number.isInteger(volume) || volume < 100 || volume > 2000)) {
    throw new CatalogDrinkError(`Укажите от 1 до ${MAX_DRINK_VOLUMES} объёмов от 100 до 2000 мл.`);
  }
  const ingredients = String(form.get('ingredients') ?? '').replace(/\r\n?/gu, '\n').replace(/[ \t]+/gu, ' ').replace(/\n{3,}/gu, '\n\n').trim();
  if (ingredients.length > MAX_DRINK_INGREDIENTS) throw new CatalogDrinkError(`Состав — не длиннее ${MAX_DRINK_INGREDIENTS} символов.`);
  return { brand, flavor, volumes, ingredients };
}

export function volumeLabel(volume: number): string {
  return volume >= 1000 && volume % 1000 === 0 ? `${volume / 1000} л` : `${volume} мл`;
}
