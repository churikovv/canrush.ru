import { serveStoredMedia } from '@/lib/media-response';
import { PHOTO_ID_PATTERN } from '@/lib/review-photo-limits';
import { isStoryVisible } from '@/lib/stories';

export const runtime = 'nodejs';

/** Story photos and videos, public like the home page while the story is up (24 hours). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!PHOTO_ID_PATTERN.test(id) || !await isStoryVisible(id)) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return serveStoredMedia(request, 'story', id);
}
