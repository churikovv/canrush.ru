import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getStorePhoto } from '@/lib/stores';
import { NO_STORE_MEDIA, STORE_MEDIA } from '@/lib/media-cache';
import { PHOTO_ID_PATTERN } from '@/lib/review-photo-limits';

export const runtime = 'nodejs';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!PHOTO_ID_PATTERN.test(id)) return new Response(null, { status: 404 });
  const session = await auth.api.getSession({ headers: await headers() });
  const requested = new URL(request.url).searchParams.get('size');
  const photo = await getStorePhoto(id, session?.user.id ?? null, requested === 'thumbnail' || requested === 'card' ? requested : 'full');
  // A published store's photos may stay on the device for a day; a request's only its author and admins see, never stored.
  return new Response(photo ? new Uint8Array(photo.data) : null, {
    status: photo ? 200 : 404,
    headers: { 'Content-Type': 'image/webp', 'Cache-Control': photo?.published ? STORE_MEDIA : NO_STORE_MEDIA, 'X-Content-Type-Options': 'nosniff' },
  });
}
