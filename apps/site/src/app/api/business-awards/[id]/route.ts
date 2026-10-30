import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getCompanyAwardFile } from '@/lib/business-profile';
import { ARTICLE_MEDIA, NO_STORE_MEDIA } from '@/lib/media-cache';

export const runtime = 'nodejs';
/** `?thumb` from the grid, `?size=thumbnail` from the shared photo viewer's strip. */
const thumb = (search: URLSearchParams) => search.has('thumb') || search.get('size') === 'thumbnail';
/**
 * The file of a company's award: a WebP picture or a PDF, told by what the server stored. A PDF stays a PDF, as the
 * wall's presentations (`/api/business-files`). An award can be deleted, so a day's cache, as articles.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  const file = await getCompanyAwardFile(id, session?.user.id ?? null, thumb(new URL(request.url).searchParams));
  if (!file) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return new Response(new Uint8Array(file.data), { headers: {
    'Cache-Control': session ? NO_STORE_MEDIA : ARTICLE_MEDIA,
    'Content-Type': file.name ? 'application/pdf' : 'image/webp',
    'Content-Disposition': file.name ? `inline; filename*=UTF-8''${encodeURIComponent(file.name)}` : 'inline',
    'X-Content-Type-Options': 'nosniff',
  } });
}
