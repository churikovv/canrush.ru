import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Next's production public-file index is captured at startup. Serve parser
// images added afterwards from the shared volume without restarting the site.
export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  const match = /^(?:[a-f0-9]{16}|[a-f0-9]{64})\.(jpg|png|webp|gif)$/.exec(filename);
  const missing = () => new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  if (!match) return missing();
  try {
    const bytes = await readFile(path.join(process.cwd(), 'public/images/products', filename));
    if (!bytes.length) return missing();
    const type = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' }[match[1]!];
    return new Response(new Uint8Array(bytes), { headers: {
      'Content-Type': type!,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    } });
  } catch (error) {
    if (['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) return missing();
    throw error;
  }
}
