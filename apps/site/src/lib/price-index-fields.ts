/**
 * «Индекс цен на энергетики» на странице цен: расчёт без файлов и базы.
 *
 * Вход — ежедневные срезы предложений парсера по городам. День сводится в строки позиций (`dayRows`): позиция — город ×
 * сеть × бренд × вкус × объём, у неё цена банки «с акцией» (что платят) и «на полке» (зачёркнутая цена у акции, иначе
 * обычная; у акции без зачёркнутой цены полка неизвестна). Упаковки пересчитываются в банку («355 мл x 24 шт»), явный
 * мусор (меньше 60 или больше 2500 ₽ за литр) отбрасывается.
 *
 * Из дней складывается месяц (`monthSlice`: средние цены позиций), из месяца и фильтра (город, бренд) — вид страницы
 * (`indexView`): типичная банка, изменение к прошлому месяцу, города и сети к среднему по одинаковым напиткам, бренды за
 * литр. Ряд за 90 дней (`buildSeries`) — цепной индекс тех же позиций день к дню, переведённый в рубли типичной банки.
 */
export interface IndexOffer {
  source: string; name?: string; brand?: string; flavor?: string; retailer?: string; volumeMl?: number;
  price?: number; oldPrice?: number; promoEndsAt?: string;
}

const MIN_PER_LITRE = 60;
const MAX_PER_LITRE = 2500;
const lower = (value: string) => value.toLocaleLowerCase('ru-RU');

/** Cans in a pack from the shop's title: «355мл x 24 шт», «24 х 0,45 л», «упаковка 12 шт». One can otherwise. */
export function packCount(name: string | undefined): number {
  if (!name) return 1;
  const text = lower(name).replace(/\s+/gu, ' ');
  const match = /[x×х]\s?(\d{1,2})\s?шт/u.exec(text) ?? /(\d{1,2})\s?шт\.?\s?[x×х]/u.exec(text) ?? /(\d{1,2})\s?[x×х]\s?\d/u.exec(text) ?? /упаковк[аи]\s(\d{1,2})\s?шт/u.exec(text);
  const count = match ? Number(match[1]) : 1;
  return count >= 2 && count <= 48 ? count : 1;
}

/** One offer as the index reads it: the price of one can paid and on the shelf, or null for what it cannot use. */
export function canPrices(offer: IndexOffer): { paid: number; shelf: number | null; promo: boolean } | null {
  const brand = offer.brand?.trim();
  if (!brand || ['unknown', 'undefined'].includes(lower(brand)) || !offer.flavor || /^(?:unknown|unresolved)/u.test(offer.flavor)) return null;
  const volume = offer.volumeMl ?? 0;
  if (!offer.price || offer.price <= 0 || volume < 150 || volume > 1000) return null;
  const count = packCount(offer.name);
  const paid = offer.price / count;
  const perLitre = paid / volume * 1000;
  if (perLitre < MIN_PER_LITRE || perLitre > MAX_PER_LITRE) return null;
  const old = offer.oldPrice && offer.oldPrice > offer.price ? offer.oldPrice / count : null;
  const promo = Boolean(old || offer.promoEndsAt);
  return { paid, shelf: old ?? (promo ? null : paid), promo };
}

/** A position's prices on one day. */
export interface DayRow { city: string; retailer: string; brand: string; flavor: string; volumeMl: number; paid: number; shelf: number | null; promo: boolean }
export const rowKey = (row: Pick<DayRow, 'city' | 'retailer' | 'brand' | 'flavor' | 'volumeMl'>) => `${row.city}|${row.retailer}|${row.brand}|${row.flavor}|${row.volumeMl}`;

/** A city's day as positions: the same position twice (two offers) counts once, at its lower price. */
export function dayRows(city: string, offers: readonly IndexOffer[]): DayRow[] {
  const rows = new Map<string, DayRow>();
  for (const offer of offers) {
    const prices = canPrices(offer);
    if (!prices) continue;
    const row: DayRow = { city, retailer: offer.retailer ?? offer.source, brand: offer.brand!.trim(), flavor: offer.flavor!, volumeMl: offer.volumeMl!, ...prices };
    const key = rowKey(row), before = rows.get(key);
    if (!before || row.paid < before.paid) rows.set(key, row);
  }
  return [...rows.values()];
}

