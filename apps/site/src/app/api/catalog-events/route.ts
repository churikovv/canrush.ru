import { createHash } from 'node:crypto';
import { NextRequest } from 'next/server';
import { getAuthEnv } from '@/lib/env';
import { getCatalogGroup } from '@/lib/catalog';
import { catalogRetailerName } from '@/lib/catalog-query';
import { recordStoreClick } from '@/lib/catalog-events';
import { isPrefetchOrBot } from '@/lib/search-log';

// Bounded per-process burst protection; keys are ephemeral hashes, never persisted.
const state = globalThis as typeof globalThis & { catalogEventBursts?: Map<string, { count: number; until: number }> };
function allowRequest(request: NextRequest) {
  const now = Date.now(); const buckets = state.catalogEventBursts ??= new Map();
  const key = createHash('sha256').update(request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown').digest('hex');
  for (const [id, bucket] of buckets) if (bucket.until <= now) buckets.delete(id);
  const bucket = buckets.get(key);
  if (bucket) { if (bucket.count >= 30) return false; bucket.count++; return true; }
  if (buckets.size >= 10000) return false;
  buckets.set(key, { count: 1, until: now + 60000 }); return true;
}

/**
 * A tap on a store offer of a drink card (`sendBeacon` from `CatalogOfferClicks`). Only from the site itself, not from
 * bots; the drink must be in the catalog and the retailer among its offers, so nothing else gets written.
 */
export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== new URL(getAuthEnv().authUrl).origin || request.headers.get('sec-fetch-site') === 'cross-site') return new Response(null, { status: 403 });
  if (isPrefetchOrBot(request.headers)) return new Response(null, { status: 204 });
  if (!allowRequest(request)) return new Response(null, { status: 429, headers: { 'Retry-After': '60' } });
  const body = await request.json().catch(() => null) as { brand?: unknown; flavor?: unknown; retailer?: unknown } | null;
  const { brand, flavor, retailer } = body ?? {};
  if (typeof brand !== 'string' || typeof flavor !== 'string' || typeof retailer !== 'string' || brand.length > 120 || flavor.length > 160 || retailer.length > 80) return new Response(null, { status: 400 });
  const group = await getCatalogGroup(brand, flavor);
  if (!group || !group.variants.some(variant => catalogRetailerName(variant) === retailer)) return new Response(null, { status: 404 });
  try { await recordStoreClick(group.brand, group.flavor, retailer); return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } }); }
  catch { return new Response(null, { status: 503 }); }
}
