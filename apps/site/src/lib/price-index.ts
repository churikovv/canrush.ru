import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CITIES } from '@canrush/shared';
import {
  anchorSeries, buildSeries, dayRows, indexView, monthSlice, packSlice, previousMonthOf, seriesKey, unpackSlice,
  type DayRow, type IndexFilter, type IndexOffer, type IndexSeries, type MonthSlice, type PackedSlice, type PriceIndexView,
} from '@/lib/price-index-fields';
import { brandSearchTerms } from '@/lib/search-aliases';

/**
 * «Индекс цен на энергетики» (страница /prices). Источник — ежедневные срезы парсера по городам
 * (`PRICE_HISTORY_DIR/<город>/history/<день>.json`, около мегабайта каждый). День всех городов один раз сводится в
 * компактную копию (`data/price-index-days/<день>.json`: только позиции и цены) и потом читается из неё; копия
 * пересобирается, если у парсера поменялся файл этого дня. Из копий считаются два месяца (`data/price-index.json`) и
 * ряды за 90 дней (`data/price-index-series.json`). Считает фоновая задача (`price-index-worker.ts`); страница читает.
 */
const HISTORY_ROOT = () => process.env.PRICE_HISTORY_DIR ?? path.resolve(process.cwd(), '../../data/regions');
const DATA_DIR = () => path.join(process.cwd(), 'data');
const DAY_FILE = /^(\d{4}-\d{2}-\d{2})\.json$/u;
/** Compact days kept: the series' 90 and the month before them. */
const KEEP_DAYS = 100;
const SERIES_DAYS = 90;
const DAY_MS = 86_400_000;

export interface PriceIndexData {
  generatedAt: string; lastDay: string;
  current: MonthSlice; previous: MonthSlice | null;
  /** For the filter: cities and brands with positions this month, by name. */
  cities: string[]; brands: string[];
}
interface IndexFile { generatedAt: string; lastDay: string; current: PackedSlice; previous: PackedSlice | null; cities: string[]; brands: string[] }
interface SeriesFile { generatedAt: string; series: Record<string, IndexSeries> }

