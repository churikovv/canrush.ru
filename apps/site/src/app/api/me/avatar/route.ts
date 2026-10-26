import { headers } from 'next/headers';
import { getPool } from '@/db/pool';
import { auth } from '@/lib/auth';

export const runtime = 'nodejs';
/**
 * The signed-in member's avatar for the header: a redirect to the avatar's own address (cached there for 30 days), so
 * the header needs no database query while the page renders. 404 — no avatar or no session; the header shows the icon.
 */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  const headersOut = { 'Cache-Control': 'private, max-age=60' };
  if (!session) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  const { rows } = await getPool().query<{ id: string }>(`select id::text from "profileImage" where "userId" = $1 and kind = 'avatar'`, [session.user.id]);
  if (!rows[0]) return new Response(null, { status: 404, headers: headersOut });
  return new Response(null, { status: 302, headers: { ...headersOut, Location: `/api/profile-images/${rows[0].id}` } });
}