/** A position over a month: average prices, days seen, promo days and the average promo discount (a share). */
export interface MonthPosition {
  city: string; retailer: string; brand: string; flavor: string; volumeMl: number;
  paid: number; shelf: number | null; days: number; promoDays: number; discount: number | null;
}
export interface MonthSlice { month: string; days: string[]; cityDays: Record<string, number>; positions: MonthPosition[] }

/** The month from its days (each day — all cities' rows). */
export function monthSlice(month: string, days: readonly { day: string; rows: readonly DayRow[] }[]): MonthSlice {
  const sums = new Map<string, { row: DayRow; paid: number; shelf: number; shelfDays: number; days: number; promoDays: number; discount: number; discountDays: number }>();
  const cityDays = new Map<string, Set<string>>();
  for (const { day, rows } of days) {
    if (!day.startsWith(month)) continue;
    for (const row of rows) {
      const set = cityDays.get(row.city) ?? new Set<string>();
      set.add(day); cityDays.set(row.city, set);
      const key = rowKey(row);
      const sum = sums.get(key) ?? { row, paid: 0, shelf: 0, shelfDays: 0, days: 0, promoDays: 0, discount: 0, discountDays: 0 };
      sum.paid += row.paid; sum.days++;
      if (row.shelf !== null) { sum.shelf += row.shelf; sum.shelfDays++; }
      if (row.promo) sum.promoDays++;
      if (row.promo && row.shelf !== null && row.shelf > row.paid) { sum.discount += 1 - row.paid / row.shelf; sum.discountDays++; }
      sums.set(key, sum);
    }
  }
  const allDays = new Set<string>();
  cityDays.forEach(set => set.forEach(day => allDays.add(day)));
  return {
    month, days: [...allDays].sort(), cityDays: Object.fromEntries([...cityDays].map(([city, set]) => [city, set.size])),
    positions: [...sums.values()].map(({ row, ...sum }) => ({
      city: row.city, retailer: row.retailer, brand: row.brand, flavor: row.flavor, volumeMl: row.volumeMl,
      paid: sum.paid / sum.days, shelf: sum.shelfDays ? sum.shelf / sum.shelfDays : null, days: sum.days, promoDays: sum.promoDays,
      discount: sum.discountDays ? sum.discount / sum.discountDays : null,
    })),
  };
}

/** The slice for a file: names once in a dictionary, a position as a row of numbers (a third of the size). */
export interface PackedSlice { month: string; days: string[]; cityDays: Record<string, number>; names: string[]; rows: number[][] }
export function packSlice(slice: MonthSlice): PackedSlice {
  const names: string[] = [], index = new Map<string, number>();
  const id = (name: string) => { let found = index.get(name); if (found === undefined) { found = names.length; names.push(name); index.set(name, found); } return found; };
  const round = (value: number) => Math.round(value * 100) / 100;
  return { month: slice.month, days: slice.days, cityDays: slice.cityDays, names, rows: slice.positions.map(position => [
    id(position.city), id(position.retailer), id(position.brand), id(position.flavor), position.volumeMl, round(position.paid),
    position.shelf === null ? -1 : round(position.shelf), position.days, position.promoDays, position.discount === null ? -1 : Math.round(position.discount * 1000) / 1000,
  ]) };
}
export function unpackSlice(packed: PackedSlice): MonthSlice {
  const name = (value: number | undefined) => packed.names[value ?? -1] ?? '';
  return { month: packed.month, days: packed.days, cityDays: packed.cityDays, positions: packed.rows.map(row => ({
    city: name(row[0]), retailer: name(row[1]), brand: name(row[2]), flavor: name(row[3]), volumeMl: row[4]!, paid: row[5]!,
    shelf: row[6]! < 0 ? null : row[6]!, days: row[7]!, promoDays: row[8]!, discount: row[9]! < 0 ? null : row[9]!,
  })) };
}

