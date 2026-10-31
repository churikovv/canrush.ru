import Link from '@/components/navigation-progress';
import { CapIcon } from '@/components/gacha-icons';
import { RARITY_ODDS, bannerEndsLabel, type GachaBanner, type GachaScene } from '@/lib/gacha-fields';

/**
 * The way into «Банкомат» on the home page, in its game style: the machine's idle loop from Blender on the left, a game
 * panel on the right — the name, the top prize and a chunky «Крутить» key (free while a pull without caps is there).
 * A running season puts its name and its frame here.
 */
export function GachaHomeBanner({ banner, scene, teaser }: { banner: GachaBanner | null; scene: GachaScene; teaser: { caps: number; free: boolean; quests: { claimed: number; total: number } } | null }) {
  return <Link className="gacha-home" href="/gacha" aria-label={banner ? `${banner.title}: крутить Банкомат` : 'Крутить Банкомат'}>
    <span className="gacha-home-art" aria-hidden="true">
      <video className="gacha-home-video" src={scene.idle} poster={scene.poster} autoPlay loop muted playsInline preload="metadata" />
    </span>
    <span className="gacha-home-panel">
      {teaser && <span className="game-chip gacha-home-caps"><CapIcon size={16} />{teaser.caps}</span>}
      <span className="gacha-home-title">{banner && <span aria-hidden="true">🎃</span>}{banner?.title ?? 'Банкомат'}</span>
      <small className="gacha-home-when">{banner ? `Хеллоуин · до ${bannerEndsLabel(banner)}` : 'Карточки банок'}</small>
      <span className="gacha-home-prize">{banner?.cosmetic ? `Рамка «Тыквенная» · ${banner.cosmetic.odds / 10}%` : teaser ? `Задания · ${teaser.quests.claimed} из ${teaser.quests.total}` : `Легендарная · ${RARITY_ODDS.legendary / 10}%`}</span>
      <span className="game-btn gacha-home-cta" data-tone="orange" aria-hidden="true">
        <span className="game-btn-face"><span className="game-btn-label">Крутить</span>
          <span className="game-btn-price">{teaser?.free === false ? <><CapIcon size={14} />10</> : 'Бесплатно'}</span></span>
      </span>
    </span>
  </Link>;
}
