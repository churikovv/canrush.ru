import { XMLParser } from 'fast-xml-parser';
import { parse as parseCsvSync } from 'csv-parse/sync';
import type { RawProductInput } from '../normalize.js';

export type FeedFormat = 'yml' | 'csv';

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

interface YmlOfferRaw {
  '@_id'?: string;
  url?: string;
  price?: number | string;
  oldprice?: number | string;
  picture?: string | string[];
  name?: string;
  model?: string;
  vendor?: string;
  typePrefix?: string;
  categoryId?: string | number;
}

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

function ymlOfferName(offer: YmlOfferRaw): string {
  if (offer.name) return offer.name;
  return [offer.vendor, offer.typePrefix, offer.model].filter(Boolean).join(' ').trim();
}

/**
 * Разбирает партнёрский товарный фид в формате YML (Yandex Market Language, XML) —
 * стандартный формат для фидов Ozon/WB через партнёрские сети (Admitad и т.п.).
 */
export function parseYmlFeed(xml: string): RawProductInput[] {
  const parsed = xmlParser.parse(xml) as {
    yml_catalog?: { shop?: { offers?: { offer?: YmlOfferRaw | YmlOfferRaw[] } } };
  };
  const rawOffers = parsed.yml_catalog?.shop?.offers?.offer;
  const offers = Array.isArray(rawOffers) ? rawOffers : rawOffers ? [rawOffers] : [];

  const result: RawProductInput[] = [];
  for (const offer of offers) {
    const price = toNumber(offer.price);
    const id = offer['@_id'];
    if (price == null || !id || !offer.url) continue;
    const picture = Array.isArray(offer.picture) ? offer.picture[0] : offer.picture;
    result.push({
      sourceId: String(id),
      name: ymlOfferName(offer),
      price,
      oldPrice: toNumber(offer.oldprice),
      url: offer.url,
      imageUrl: picture,
      category: offer.categoryId != null ? String(offer.categoryId) : undefined,
    });
  }
  return result;
}

const CSV_COLUMN_ALIASES = {
  id: ['id', 'offer_id', 'sku', 'артикул'],
  name: ['name', 'title', 'наименование', 'название'],
  price: ['price', 'цена'],
  oldPrice: ['oldprice', 'old_price', 'цена_до_скидки', 'старая_цена'],
  url: ['url', 'link', 'ссылка'],
  image: ['picture', 'image', 'изображение', 'картинка'],
  category: ['category', 'категория'],
};

function pick(row: Record<string, string>, aliases: string[]): string | undefined {
  const lowerRow: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    lowerRow[key.toLowerCase()] = value;
  }
  for (const alias of aliases) {
    const value = lowerRow[alias];
    if (value) return value;
  }
  return undefined;
}

/**
 * Разбирает партнёрский товарный фид в формате CSV. Названия колонок отличаются
 * у разных фидов, поэтому сопоставляем по нескольким распространённым алиасам.
 */
export function parseCsvFeed(csv: string): RawProductInput[] {
  const records = parseCsvSync(csv, { columns: true, skip_empty_lines: true, trim: true }) as Array<
    Record<string, string>
  >;

  const result: RawProductInput[] = [];
  for (const row of records) {
    const id = pick(row, CSV_COLUMN_ALIASES.id);
    const name = pick(row, CSV_COLUMN_ALIASES.name);
    const price = toNumber(pick(row, CSV_COLUMN_ALIASES.price));
    const url = pick(row, CSV_COLUMN_ALIASES.url);
    if (!id || !name || price == null || !url) continue;
    result.push({
      sourceId: id,
      name,
      price,
      oldPrice: toNumber(pick(row, CSV_COLUMN_ALIASES.oldPrice)),
      url,
      imageUrl: pick(row, CSV_COLUMN_ALIASES.image),
      category: pick(row, CSV_COLUMN_ALIASES.category),
    });
  }
  return result;
}

export function parseFeed(content: string, format: FeedFormat): RawProductInput[] {
  return format === 'csv' ? parseCsvFeed(content) : parseYmlFeed(content);
}

/** Определяет формат фида по URL/Content-Type (по умолчанию YML — самый частый случай). */
export function detectFeedFormat(url: string, contentType?: string): FeedFormat {
  if (contentType?.toLowerCase().includes('csv')) return 'csv';
  if (url.toLowerCase().endsWith('.csv')) return 'csv';
  return 'yml';
}
