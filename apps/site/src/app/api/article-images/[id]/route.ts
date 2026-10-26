import { headers } from 'next/headers';
import { getArticleImage } from '@/lib/articles';
import { auth } from '@/lib/auth';
import { ARTICLE_MEDIA, NO_STORE_MEDIA } from '@/lib/media-cache';

export const runtime = 'nodejs';
/** An article photo (`?thumb` — the small one for cards): public once the article is published, before that only for its author and the team. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  const image = await getArticleImage(id, session?.user.id ?? null, new URL(request.url).searchParams.has('thumb'));
  if (!image) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return new Response(new Uint8Array(image.data), { headers: {
    'Cache-Control': image.published ? ARTICLE_MEDIA : NO_STORE_MEDIA, 'Content-Type': 'image/webp', 'Content-Disposition': 'inline', 'X-Content-Type-Options': 'nosniff',
  } });
}
