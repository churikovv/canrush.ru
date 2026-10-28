import { headers } from 'next/headers';
import { after } from 'next/server';
import { getPool } from '@/db/pool';
import { isPrefetchOrBot } from '@/lib/search-log';

/**
 * Drink card analytics (`catalogEvent`, migration 0125), anonymous like the search log: a view of the drink's page
 * and a tap on a store offer, no member, session or address. Views are written after the response; router prefetches
 * and bots are skipped. The business cabinet reads them in «Карточки» (`getBusinessCards`).
 */
export async function logCatalogView(brand: string, flavor: string) {
  if (isPrefetchOrBot(await headers())) return;
  after(() => getPool().query(`insert into "catalogEvent"(brand, flavor, kind) values ($1, $2, 'view')`, [brand, flavor]).catch(() => undefined));
}

/** A tap on a store offer of the drink, from `/api/catalog-events` once the drink and retailer are checked. */
export async function recordStoreClick(brand: string, flavor: string, retailer: string) {
  await getPool().query(`insert into "catalogEvent"(brand, flavor, kind, retailer) values ($1, $2, 'store', $3)`, [brand, flavor, retailer.slice(0, 80)]);
}
