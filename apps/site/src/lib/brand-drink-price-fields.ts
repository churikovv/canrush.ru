/** A brand's price ceiling: rules shared by the cabinet's form and the server. */
export class DrinkPriceError extends Error {}

/** Volume in ml (100–2000) and the ceiling in roubles with kopecks («119,90»). */
export function parseDrinkPrice(form: FormData): { volumeMl: number; maxPrice: number } {
  const volumeMl = Number(String(form.get('volume') ?? '').replace(/\s/g, ''));
  if (!Number.isInteger(volumeMl) || volumeMl < 100 || volumeMl > 2000) throw new DrinkPriceError('Объём — целое число от 100 до 2000 мл.');
  const raw = String(form.get('price') ?? '').replace(/\s/g, '').replace(',', '.');
  const maxPrice = Math.round(Number(raw) * 100) / 100;
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw) || maxPrice <= 0 || maxPrice >= 100000) throw new DrinkPriceError('Цена — число больше нуля, до двух знаков после запятой.');
  return { volumeMl, maxPrice };
}

/** A shop offer of the same can as a ceiling: 449 and 450 ml are one can. */
export const sameVolume = (a: number | undefined | null, b: number) => a !== undefined && a !== null && Math.abs(a - b) <= 10;
