import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { WHOLESALE_SOURCES, type WholesaleFile, type WholesaleOffer, type WholesaleSource } from '@canrush/shared';
import { writeAtomic } from '../atomic-file.js';
import { loadProductsConfig } from '../config.js';
import { normalizeIdentity } from '../normalize.js';
import { fetchNapolke } from './napolke.js';
import { fetchOtlichnye } from './otlichnye.js';
import { fetchEsweets } from './esweets.js';

/** Read by the site's business cabinet only — never by the retail catalog. */
export const WHOLESALE_PATH = path.resolve(import.meta.dirname, '../../../site/data/wholesale.json');

/** Wholesale titles name the country of origin («Red Bull Австрия 250 мл»), which retail titles do not; it hides a plain
 * original from the catalog's rules, so it is cut before the identity is read (the stored title keeps it). */
const COUNTRY = /(?:^|\s)(?:Россия|Австрия|Ирландия|Англия|Великобритания|Польша|Германия|Нидерланды|Голландия|Бельгия|Венгрия|Чехия|Сербия|Казахстан|Беларусь|Белоруссия|Узбекистан|Армения|Грузия|Турция|ОАЭ|Таиланд|Вьетнам|Китай|Корея|Япония|США|Швейцария|Испания|Италия|Франция|Латвия|Литва|Эстония|Финляндия)(?=\s|,|$)/giu;
export const identityTitle = (name: string) => name.replace(COUNTRY, ' ').replace(/\s+/g, ' ').trim();

type Fetched = Array<Omit<WholesaleOffer, 'brand' | 'flavor' | 'volumeMl'> & { siteBrand?: string }>;
const FETCHERS: Record<WholesaleSource, (log: (message: string) => void) => Promise<Fetched>> = { napolke: fetchNapolke, otlichnye: fetchOtlichnye, esweets: fetchEsweets };

async function previous(): Promise<WholesaleFile | null> {
  try { return JSON.parse(await readFile(WHOLESALE_PATH, 'utf8')) as WholesaleFile; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}

/**
 * One wholesale pass: each source in turn, products mapped to catalog identities by the retail normalization. A source
 * that fails keeps its last offers as `stale`, like the retail stale fallback, so one bad night does not empty the
 * cabinet. The file is replaced atomically.
 */
export async function runWholesale(options: { sources?: WholesaleSource[]; log?: (message: string) => void } = {}): Promise<WholesaleFile> {
  const log = options.log ?? (message => console.log(`[wholesale] ${message}`));
  const config = loadProductsConfig();
  const known = { brands: config.brands, brandAliases: config.brandAliases ?? {}, flavors: config.flavors ?? [], flavorAliases: config.flavorAliases ?? {} };
  const before = await previous();
  const file: WholesaleFile = { generatedAt: new Date().toISOString(), sources: { ...before?.sources }, offers: [] };
  for (const source of WHOLESALE_SOURCES) {
    const old = (before?.offers ?? []).filter(offer => offer.source === source);
    if (options.sources && !options.sources.includes(source)) { file.offers.push(...old); continue; }
    try {
      const fetched = await FETCHERS[source](log);
      if (!fetched.length) throw new Error('пустой ответ');
      // Pages shift while the site re-sorts, so a product can come twice: keep its first sighting.
      const unique = [...new Map(fetched.map(offer => [offer.sourceId, offer])).values()];
      const offers = unique.map(({ siteBrand, ...offer }) => ({
        ...offer,
        ...normalizeIdentity(identityTitle(offer.name), siteBrand, known.brands, known.brandAliases, known.flavors, known.flavorAliases),
      }));
      file.offers.push(...offers);
      file.sources[source] = { status: 'ok', fetchedAt: file.generatedAt, count: offers.length };
      log(`${source}: ${offers.length} товаров, с карточкой каталога — ${offers.filter(offer => offer.brand && offer.flavor).length}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      file.offers.push(...old);
      file.sources[source] = { status: old.length ? 'stale' : 'unavailable', fetchedAt: before?.sources[source]?.fetchedAt ?? null, count: old.length, error: message };
      log(`${source}: ошибка — ${message}${old.length ? `, оставлены прошлые ${old.length}` : ''}`);
    }
  }
  await writeAtomic(WHOLESALE_PATH, `${JSON.stringify(file)}\n`);
  return file;
}
