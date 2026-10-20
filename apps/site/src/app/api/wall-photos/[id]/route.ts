import { serveStoredMedia } from '@/lib/media-response';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return serveStoredMedia(request, 'wallPhoto', (await params).id);
}
