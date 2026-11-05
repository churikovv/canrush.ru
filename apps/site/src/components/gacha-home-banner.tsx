import Link from '@/components/navigation-progress';
import { CapIcon } from '@/components/gacha-icons';
import { RARITY_ODDS, bannerEndsLabel, type GachaBanner, type GachaScene } from '@/lib/gacha-fields';

const ARROW = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
const CHECK = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4.5 4.5L19 7" /></svg>;

/**
 * The way into «Банкомат» on the home page, first in the games row: the machine's idle loop from Blender fills the card
 * and fades into a night panel on the right — the caps, the name, today's tasks and a white «Крутить» pill, the same as
 * «В бой» on the battle banner next to it. A free pull is told in the subtitle: «Крутить бесплатно» does not fit the pill
 * on a phone, and a second chip made this card taller than its neighbour. A running season puts its name and frame here.
 */
export function GachaHomeBanner({ banner, scene, teaser }: { banner: GachaBanner | null; scene: GachaScene; teaser: { caps: number; free: boolean; quests: { claimed: number; total: number } } | null }) {
  return <Link className="game-promo gacha-home" href="/gacha" aria-label={banner ? `${banner.title}: крутить Банкомат` : 'Крутить Банкомат'}>
    <span className="gacha-home-art" aria-hidden="true">
      <video className="gacha-home-video" src={scene.idle} poster={scene.poster} autoPlay loop muted playsInline preload="metadata" />
    </span>
    {teaser && <span className="game-chip gacha-home-caps"><CapIcon size={16} />{teaser.caps}</span>}
    <span className="game-promo-body">
      <span className="game-promo-title">{banner && <span aria-hidden="true">🎃 </span>}{banner?.title ?? 'Банкомат'}</span>
      <small className="game-promo-sub">{banner ? `Хеллоуин · до ${bannerEndsLabel(banner)}` : teaser?.free ? 'Есть бесплатная крутка' : 'Карточки банок для альбома и боёв'}</small>
      <span className="game-promo-chips">
        {banner?.cosmetic ? <span>Рамка «Тыквенная» · {banner.cosmetic.odds / 10}%</span>
          : teaser ? <span data-done={teaser.quests.claimed === teaser.quests.total || undefined}>{teaser.quests.claimed === teaser.quests.total && CHECK}Задания {teaser.quests.claimed} из {teaser.quests.total}</span>
          : <span>Легендарная · {RARITY_ODDS.legendary / 10}%</span>}
      </span>
      <span className="game-promo-cta">Крутить{ARROW}</span>
    </span>
  </Link>;
}
