import { getCardPhoto } from '@/lib/catalog-card-edits';
import { PHOTO_ID_PATTERN } from '@/lib/review-photo-limits';

export const runtime = 'nodejs';
/**
 * The team's own cover of a parser card (`catalogCardEdit`), `?size=thumbnail` for the small one. The address carries
 * the edit's version and a new photo gets a new one, so it is kept for a year; the cover is public like the card.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string; version: string }> }) {
  const { id } = await params;
  if (!PHOTO_ID_PATTERN.test(id)) return new Response(null, { status: 404 });
  const photo = await getCardPhoto(id, new URL(request.url).searchParams.get('size') === 'thumbnail' ? 'thumbnail' : 'full');
  return new Response(photo ? new Uint8Array(photo) : null, {
    status: photo ? 200 : 404,
    headers: { 'Content-Type': 'image/webp', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': photo ? 'public, max-age=31536000, immutable' : 'no-store' },
  });
}
