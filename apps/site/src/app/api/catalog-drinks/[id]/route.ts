import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getCatalogDrinkPhoto } from '@/lib/catalog-drinks';
import { PHOTO_ID_PATTERN } from '@/lib/review-photo-limits';

export const runtime = 'nodejs';
/** A member-added drink's can photo (`?size=thumbnail` for the small one): public once published, else author and admins. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string; version?: string }> }) {
  const { id, version } = await params;
  if (!PHOTO_ID_PATTERN.test(id)) return new Response(null, { status: 404 });
  const session = await auth.api.getSession({ headers: await headers() });
  const photo = await getCatalogDrinkPhoto(id, session?.user.id ?? null, new URL(request.url).searchParams.get('size') === 'thumbnail');
  return new Response(photo ? new Uint8Array(photo.data) : null, {
    status: photo ? 200 : 404,
    headers: {
      'Content-Type': 'image/webp', 'X-Content-Type-Options': 'nosniff',
      // Under a versioned address (/api/catalog-drinks/<id>/<updatedAt>) a published photo never changes: a new one gets a
      // new address, so it may be kept for a year (the image optimizer caches it as long). The bare address keeps an hour.
      'Cache-Control': !photo?.published ? 'private, no-store' : version ? 'public, max-age=31536000, immutable' : 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