export function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}
function push<T>(map: Map<string, T[]>, key: string, value: T): void {
  const list = map.get(key);
  if (list) list.push(value); else map.set(key, [value]);
}
const geometric = (ratios: readonly number[]) => Math.exp(ratios.reduce((sum, ratio) => sum + Math.log(ratio), 0) / ratios.length);
const percent = (ratio: number) => Math.round((ratio - 1) * 1000) / 10;
const money = (value: number | null) => value === null ? null : Math.round(value * 100) / 100;
/** 449 and 450 ml are one can, «0,45». */
export const canVolume = (volumeMl: number) => Math.abs(volumeMl - 450) <= 10 ? 450 : volumeMl;
/** «0,45 л», «0,355 л», «1 л». */
export const volumeLabel = (volumeMl: number) => `${(volumeMl / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 3 })} л`;

/** The volume most positions of a list have — the selection's «typical can» (0,45 for most, 0,25 for Red Bull). */
export function mainVolume(positions: readonly { volumeMl: number }[]): number | null {
  const counts = new Map<number, number>();
  for (const position of positions) { const volume = canVolume(position.volumeMl); counts.set(volume, (counts.get(volume) ?? 0) + 1); }
  let best: number | null = null, top = 0;
  for (const [volume, count] of counts) if (count > top || (count === top && volume === 450)) { best = volume; top = count; }
  return best;
}

/** What the page shows: a city (else the country) and a brand (else every brand). */
export interface IndexFilter { city?: string; brand?: string }
const fits = (filter: IndexFilter) => (position: { city: string; brand: string }) =>
  (!filter.city || position.city === filter.city) && (!filter.brand || lower(position.brand) === lower(filter.brand));

export interface PriceIndexView {
  month: string; previousMonth: string | null;
  /** The month's days with data, the first and the last of them. */
  firstDay: string; lastDay: string; days: number;
  /** Positions, cities and chains in the selection. */
  positions: number; cityCount: number; retailerCount: number;
  /** The typical can of the selection: its volume and the median of its positions' month prices. */
  volumeMl: number | null; can: { shelf: number | null; paid: number | null };
  /** The month against the one before, %, over the same positions; null without enough of them. */
  change: { shelf: number | null; paid: number | null; matched: number } | null;
  /** The median promo discount, %, and the share of promos from 30% off. */
  promo: { discount: number | null; deep: number | null };
  /** Cities against the country over the same drinks on the shelf, cheapest first; `can` — the city's typical can. */
  cities: { city: string; vsAverage: number; products: number; can: number | null }[];
  /** Chains against the others in the same city over the same drinks on the shelf; `discount` — their median promo, %. */
  chains: { retailer: string; vsAverage: number; products: number; discount: number | null }[];
  /** Brands by the shelf price of a litre; `change` — % to the previous month on the same positions. */
  brands: { brand: string; perLitre: number; positions: number; change: number | null }[];
}

/** Days a position needs to count in a comparison: a third of its city's days in the month, at least two. */
const steady = (slice: MonthSlice) => (position: MonthPosition) => position.days >= Math.max(2, Math.ceil((slice.cityDays[position.city] ?? 0) / 3));

/** The previous month's positions by key, once per slice: every comparison of the page reads it. */
const byKey = new WeakMap<MonthSlice, Map<string, MonthPosition>>();
function keyed(slice: MonthSlice): Map<string, MonthPosition> {
  let map = byKey.get(slice);
  if (!map) { map = new Map(slice.positions.map(position => [rowKey(position), position])); byKey.set(slice, map); }
  return map;
}

/**
 * Same positions in two months: the geometric mean of their price changes, %, for the whole selection and per group
 * (`group` — a brand, say) in one pass.
 */
