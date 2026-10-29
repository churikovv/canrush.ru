import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getCatalogDrinkExtraPhoto } from '@/lib/catalog-drinks';
import { IMMUTABLE_MEDIA, NO_STORE_MEDIA } from '@/lib/media-cache';
import { PHOTO_ID_PATTERN } from '@/lib/review-photo-limits';

export const runtime = 'nodejs';
/**
 * An extra photo of a member-added drink (`?size=thumbnail` — the small one). The bytes under one id never change, so
 * a published one is kept on the device; one still under review is not stored at all.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!PHOTO_ID_PATTERN.test(id)) return new Response(null, { status: 404 });
  const session = await auth.api.getSession({ headers: await headers() });
  const photo = await getCatalogDrinkExtraPhoto(id, session?.user.id ?? null, new URL(request.url).searchParams.get('size') === 'thumbnail');
  if (!photo) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return new Response(new Uint8Array(photo.data), { headers: { 'Content-Type': 'image/webp', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline', 'Cache-Control': photo.published ? IMMUTABLE_MEDIA : NO_STORE_MEDIA } });
}
