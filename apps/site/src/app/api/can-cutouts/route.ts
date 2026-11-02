import { cutOutCan } from '@/lib/can-cutout';
import { coverBytes } from '@/lib/cover-hash';

export const runtime = 'nodejs';

/** Cut covers by address, newest last; the oldest go when the list is full. A cut takes tens of milliseconds, so a restart costs little. */
const cache = new Map<string, { image: Buffer; cut: boolean }>();
const CACHE_SIZE = 600;

/**
 * A catalog cover without its shop background (`cutOutCan`), for the big Bankomat cards: `?src=` is the cover's own
 * address. Only our covers are read — files under public/ and photos kept in the database (`coverBytes`); any other
 * address is a 404, so this never fetches someone else's site. A cover's address changes with its file, so a day's cache.
 * `X-Can-Cut: 1` — the background was cut away, and the big view may draw the can round (`CanVolume`).
 */
export async function GET(request: Request) {
  const src = new URL(request.url).searchParams.get('src') ?? '';
  let made = cache.get(src);
  if (!made) {
    // A member's drink, a brand's photo or a moderator's cover: the full photo, not the thumbnail, so the can stays sharp.
    const bytes = await coverBytes(src, true).catch(() => null);
    if (!bytes) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    made = await cutOutCan(bytes).catch(() => undefined);
    if (!made) return new Response(null, { status: 422, headers: { 'Cache-Control': 'no-store' } });
    cache.set(src, made);
    if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!);
  }
  return new Response(new Uint8Array(made.image), { headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff', 'X-Can-Cut': made.cut ? '1' : '0' } });
}
