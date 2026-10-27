import { getBusinessLogo } from '@/lib/business';
import { IMMUTABLE_MEDIA } from '@/lib/media-cache';
import { PHOTO_ID_PATTERN } from '@/lib/review-photo-limits';

export const runtime = 'nodejs';
/** A company logo. A new upload gets a new id, so the bytes under one id never change and can be cached for good. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = PHOTO_ID_PATTERN.test(id) ? await getBusinessLogo(id) : null;
  if (!data) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return new Response(new Uint8Array(data), { headers: { 'Cache-Control': IMMUTABLE_MEDIA, 'Content-Type': 'image/webp', 'Content-Disposition': 'inline', 'X-Content-Type-Options': 'nosniff' } });
}
