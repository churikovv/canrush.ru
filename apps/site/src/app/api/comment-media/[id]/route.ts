import { serveStoredMedia } from '@/lib/media-response';

export const runtime = 'nodejs';

/** Attachments of review, tier list and wall comments; as public as the discussions they belong to. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return serveStoredMedia(request, 'commentMedia', (await params).id);
}