function monthChanges(current: MonthSlice, previous: MonthSlice, keep: (position: MonthPosition) => boolean, group?: (position: MonthPosition) => string) {
  const before = keyed(previous);
  const steadyNow = steady(current), steadyBefore = steady(previous);
  type Sums = { shelf: number[]; paid: number[] };
  const all: Sums = { shelf: [], paid: [] }, groups = new Map<string, Sums>();
  for (const now of current.positions) {
    if (!keep(now)) continue;
    const old = before.get(rowKey(now));
    if (!old || !steadyNow(now) || !steadyBefore(old)) continue;
    const name = group?.(now);
    const into = name === undefined ? [all] : [all, groups.get(name) ?? (groups.set(name, { shelf: [], paid: [] }), groups.get(name)!)];
    for (const sums of into) {
      sums.paid.push(now.paid / old.paid);
      if (now.shelf !== null && old.shelf !== null) sums.shelf.push(now.shelf / old.shelf);
    }
  }
  const result = (sums: Sums) => ({ shelf: sums.shelf.length ? percent(geometric(sums.shelf)) : null, paid: sums.paid.length ? percent(geometric(sums.paid)) : null, matched: sums.paid.length });
  return { all: result(all), groups: new Map([...groups].map(([name, sums]) => [name, result(sums)])) };
}

export interface ViewOptions { chainMin: number; cityMin: number; productCities: number; brandMin: number; changeMin: number; brandChangeMin: number }
/** Thresholds: the whole country asks for more evidence than one city or one brand. */
export const viewOptions = (filter: IndexFilter): ViewOptions => filter.city || filter.brand
  ? { chainMin: 8, cityMin: 5, productCities: 3, brandMin: 5, changeMin: 20, brandChangeMin: 15 }
  : { chainMin: 30, cityMin: 20, productCities: 5, brandMin: 15, changeMin: 50, brandChangeMin: 30 };

/** The page for a filter: null when the selection has no positions this month. */
export function indexView(current: MonthSlice, previous: MonthSlice | null, filter: IndexFilter = {}, options: ViewOptions = viewOptions(filter)): PriceIndexView | null {
  const keep = fits(filter);
  const positions = current.positions.filter(keep);
  if (!positions.length) return null;
  const volume = mainVolume(positions);
  const cans = positions.filter(position => canVolume(position.volumeMl) === volume);
  const change = previous ? monthChanges(current, previous, keep).all : null;
  const discounts = positions.flatMap(position => position.discount === null ? [] : [position.discount]);

  // A drink (brand × flavour × volume) in a city: the median shelf price over its chains; in the country — over cities.
  // Cities are compared on the brand filter only: the city filter picks one of them.
  const drink = (position: MonthPosition) => `${position.brand}|${position.flavor}|${canVolume(position.volumeMl)}`;
  const forCities = current.positions.filter(fits({ brand: filter.brand }));
  const inCity = new Map<string, MonthPosition[]>();
  for (const position of forCities) if (position.shelf !== null) push(inCity, `${position.city}|${drink(position)}`, position);
  const cityPrice = new Map<string, number>();
  for (const [key, list] of inCity) cityPrice.set(key, median(list.map(position => position.shelf!))!);
  const national = new Map<string, number[]>();
  for (const [key, price] of cityPrice) push(national, key.slice(key.indexOf('|') + 1), price);
  const cityRatios = new Map<string, number[]>();
  for (const [key, price] of cityPrice) {
    const prices = national.get(key.slice(key.indexOf('|') + 1))!;
    if (prices.length >= options.productCities) push(cityRatios, key.slice(0, key.indexOf('|')), price / median(prices)!);
  }
  const cityVolume = mainVolume(forCities);
  const cities = [...cityRatios].filter(([, ratios]) => ratios.length >= options.cityMin).map(([city, ratios]) => ({
    city, vsAverage: percent(geometric(ratios)), products: ratios.length,
    can: money(median(forCities.filter(position => position.city === city && canVolume(position.volumeMl) === cityVolume).flatMap(position => position.shelf === null ? [] : [position.shelf]))),
  })).sort((a, b) => a.vsAverage - b.vsAverage);

  // Chains: each chain's shelf price against the median of the chains selling the same drink in the same city.
  const chainRatios = new Map<string, number[]>();
  const sameCity = new Map<string, MonthPosition[]>();
  for (const position of positions) if (position.shelf !== null) push(sameCity, `${position.city}|${drink(position)}`, position);
  for (const list of sameCity.values()) {
    if (list.length < 2) continue;
    const middle = median(list.map(position => position.shelf!))!;
    for (const position of list) push(chainRatios, position.retailer, position.shelf! / middle);
  }
  const chains = [...chainRatios].filter(([, ratios]) => ratios.length >= options.chainMin).map(([retailer, ratios]) => {
    const cuts = positions.flatMap(position => position.retailer === retailer && position.discount !== null ? [position.discount] : []);
    return { retailer, vsAverage: percent(geometric(ratios)), products: ratios.length, discount: cuts.length >= 5 ? Math.round(median(cuts)! * 100) : null };
  }).sort((a, b) => a.vsAverage - b.vsAverage);

  // Brands by a litre on the shelf (the brand filter does not narrow them: one brand alone compares with nothing).
  const inTheCity = fits({ city: filter.city });
  const byBrand = new Map<string, MonthPosition[]>();
  for (const position of current.positions) if (position.shelf !== null && inTheCity(position)) push(byBrand, position.brand, position);
  const moves = previous ? monthChanges(current, previous, inTheCity, position => position.brand).groups : null;
  const brands = [...byBrand].filter(([, list]) => list.length >= options.brandMin).map(([brand, list]) => {
    const moved = moves?.get(brand);
    return { brand, perLitre: Math.round(median(list.map(position => position.shelf! / position.volumeMl * 1000))!), positions: list.length,
      change: moved && moved.matched >= options.brandChangeMin ? moved.shelf : null };
  }).sort((a, b) => a.perLitre - b.perLitre);

  return {
    month: current.month, previousMonth: previous?.month ?? null,
    firstDay: current.days[0]!, lastDay: current.days.at(-1)!, days: current.days.length,
    positions: positions.length, cityCount: new Set(positions.map(position => position.city)).size, retailerCount: new Set(positions.map(position => position.retailer)).size,
    volumeMl: volume,
    can: { shelf: money(median(cans.flatMap(position => position.shelf === null ? [] : [position.shelf]))), paid: money(median(cans.map(position => position.paid))) },
    change: change && change.matched >= options.changeMin ? change : null,
    promo: { discount: discounts.length ? Math.round(median(discounts)! * 1000) / 10 : null, deep: discounts.length ? Math.round(discounts.filter(value => value >= 0.3).length / discounts.length * 100) : null },
    cities, chains, brands,
  };
}

