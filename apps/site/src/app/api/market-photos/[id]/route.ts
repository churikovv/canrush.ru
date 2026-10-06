import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getMarketPhoto } from '@/lib/market';
import { PHOTO_ID_PATTERN } from '@/lib/review-photo-limits';

export const runtime = 'nodejs';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!PHOTO_ID_PATTERN.test(id)) return new Response(null, { status: 404 });
  const session = await auth.api.getSession({ headers: await headers() });
  const data = await getMarketPhoto(id, session?.user.id ?? null, new URL(request.url).searchParams.get('size') === 'thumbnail');
  return new Response(data ? new Uint8Array(data) : null, {
    status: data ? 200 : 404,
    headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
