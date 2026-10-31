import { bannerEndsLabel, GACHA_BANNERS, MAIN_BANNER, MAIN_SCENE } from '@/lib/gacha-fields';
import { defaultOgCard, ogResponse, seasonOgCard } from '@/lib/og-image';

export const dynamic = 'force-dynamic';

/** The machine's link preview. The address carries the season, so the next one never gets an old cached picture. */
export async function GET(_: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (key === MAIN_BANNER) return ogResponse(`gacha:${key}`, () => seasonOgCard({ title: 'Крути и собирай банки', note: 'Бесплатная крутка каждый день', poster: MAIN_SCENE.poster }));
  const banner = GACHA_BANNERS.find(item => item.key === key);
  if (!banner?.scene) return ogResponse('default', defaultOgCard);
  const poster = banner.scene.poster;
  return ogResponse(`gacha:${banner.key}`, () => seasonOgCard({ title: banner.title, note: `Сезон до ${bannerEndsLabel(banner)}`, poster }));
}
