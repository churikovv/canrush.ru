import { getCompanyBanner } from '@/lib/business-profile';
import { IMMUTABLE_MEDIA } from '@/lib/media-cache';

export const runtime = 'nodejs';
/** A company's profile banner. A new upload gets a new id, so the bytes under one id never change. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getCompanyBanner(id);
  if (!data) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return new Response(new Uint8Array(data), { headers: { 'Cache-Control': IMMUTABLE_MEDIA, 'Content-Type': 'image/webp', 'Content-Disposition': 'inline', 'X-Content-Type-Options': 'nosniff' } });
}
