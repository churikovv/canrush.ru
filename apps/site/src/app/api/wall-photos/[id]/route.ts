import { getPool } from '@/db/pool';
import { PHOTO_ID_PATTERN } from '@/lib/review-photo-limits';

export const runtime = 'nodejs';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!PHOTO_ID_PATTERN.test(id)) return new Response(null, { status: 404 });
  const thumbnail = new URL(request.url).searchParams.get('size') === 'thumbnail';
  const result = await getPool().query<{ data: Buffer }>(
    `select ${thumbnail ? '"thumbnail"' : '"data"'} as data from "wallPhoto" where "id" = $1`, [id],
  );
  const photo = result.rows[0];
  if (!photo) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return new Response(new Uint8Array(photo.data), {
    headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline' },
  });
}
