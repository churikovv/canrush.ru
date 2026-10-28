import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { isSiteStaffEmail } from '@/lib/admin';
import { getDrinkEditPhoto } from '@/lib/brand-drink-edits';
import { PHOTO_ID_PATTERN } from '@/lib/review-photo-limits';

export const runtime = 'nodejs';
/** The photo of a proposed card edit: only the company's team and staff see it, nothing is cached. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!PHOTO_ID_PATTERN.test(id) || !session) return new Response(null, { status: 404 });
  const staff = await isSiteStaffEmail(session.user.email);
  const photo = await getDrinkEditPhoto(id, session.user.id, staff, new URL(request.url).searchParams.get('size') === 'thumbnail' ? 'thumbnail' : 'full');
  return new Response(photo ? new Uint8Array(photo) : null, {
    status: photo ? 200 : 404,
    headers: { 'Content-Type': 'image/webp', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' },
  });
}
