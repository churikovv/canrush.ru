import Link from '@/components/navigation-progress';
import { CapIcon } from '@/components/gacha-icons';
import { bannerEndsLabel, type GachaBanner } from '@/lib/gacha-fields';

/**
 * The season's way into «Банкомат» on the home page, in its game style: the machine's idle loop from Blender on the
 * left, a game panel on the right — the season's name, the frame's chance and a chunky «Крутить» key (free while
 * today's pull is there). Shown only while a banner with a scene runs; the small «Банкомат» icon steps aside for it.
 */
export function GachaHomeBanner({ banner, teaser }: { banner: GachaBanner & { scene: NonNullable<GachaBanner['scene']> }; teaser: { caps: number; free: boolean } | null }) {
  return <Link className="gacha-home" href="/gacha" aria-label={`${banner.title}: крутить Банкомат`}>
    <span className="gacha-home-art" aria-hidden="true">
      <video className="gacha-home-video" src={banner.scene.idle} poster={banner.scene.poster} autoPlay loop muted playsInline preload="metadata" />
    </span>
    <span className="gacha-home-panel">
      {teaser && <span className="game-chip gacha-home-caps"><CapIcon size={16} />{teaser.caps}</span>}
      <span className="gacha-home-title"><span aria-hidden="true">🎃</span>{banner.title}</span>
      <small className="gacha-home-when">Хеллоуин · до {bannerEndsLabel(banner)}</small>
      {banner.cosmetic && <span className="gacha-home-prize">Рамка «Тыквенная» · {banner.cosmetic.odds / 10}%</span>}
      <span className="game-btn gacha-home-cta" data-tone="orange" aria-hidden="true">
        <span className="game-btn-face"><span className="game-btn-label">Крутить</span>
          <span className="game-btn-price">{teaser?.free === false ? <><CapIcon size={14} />10</> : 'Бесплатно'}</span></span>
      </span>
    </span>
  </Link>;
}
