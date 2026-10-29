import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getCompanyPostFile } from '@/lib/business-profile';
import { ARTICLE_MEDIA, NO_STORE_MEDIA } from '@/lib/media-cache';

export const runtime = 'nodejs';
/**
 * A PDF presentation from a company's wall, opened in the browser's own viewer. It stays a PDF — its type and
 * `nosniff` — and the site's CSP (set in `proxy.ts`) allows no script without the page's nonce. Not `sandbox`: Chrome's
 * viewer does not open a sandboxed PDF. A post can be deleted, so a day's cache, as articles.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  const file = await getCompanyPostFile(id, session?.user.id ?? null);
  if (!file) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return new Response(new Uint8Array(file.data), { headers: {
    'Cache-Control': session ? NO_STORE_MEDIA : ARTICLE_MEDIA,
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    'X-Content-Type-Options': 'nosniff',
  } });
}
