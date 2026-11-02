/** A catalog drink on a wall record or a comment, as the page shows it: no `href` when it has left the catalog. */
export interface WallDrink { brand: string; flavor: string; label: string; href?: string; cover?: string }

/**
 * The drink a form carries (`drinkBrand`, `drinkFlavor`), checked for shape only: the server checks that it is in the
 * catalog. Null when the form has none.
 */
export function drinkFromForm(form: FormData): { brand: string; flavor: string } | null {
  const brand = form.get('drinkBrand'), flavor = form.get('drinkFlavor');
  if (typeof brand !== 'string' || typeof flavor !== 'string' || !brand.trim() || !flavor.trim()) return null;
  if (brand.length > 60 || flavor.length > 160) return null;
  return { brand, flavor };
}
