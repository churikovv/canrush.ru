/**
 * Wholesale prices for the business cabinet: suppliers that sell energy drinks by the case. A separate stream from the
 * retail catalog (`latest.json`, `catalog.json`) — the parser writes `apps/site/data/wholesale.json` and only the
 * cabinet reads it, so wholesale offers never mix into shop prices.
 */
export const WHOLESALE_SOURCES = ['napolke', 'otlichnye', 'esweets'] as const;
export type WholesaleSource = typeof WHOLESALE_SOURCES[number];

export const WHOLESALE_SOURCE_NAMES: Record<WholesaleSource, { name: string; site: string; region: string }> = {
  napolke: { name: 'НаПолке', site: 'https://napolke.ru', region: 'Москва и область' },
  otlichnye: { name: 'Отличные цены', site: 'https://otlichnye-tseny.ru', region: 'Москва и Санкт-Петербург' },
  esweets: { name: 'E-sweets', site: 'https://msk.e-sweets.ru', region: 'Москва' },
};

/** One product of a wholesale marketplace with its lowest offer. */
export interface WholesaleOffer {
  source: WholesaleSource;
  sourceId: string;
  /** The supplier's own title, as on the site. */
  name: string;
  /** The catalog identity, by the same normalization as retail offers; missing when the product is not recognized. */
  brand?: string;
  flavor?: string;
  volumeMl?: number;
  /** Price per can, roubles, of the cheapest supplier. */
  price: number;
  /** Cans per order step (a case of 12 or 24). */
  packSize: number;
  /** The supplier with that price, how many suppliers sell the product, and the supplier's minimal order, roubles. */
  supplier: string;
  suppliers: number;
  minOrder?: number;
  /** Whether the supplier works with VAT (OSN) — the price then includes it. */
  vat?: boolean;
  /** False when the source shows the product but has none to sell now; missing means in stock. */
  inStock?: boolean;
  /** When the supplier last updated the price list. */
  priceDate?: string;
  url: string;
}

export interface WholesaleSourceState {
  status: 'ok' | 'stale' | 'unavailable';
  fetchedAt: string | null;
  count: number;
  error?: string;
}

export interface WholesaleFile {
  generatedAt: string;
  sources: Partial<Record<WholesaleSource, WholesaleSourceState>>;
  offers: WholesaleOffer[];
}