/** A 90-day line: the typical can of a selection, on the shelf and paid, day by day. */
export interface IndexSeries { volumeMl: number; points: [day: string, shelf: number | null, paid: number | null][] }
export const seriesKey = (filter: IndexFilter) => [filter.city ? `city:${filter.city}` : '', filter.brand ? `brand:${lower(filter.brand)}` : ''].filter(Boolean).join('|') || 'all';

/**
 * Day-by-day lines for the country, each city, each brand and each city × brand. A selection starts on the first day
 * it has `minRows` positions of its typical can, at their median price; every next day moves it by the geometric mean of
 * the same positions' change since they were last seen (a chain index — new and gone offers do not jump the line).
 * Selections with fewer than `minRows` cans on their last day are left out.
 */
export function buildSeries(days: readonly { day: string; rows: readonly DayRow[] }[], minRows = 5): Record<string, IndexSeries> {
  const ordered = [...days].sort((a, b) => a.day.localeCompare(b.day));
  const selections = (row: DayRow) => { const city = `city:${row.city}`, brand = `brand:${lower(row.brand)}`; return ['all', city, brand, `${city}|${brand}`]; };
  // The typical can of each selection over the whole period.
  const volumes = new Map<string, Map<number, number>>();
  for (const { rows } of ordered) for (const row of rows) for (const key of selections(row)) {
    const counts = volumes.get(key) ?? new Map<number, number>();
    const volume = canVolume(row.volumeMl);
    counts.set(volume, (counts.get(volume) ?? 0) + 1); volumes.set(key, counts);
  }
  const typical = new Map<string, number>();
  for (const [key, counts] of volumes) typical.set(key, [...counts].sort((a, b) => b[1] - a[1] || Number(b[0] === 450) - Number(a[0] === 450))[0]![0]);

  const last = new Map<string, DayRow>();
  const state = new Map<string, { shelf: number | null; paid: number; points: IndexSeries['points']; lastRows: number }>();
  for (const { day, rows } of ordered) {
    const shelfRatios = new Map<string, number[]>(), paidRatios = new Map<string, number[]>(), shelfToday = new Map<string, number[]>(), paidToday = new Map<string, number[]>();
    for (const row of rows) {
      const before = last.get(rowKey(row));
      for (const key of selections(row)) {
        if (canVolume(row.volumeMl) !== typical.get(key)) continue;
        push(paidToday, key, row.paid);
        if (row.shelf !== null) push(shelfToday, key, row.shelf);
        if (!before) continue;
        push(paidRatios, key, row.paid / before.paid);
        if (row.shelf !== null && before.shelf !== null) push(shelfRatios, key, row.shelf / before.shelf);
      }
    }
    for (const row of rows) last.set(rowKey(row), row);
    for (const [key, today] of paidToday) {
      let line = state.get(key);
      if (!line) {
        if (today.length < minRows) continue;
        line = { shelf: median(shelfToday.get(key) ?? []), paid: median(today)!, points: [], lastRows: today.length };
        state.set(key, line);
      } else {
        const paid = paidRatios.get(key) ?? [], shelf = shelfRatios.get(key) ?? [];
        if (paid.length >= 3) line.paid *= geometric(paid);
        if (line.shelf === null) line.shelf = (shelfToday.get(key)?.length ?? 0) >= minRows ? median(shelfToday.get(key)!) : null;
        else if (shelf.length >= 3) line.shelf *= geometric(shelf);
        line.lastRows = today.length;
      }
      line.points.push([day, money(line.shelf), money(line.paid)]);
    }
  }
  return Object.fromEntries([...state].filter(([, line]) => line.lastRows >= minRows && line.points.length > 1)
    .map(([key, line]) => [key, { volumeMl: typical.get(key)!, points: line.points }]));
}

