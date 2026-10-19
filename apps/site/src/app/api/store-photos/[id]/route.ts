import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getStorePhoto } from '@/lib/stores';
import { PHOTO_ID_PATTERN } from '@/lib/review-photo-limits';

export const runtime = 'nodejs';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!PHOTO_ID_PATTERN.test(id)) return new Response(null, { status: 404 });
  const session = await auth.api.getSession({ headers: await headers() });
  const requested = new URL(request.url).searchParams.get('size');
  const data = await getStorePhoto(id, session?.user.id ?? null, requested === 'thumbnail' || requested === 'card' ? requested : 'full');
  return new Response(data ? new Uint8Array(data) : null, {
    status: data ? 200 : 404,
    headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
