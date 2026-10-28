import { getBrandDrinkPhoto } from '@/lib/brand-drink-edits';
import { PHOTO_ID_PATTERN } from '@/lib/review-photo-limits';

export const runtime = 'nodejs';
/**
 * A brand's photo of its drink (an approved edit, `brandDrinkProfile`), `?size=thumbnail` for the small one. The address
 * carries the profile's version, and a new photo gets a new one, so it is kept for a year.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string; version: string }> }) {
  const { id } = await params;
  if (!PHOTO_ID_PATTERN.test(id)) return new Response(null, { status: 404 });
  const photo = await getBrandDrinkPhoto(id, new URL(request.url).searchParams.get('size') === 'thumbnail' ? 'thumbnail' : 'full');
  return new Response(photo ? new Uint8Array(photo) : null, {
    status: photo ? 200 : 404,
    headers: { 'Content-Type': 'image/webp', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': photo ? 'public, max-age=31536000, immutable' : 'no-store' },
  });
}
