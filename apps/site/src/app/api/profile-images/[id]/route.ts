import { getPool } from '@/db/pool';
import { IMMUTABLE_MEDIA } from '@/lib/media-cache';
import { PHOTO_ID_PATTERN } from '@/lib/review-photo-limits';

export const runtime = 'nodejs';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (!PHOTO_ID_PATTERN.test(id)) return new Response(null, { status: 404, headers });
  const result = await getPool().query<{ data: Buffer }>('select data from "profileImage" where id = $1', [id]);
  const image = result.rows[0];
  if (!image) return new Response(null, { status: 404, headers });
  // A replaced avatar or banner gets a new id, so this one never changes: the device keeps it.
  return new Response(new Uint8Array(image.data), { headers: { ...headers, 'Cache-Control': IMMUTABLE_MEDIA, 'Content-Type': 'image/webp', 'Content-Disposition': 'inline' } });
}
