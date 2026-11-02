import { getCollectionPhotoFile } from '@/lib/collection-photos';
import { IMMUTABLE_MEDIA } from '@/lib/media-cache';

export const runtime = 'nodejs';
/** A photo of a member's can collection: public as the profile; `?thumb` for the grid, `?size=thumbnail` for the viewer's strip. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const search = new URL(request.url).searchParams;
  const data = await getCollectionPhotoFile(id, search.has('thumb') || search.get('size') === 'thumbnail');
  if (!data) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return new Response(new Uint8Array(data), {
    headers: { 'Content-Type': 'image/webp', 'Cache-Control': IMMUTABLE_MEDIA, 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline' },
  });
}