/**
 * The line at the level of the page's numbers: the chain index keeps its shape, and its average over `month` is set to
 * the month's typical can (`IndexView.can`) — so the chart and the card above it never disagree.
 */
export function anchorSeries(series: IndexSeries, month: string, can: { shelf: number | null; paid: number | null }): IndexSeries {
  const inMonth = series.points.filter(([day]) => day.startsWith(month));
  const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  const shelfMean = mean(inMonth.flatMap(([, shelf]) => shelf === null ? [] : [shelf])), paidMean = mean(inMonth.flatMap(([, , paid]) => paid === null ? [] : [paid]));
  const shelfScale = can.shelf !== null && shelfMean ? can.shelf / shelfMean : 1, paidScale = can.paid !== null && paidMean ? can.paid / paidMean : 1;
  return { ...series, points: series.points.map(([day, shelf, paid]) => [day, shelf === null ? null : money(shelf * shelfScale), paid === null ? null : money(paid * paidScale)]) };
}

/** «ноябрь» for `2026-11`; `monthTo` — «к ноябрю». */
const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const MONTHS_TO = ['январю', 'февралю', 'марту', 'апрелю', 'маю', 'июню', 'июлю', 'августу', 'сентябрю', 'октябрю', 'ноябрю', 'декабрю'];
const MONTHS_OF = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const monthName = (month: string) => MONTHS[Number(month.slice(5, 7)) - 1] ?? month;
export const monthTo = (month: string) => MONTHS_TO[Number(month.slice(5, 7)) - 1] ?? month;
export const dayOf = (day: string) => `${Number(day.slice(8, 10))} ${MONTHS_OF[Number(day.slice(5, 7)) - 1] ?? ''}`;
/** The month before `YYYY-MM`. */
export function previousMonthOf(month: string): string {
  const [year, number] = month.split('-').map(Number) as [number, number];
  return number === 1 ? `${year - 1}-12` : `${year}-${String(number - 1).padStart(2, '0')}`;
}
