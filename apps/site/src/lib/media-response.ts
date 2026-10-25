import { getPool } from '@/db/pool';
import { parseRange } from '@/lib/byte-range';
import { IMMUTABLE_MEDIA, STORY_MEDIA } from '@/lib/media-cache';
import { PHOTO_ID_PATTERN } from '@/lib/review-photo-limits';

const NO_STORE = { 'Cache-Control': 'no-store' };
const missing = () => new Response(null, { status: 404, headers: NO_STORE });

/**
 * Serves a stored wall or comment attachment or a story: `?size=thumbnail` for the preview, the full file otherwise,
 * and byte ranges for videos (Safari does not play them without).
 */
export async function serveStoredMedia(request: Request, table: 'wallPhoto' | 'commentMedia' | 'story', id: string): Promise<Response> {
  if (!PHOTO_ID_PATTERN.test(id)) return missing();
  const db = getPool();
  // Attachments never change under their id; stories expire, so they are kept for an hour only.
  const common = { 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline', 'Cache-Control': table === 'story' ? STORY_MEDIA : IMMUTABLE_MEDIA };
  if (new URL(request.url).searchParams.get('size') === 'thumbnail') {
    const result = await db.query<{ data: Buffer }>(`select thumbnail as data from "${table}" where id = $1`, [id]);
    const photo = result.rows[0];
    return photo ? new Response(new Uint8Array(photo.data), { headers: { 'Content-Type': 'image/webp', ...common } }) : missing();
  }
  const meta = (await db.query<{ mime: string; size: number }>(`select mime, octet_length(data) as size from "${table}" where id = $1`, [id])).rows[0];
  if (!meta) return missing();
  const range = meta.mime.startsWith('video/') ? parseRange(request.headers.get('range'), meta.size) : null;
  if (range === 'invalid') return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${meta.size}`, ...NO_STORE } });
  const headers = { 'Content-Type': meta.mime, 'Accept-Ranges': meta.mime.startsWith('video/') ? 'bytes' : 'none', ...common };
  if (!range) {
    const photo = (await db.query<{ data: Buffer }>(`select data from "${table}" where id = $1`, [id])).rows[0];
    return photo ? new Response(new Uint8Array(photo.data), { headers }) : missing();
  }
  // substring() is 1-based; with external storage Postgres reads only the requested TOAST chunks.
  const slice = (await db.query<{ data: Buffer }>(`select substring(data from $2 for $3) as data from "${table}" where id = $1`, [id, range.start + 1, range.end - range.start + 1])).rows[0];
  if (!slice) return missing();
  return new Response(new Uint8Array(slice.data), { status: 206, headers: { ...headers, 'Content-Range': `bytes ${range.start}-${range.end}/${meta.size}`, 'Content-Length': String(slice.data.length) } });
}
