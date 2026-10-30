import { bannerEndsLabel, GACHA_BANNERS } from '@/lib/gacha-fields';
import { defaultOgCard, ogResponse, seasonOgCard } from '@/lib/og-image';

export const dynamic = 'force-dynamic';

/** A season's link preview. The address carries the season, so the next one never gets an old cached picture. */
export async function GET(_: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const banner = GACHA_BANNERS.find(item => item.key === key);
  if (!banner?.scene) return ogResponse('default', defaultOgCard);
  const poster = banner.scene.poster;
  return ogResponse(`gacha:${banner.key}`, () => seasonOgCard({ title: banner.title, note: `Сезон до ${bannerEndsLabel(banner)}`, poster }));
}
