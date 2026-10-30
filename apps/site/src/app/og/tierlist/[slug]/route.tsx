import { defaultOgCard, OG_HOUR, ogResponse, tierListOgCard } from '@/lib/og-image';
import { getTierListBySlug } from '@/lib/tier-lists';

export const dynamic = 'force-dynamic';

/**
 * A tier list's link preview. Only a published list shows its title: a draft or a missing one gets the site's picture.
 * An hour of cache, not a day: a list the team has deleted should not keep its title in previews for long.
 */
export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const list = await getTierListBySlug((await params).slug);
  if (!list || list.status !== 'published') return ogResponse('default', defaultOgCard);
  return ogResponse(`tierlist:${list.slug}`, () => tierListOgCard({ title: list.title, author: list.author.username ?? 'участник' }), OG_HOUR);
}