/** Every city's day files, by day. */
async function historyFiles(root: string): Promise<Map<string, { city: string; file: string }[]>> {
  const byDay = new Map<string, { city: string; file: string }[]>();
  let cities: string[];
  try { cities = (await readdir(root, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort(); } catch { return byDay; }
  for (const city of cities) {
    let names: string[] = [];
    try { names = await readdir(path.join(root, city, 'history')); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    for (const name of names) {
      const day = DAY_FILE.exec(name)?.[1];
      if (day) byDay.set(day, [...byDay.get(day) ?? [], { city, file: path.join(root, city, 'history', name) }]);
    }
  }
  return byDay;
}

/** The newest day any city has, `YYYY-MM-DD`, or null without history. */
export async function latestHistoryDay(root = HISTORY_ROOT()): Promise<string | null> {
  return [...(await historyFiles(root)).keys()].sort().at(-1) ?? null;
}

type CompactRow = [city: string, retailer: string, brand: string, flavor: string, volumeMl: number, paid: number, shelf: number, promo: number];
const toCompact = (row: DayRow): CompactRow => [row.city, row.retailer, row.brand, row.flavor, row.volumeMl, Math.round(row.paid * 100) / 100, row.shelf === null ? -1 : Math.round(row.shelf * 100) / 100, row.promo ? 1 : 0];
const fromCompact = ([city, retailer, brand, flavor, volumeMl, paid, shelf, promo]: CompactRow): DayRow => ({ city, retailer, brand, flavor, volumeMl, paid, shelf: shelf < 0 ? null : shelf, promo: promo === 1 });

/** A day of every city: from its compact copy while the parser's files stay the same, else read again and copied. */
async function dayOf(day: string, files: { city: string; file: string }[], dir: string): Promise<DayRow[]> {
  const signature = (await Promise.all(files.map(async item => `${item.city}:${(await stat(item.file)).mtimeMs}`))).sort().join(',');
  const copy = path.join(dir, `${day}.json`);
  try {
    const saved = JSON.parse(await readFile(copy, 'utf8')) as { signature: string; rows: CompactRow[] };
    if (saved.signature === signature) return saved.rows.map(fromCompact);
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error; }
  const rows: DayRow[] = [];
  for (const item of files) {
    try {
      const data = JSON.parse(await readFile(item.file, 'utf8')) as { cityId?: string; products?: IndexOffer[] };
      if (data.cityId === item.city && Array.isArray(data.products)) rows.push(...dayRows(item.city, data.products));
    } catch (error) { if (!(error instanceof SyntaxError) && (error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    // A city's day is about a megabyte of JSON: let requests through between files.
    await new Promise(resolve => setImmediate(resolve));
  }
  await writeFile(`${copy}.tmp`, JSON.stringify({ signature, rows: rows.map(toCompact) }));
  await rename(`${copy}.tmp`, copy);
  return rows;
}

/** The index of the newest month with data against the month before it, and the 90-day lines. */
export async function computePriceIndex(root = HISTORY_ROOT(), dataDir = DATA_DIR(), now = new Date()): Promise<{ data: IndexFile; series: SeriesFile } | null> {
  const files = await historyFiles(root);
  const latest = [...files.keys()].sort().at(-1);
  if (!latest) return null;
  const dir = path.join(dataDir, 'price-index-days');
  await mkdir(dir, { recursive: true });
  const from = new Date(Date.parse(`${latest}T00:00:00Z`) - (KEEP_DAYS - 1) * DAY_MS).toISOString().slice(0, 10);
  const days: { day: string; rows: DayRow[] }[] = [];
  for (const day of [...files.keys()].filter(day => day >= from).sort()) days.push({ day, rows: await dayOf(day, files.get(day)!, dir) });
  // Copies of days that fell out of the window go.
  for (const name of await readdir(dir)) { const day = DAY_FILE.exec(name)?.[1]; if (day && day < from) await rm(path.join(dir, name), { force: true }); }
  const month = latest.slice(0, 7);
  const current = monthSlice(month, days), previous = monthSlice(previousMonthOf(month), days);
  const seriesFrom = new Date(Date.parse(`${latest}T00:00:00Z`) - (SERIES_DAYS - 1) * DAY_MS).toISOString().slice(0, 10);
  const counts = new Map<string, number>();
  for (const position of current.positions) counts.set(position.brand, (counts.get(position.brand) ?? 0) + 1);
  return {
    data: {
      generatedAt: now.toISOString(), lastDay: latest, current: packSlice(current), previous: previous.positions.length ? packSlice(previous) : null,
      cities: Object.keys(current.cityDays).sort(), brands: [...counts].filter(([, count]) => count >= 5).map(([brand]) => brand).sort((a, b) => a.localeCompare(b, 'ru')),
    },
    series: { generatedAt: now.toISOString(), series: buildSeries(days.filter(day => day.day >= seriesFrom)) },
  };
}

async function writeAtomically(file: string, value: unknown) {
  await writeFile(`${file}.tmp`, JSON.stringify(value));
  await rename(`${file}.tmp`, file);
}

let held: { at: number; data: PriceIndexData | null } | null = null;
let heldSeries: { at: number; series: Record<string, IndexSeries> } | null = null;
const HOLD_MS = 5 * 60_000;
const unpack = (file: IndexFile): PriceIndexData => ({ ...file, current: unpackSlice(file.current), previous: file.previous ? unpackSlice(file.previous) : null });

/** Computes the index and replaces its files (written aside, then renamed: a reader never sees half). */
export async function refreshPriceIndex(): Promise<PriceIndexData | null> {
  const result = await computePriceIndex();
  if (!result) return null;
  await writeAtomically(path.join(DATA_DIR(), 'price-index-series.json'), result.series);
  await writeAtomically(path.join(DATA_DIR(), 'price-index.json'), result.data);
  held = { at: Date.now(), data: unpack(result.data) };
  heldSeries = { at: Date.now(), series: result.series.series };
  return held.data;
}

/**
 * The months for the page: from memory, else from the file. In development, with no file yet, they are computed right
 * here — the local history is small; in production the worker writes them.
 */
export async function getPriceIndexData(): Promise<PriceIndexData | null> {
  if (held && Date.now() - held.at < HOLD_MS) return held.data;
  try {
    held = { at: Date.now(), data: unpack(JSON.parse(await readFile(path.join(DATA_DIR(), 'price-index.json'), 'utf8')) as IndexFile) };
    return held.data;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
  }
  if (process.env.NODE_ENV !== 'production') return refreshPriceIndex();
  held = { at: Date.now(), data: null };
  return null;
}

/** One 90-day line (`seriesKey`), or null when the selection has too few cans for one. */
export async function getIndexSeries(key: string): Promise<IndexSeries | null> {
  if (!heldSeries || Date.now() - heldSeries.at >= HOLD_MS) {
    try {
      heldSeries = { at: Date.now(), series: (JSON.parse(await readFile(path.join(DATA_DIR(), 'price-index-series.json'), 'utf8')) as SeriesFile).series };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
      return null;
    }
  }
  return heldSeries.series[key] ?? null;
}

const views = new Map<string, PriceIndexView | null>();
/** The page for a filter, kept per computed index: the same selections are asked again and again. */
export function viewFor(data: PriceIndexData, filter: IndexFilter): PriceIndexView | null {
  const key = `${data.generatedAt}|${seriesKey(filter)}`;
  if (!views.has(key)) {
    if (views.size >= 300) views.delete(views.keys().next().value!);
    views.set(key, indexView(data.current, data.previous, filter));
  }
  return views.get(key)!;
}

/** The 90-day line of a filter at the level of its typical can this month, or null without one. */
export async function seriesFor(data: PriceIndexData, filter: IndexFilter): Promise<(IndexSeries & { month: string }) | null> {
  const [series, view] = [await getIndexSeries(seriesKey(filter)), viewFor(data, filter)];
  if (!series) return null;
  return { ...(view && view.volumeMl === series.volumeMl ? anchorSeries(series, data.current.month, view.can) : series), month: data.current.month };
}

const normalized = (value: string) => value.toLocaleLowerCase('ru-RU').replaceAll('ё', 'е').replace(/\s+/gu, ' ').trim();
/**
 * The page's filter from its address: a city and a brand the index has. The search text, when it names a city or a
 * brand (any spelling: «берн» is Burn), becomes that filter; otherwise it narrows the lists by name.
 */
export function resolveIndexFilter(params: { city?: string; brand?: string; q?: string }, data: PriceIndexData): { filter: IndexFilter; query: string } {
  let city = params.city && data.cities.includes(params.city) ? params.city : undefined;
  let brand = params.brand ? data.brands.find(name => normalized(name) === normalized(params.brand!)) : undefined;
  let query = (params.q ?? '').replace(/\s+/gu, ' ').trim().slice(0, 60);
  const typed = normalized(query);
  if (typed) {
    const named = CITIES.find(item => normalized(item.name) === typed && data.cities.includes(item.id));
    const own = data.brands.find(name => brandSearchTerms(name).some(term => normalized(term) === typed));
    if (named && !city) { city = named.id; query = ''; }
    else if (own && !brand) { brand = own; query = ''; }
  }
  return { filter: { ...(city ? { city } : {}), ...(brand ? { brand } : {}) }, query };
}
