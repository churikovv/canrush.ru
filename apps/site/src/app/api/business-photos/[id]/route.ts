import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getCompanyPostPhoto } from '@/lib/business-profile';
import { ARTICLE_MEDIA, NO_STORE_MEDIA } from '@/lib/media-cache';

export const runtime = 'nodejs';
/** `?thumb` from the wall's grid, `?size=thumbnail` from the shared photo viewer's strip. */
const thumb = (search: URLSearchParams) => search.has('thumb') || search.get('size') === 'thumbnail';
/** A photo of a company's wall post (`?thumb` or `?size=thumbnail` — the small one). A post can be deleted, so a day's cache, as articles. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  const data = await getCompanyPostPhoto(id, session?.user.id ?? null, thumb(new URL(request.url).searchParams));
  if (!data) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return new Response(new Uint8Array(data), { headers: { 'Cache-Control': session ? NO_STORE_MEDIA : ARTICLE_MEDIA, 'Content-Type': 'image/webp', 'Content-Disposition': 'inline', 'X-Content-Type-Options': 'nosniff' } });
}
