import { getPool } from '@/db/pool';
import { serveStoredMedia } from '@/lib/media-response';
import { PHOTO_ID_PATTERN } from '@/lib/review-photo-limits';

export const runtime = 'nodejs';

/** Photos, GIFs and videos of community chat messages: public like the chat, but not those of a member banned by the site. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const visible = PHOTO_ID_PATTERN.test(id) && (await getPool().query(`select 1 from "chatMedia" x join "chatMessage" m on m.id = x."messageId"
    where x.id = $1 and not exists(select 1 from "userBlock" b where b."userId" = m."userId")`, [id])).rowCount;
  if (!visible) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return serveStoredMedia(request, 'chatMedia', id);
}
