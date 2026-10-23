/** Form rules for a drink a member adds to the catalog (shared by the form in the browser and the server). */
export class CatalogDrinkError extends Error {}

export const DRINK_VOLUME_PRESETS = [250, 330, 450, 500] as const;
export const MAX_DRINK_VOLUMES = 6;
export const MAX_DRINK_FLAVORS = 3;
export const MAX_DRINK_INGREDIENTS = 1500;
/** The optional full name from the can, «Monster Ultra Paradise»: search finds the drink by it. */
export const MAX_DRINK_FULL_NAME = 80;
/** Pending requests one member may have at once. */
export const MAX_PENDING_DRINKS = 10;

export interface CatalogDrinkInput { brand: string; flavor: string; fullName: string; volumes: number[]; ingredients: string }

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
/** Sugar of the can: `free` — zero sugar (`:sugarfree`), `sweetener` — part of it swapped for a sweetener (`:sweetener`). */
export type DrinkSugar = 'regular' | 'free' | 'sweetener';
export const DRINK_SUGAR_SUFFIX: Record<DrinkSugar, string> = { regular: '', free: ':sugarfree', sweetener: ':sweetener' };
export const DRINK_SUGAR_NAME: Record<DrinkSugar, string> = { regular: '', free: ' · без сахара', sweetener: ' · с сахарозаменителем' };
export const isDrinkSugar = (value: unknown): value is DrinkSugar => value === 'regular' || value === 'free' || value === 'sweetener';

export function drinkFlavorKey({ flavors, custom = [], sugar }: { flavors: string[]; custom?: string[]; sugar: DrinkSugar }): string {
  const parts = [...new Set([...flavors, ...custom.map(ownFlavorName).filter(Boolean)])].sort();
  const base = parts.length > 1 ? `blend:${parts.join('+')}` : parts[0] ?? '';
  return base ? `${base}${DRINK_SUGAR_SUFFIX[sugar]}` : base;
}

/** Checks the own flavour name: free text, but without the characters the catalog keys are built from. */
export function customFlavorProblem(value: string): string | null {
  const name = collapse(value);
  if (!name) return null;
  if (name.length < 2 || name.length > 60) return 'Название вкуса — от 2 до 60 символов.';
  if (/[:+]/u.test(name) || /^(?:blend|unknown|unresolved|sugarfree|sweetener)$/iu.test(name)) return 'Название вкуса не должно содержать «:» и «+».';
  return null;
}

/** Reads and checks the form; `knownFlavors` are the keys the browser could offer. */
export function parseCatalogDrink(form: FormData, knownFlavors: ReadonlySet<string>): CatalogDrinkInput {
  return { ...parseIdentity(form, knownFlavors), fullName: parseFullName(form), volumes: parseVolumes(form), ingredients: parseIngredients(form) };
}

/** Brand, the flavours picked from the list or typed (`flavor`/`customFlavor`) and the sugar choice, as one catalog key. */
function parseIdentity(form: FormData, knownFlavors: ReadonlySet<string>): { brand: string; flavor: string } {
  const brand = collapse(String(form.get('brand') ?? ''));
  if (brand.length < 2 || brand.length > 40) throw new CatalogDrinkError('Укажите бренд — от 2 до 40 символов.');
  const custom = form.getAll('customFlavor').map(String).filter(value => collapse(value));
  const problem = custom.map(customFlavorProblem).find(Boolean);
  if (problem) throw new CatalogDrinkError(problem);
  const flavors = form.getAll('flavor').map(String);
  if (flavors.some(key => !knownFlavors.has(key))) throw new CatalogDrinkError('Неизвестный вкус в списке. Обновите страницу.');
  if (flavors.length + custom.length > MAX_DRINK_FLAVORS) throw new CatalogDrinkError(`Можно указать до ${MAX_DRINK_FLAVORS} вкусов.`);
  if (!custom.length && !flavors.length) throw new CatalogDrinkError('Укажите вкус: выберите из подсказок или впишите свой.');
  const sugar = form.get('sugar') ?? 'regular';
  if (!isDrinkSugar(sugar)) throw new CatalogDrinkError('Выберите, есть ли в напитке сахар.');
  return { brand, flavor: drinkFlavorKey({ flavors, custom, sugar }) };
}

/**
 * The other way round, for editing a drink in the same inputs: the key's parts (catalog keys, or own names) and the
 * sugar choice. `blend:lime+Лемонграсс` → `['lime', 'Лемонграсс']`, regular.
 */
export function splitDrinkFlavorKey(key: string): { parts: string[]; sugar: DrinkSugar } {
  const sugar: DrinkSugar = key.endsWith(':sugarfree') ? 'free' : key.endsWith(':sweetener') ? 'sweetener' : 'regular';
  const base = key.slice(0, key.length - DRINK_SUGAR_SUFFIX[sugar].length);
  return { parts: base.startsWith('blend:') ? base.slice(6).split('+').filter(Boolean) : [base], sugar };
}

function parseFullName(form: FormData): string {
  const fullName = collapse(String(form.get('fullName') ?? ''));
  if (fullName && (fullName.length < 2 || fullName.length > MAX_DRINK_FULL_NAME)) throw new CatalogDrinkError(`Полное название — от 2 до ${MAX_DRINK_FULL_NAME} символов.`);
  return fullName;
}

/** Volumes from `volume` fields, or one comma-separated `volumes` field (the admin form). */
function parseVolumes(form: FormData): number[] {
  const raw = form.has('volumes') ? String(form.get('volumes')).split(/[\s,;]+/u).filter(Boolean) : form.getAll('volume').map(String);
  const volumes = [...new Set(raw.map(value => Number(value)))].sort((a, b) => a - b);
  if (!volumes.length || volumes.length > MAX_DRINK_VOLUMES || volumes.some(volume => !Number.isInteger(volume) || volume < 100 || volume > 2000)) {
    throw new CatalogDrinkError(`Укажите от 1 до ${MAX_DRINK_VOLUMES} объёмов от 100 до 2000 мл.`);
  }
  return volumes;
}

function parseIngredients(form: FormData): string {
  const ingredients = String(form.get('ingredients') ?? '').replace(/\r\n?/gu, '\n').replace(/[ \t]+/gu, ' ').replace(/\n{3,}/gu, '\n\n').trim();
  if (ingredients.length > MAX_DRINK_INGREDIENTS) throw new CatalogDrinkError(`Состав — не длиннее ${MAX_DRINK_INGREDIENTS} символов.`);
  return ingredients;
}

/** An admin's correction of a drink: the same brand, flavour and sugar inputs as the request, plus the rest. */
export type CatalogDrinkEdit = CatalogDrinkInput;
export function parseCatalogDrinkEdit(form: FormData, knownFlavors: ReadonlySet<string>): CatalogDrinkEdit {
  return parseCatalogDrink(form, knownFlavors);
}

export function volumeLabel(volume: number): string {
  return volume >= 1000 && volume % 1000 === 0 ? `${volume / 1000} л` : `${volume} мл`;
}
