import { badgeTheme } from '@/lib/brand-materials-fields';
import { badgeResponse, drinkTarget } from '@/lib/brand-materials';
import { drinkBySlug } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

/** A drink's rating badge for a brand's site: `/badge/<slug>.svg`, `?theme=dark` for a dark page. */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const group = slug.endsWith('.svg') ? await drinkBySlug(slug.slice(0, -4)) : null;
  return badgeResponse(group ? drinkTarget(group) : null, badgeTheme(new URL(request.url).searchParams.get('theme')));
}
