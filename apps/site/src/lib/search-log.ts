import { headers } from 'next/headers';
import { after } from 'next/server';
import { getPool } from '@/db/pool';
import { normalizeSearchQuery, type SearchScope } from '@/lib/search-log-fields';

const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|monitor/i;

/**
 * Records one search (`searchQuery`, migration 0123) after the response, anonymously: the normalised text, where it
 * was searched, how many results and which brands were in them — no member, session or address. Called by the
 * catalog, store and market browsers for the first page of results only. Router prefetches and bots are skipped, so
 * a link to a search page does not count as a search.
 */
export async function logSearch(query: string, scope: SearchScope, results: number, brands: string[] = []) {
  const text = normalizeSearchQuery(query);
  if (text.length < 2) return;
  const request = await headers();
  if (request.get('next-router-prefetch') || request.get('purpose') === 'prefetch' || BOT.test(request.get('user-agent') ?? '')) return;
  const shown = [...new Set(brands)].slice(0, 50);
  after(() => getPool().query(`insert into "searchQuery"(query, scope, results, brands) values ($1, $2, $3, $4)`, [text, scope, results, shown]).catch(() => undefined));
}
