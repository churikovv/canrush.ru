import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { getPool } from '@/db/pool';
import { auth } from '@/lib/auth';

/** Username suggestions for "@" in comments and posts: signed-in members only, prefix match, most experienced first. */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ users: [] }, { status: 401 });
  const query = (new URL(request.url).searchParams.get('q') ?? '').toLowerCase();
  if (!/^[a-z0-9_]{0,24}$/u.test(query)) return NextResponse.json({ users: [] });
  const { rows } = await getPool().query<{ username: string; name: string; avatarId: string | null }>(`select r.username, r.name,
      (select id::text from "profileImage" where "userId" = r.id and kind = 'avatar') as "avatarId"
    from "profileRanking" r where starts_with(r.username, $1) and r.id <> $2
    order by (r.username = $1) desc, r.xp desc, r.username limit 6`, [query, session.user.id]);
  return NextResponse.json({ users: rows }, { headers: { 'Cache-Control': 'no-store' } });
}
