import { defaultOgCard, ogResponse } from '@/lib/og-image';

export const dynamic = 'force-dynamic';

/** The site's picture for link previews: every page without its own. */
export function GET() {
  return ogResponse('default', defaultOgCard);
}
