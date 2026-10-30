import { createHash } from 'node:crypto';
import { NextRequest } from 'next/server';
import { getAuthEnv } from '@/lib/env';
import { recordError } from '@/lib/error-log';
import { CLIENT_REPORT_LIMIT, parseClientErrorReport } from '@/lib/error-log-fields';
import { isPrefetchOrBot } from '@/lib/search-log';

// Bounded per-process burst protection; keys are ephemeral hashes, never persisted.
const state = globalThis as typeof globalThis & { clientErrorBursts?: Map<string, { count: number; until: number }> };
function allowRequest(request: NextRequest) {
  const now = Date.now(); const buckets = state.clientErrorBursts ??= new Map();
  const key = createHash('sha256').update(request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown').digest('hex');
  for (const [id, bucket] of buckets) if (bucket.until <= now) buckets.delete(id);
  const bucket = buckets.get(key);
  if (bucket) { if (bucket.count >= 10) return false; bucket.count++; return true; }
  if (buckets.size >= 10000) return false;
  buckets.set(key, { count: 1, until: now + 60000 }); return true;
}

/**
 * An error caught by an error page in the browser (`useErrorReport`). Only from the site itself, not from bots. The
 * report is anyone's text: it is read field by field, cleaned and stored without the sender's address.
 */
export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== new URL(getAuthEnv().authUrl).origin || request.headers.get('sec-fetch-site') === 'cross-site') return new Response(null, { status: 403 });
  if (isPrefetchOrBot(request.headers)) return new Response(null, { status: 204 });
  if (!allowRequest(request)) return new Response(null, { status: 429, headers: { 'Retry-After': '60' } });
  if (Number(request.headers.get('content-length') ?? 0) > CLIENT_REPORT_LIMIT) return new Response(null, { status: 413 });
  const text = await request.text().catch(() => '');
  if (text.length > CLIENT_REPORT_LIMIT) return new Response(null, { status: 413 });
  let body: unknown = null;
  try { body = JSON.parse(text); } catch { /* answered below */ }
  const report = parseClientErrorReport(body);
  if (!report) return new Response(null, { status: 400 });
  try { await recordError(report); return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } }); }
  catch { return new Response(null, { status: 503 }); }
}
