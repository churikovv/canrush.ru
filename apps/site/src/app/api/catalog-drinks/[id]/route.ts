import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getCatalogDrinkPhoto } from '@/lib/catalog-drinks';
import { PHOTO_ID_PATTERN } from '@/lib/review-photo-limits';

export const runtime = 'nodejs';
/** A member-added drink's can photo (`?size=thumbnail` for the small one): public once published, else author and admins. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!PHOTO_ID_PATTERN.test(id)) return new Response(null, { status: 404 });
  const session = await auth.api.getSession({ headers: await headers() });
  const photo = await getCatalogDrinkPhoto(id, session?.user.id ?? null, new URL(request.url).searchParams.get('size') === 'thumbnail');
  return new Response(photo ? new Uint8Array(photo.data) : null, {
    status: photo ? 200 : 404,
    headers: {
      'Content-Type': 'image/webp', 'X-Content-Type-Options': 'nosniff',
      'Cache-Control': photo?.published ? 'public, max-age=3600, stale-while-revalidate=86400' : 'private, no-store',
    },
  });
}
