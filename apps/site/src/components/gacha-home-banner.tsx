import Link from '@/components/navigation-progress';
import { AtmKeyFace } from '@/components/atm-key';
import { CapIcon } from '@/components/gacha-icons';
import { RARITY_ODDS, bannerEndsLabel, type GachaBanner, type GachaScene } from '@/lib/gacha-fields';

const CHECK = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4.5 4.5L19 7" /></svg>;

/**
 * The way into «Банкомат» on the home page, first in the games row: the machine's idle loop from Blender fills the card
 * and fades into a night panel on the right — the caps, the name, today's tasks and the machine's «Крутить» key
 * (`AtmKeyFace`, free while a pull without caps is there). A running season puts its name and its frame here.
 */
export function GachaHomeBanner({ banner, scene, teaser }: { banner: GachaBanner | null; scene: GachaScene; teaser: { caps: number; free: boolean; quests: { claimed: number; total: number } } | null }) {
  return <Link className="game-promo gacha-home" href="/gacha" aria-label={banner ? `${banner.title}: крутить Банкомат` : 'Крутить Банкомат'}>
    <span className="gacha-home-art" aria-hidden="true">
      <video className="gacha-home-video" src={scene.idle} poster={scene.poster} autoPlay loop muted playsInline preload="metadata" />
    </span>
    {teaser && <span className="game-chip gacha-home-caps"><CapIcon size={16} />{teaser.caps}</span>}
    <span className="game-promo-body">
      <span className="game-promo-title">{banner && <span aria-hidden="true">🎃 </span>}{banner?.title ?? 'Банкомат'}</span>
      <small className="game-promo-sub">{banner ? `Хеллоуин · до ${bannerEndsLabel(banner)}` : 'Карточки банок для альбома и боёв'}</small>
      <span className="game-promo-chips">
        {banner?.cosmetic ? <span>Рамка «Тыквенная» · {banner.cosmetic.odds / 10}%</span>
          : teaser ? <span data-done={teaser.quests.claimed === teaser.quests.total || undefined}>{teaser.quests.claimed === teaser.quests.total && CHECK}Задания {teaser.quests.claimed} из {teaser.quests.total}</span>
          : <span>Легендарная · {RARITY_ODDS.legendary / 10}%</span>}
      </span>
      <span className="atm-key gacha-home-cta" data-tone="gold" aria-hidden="true">
        <AtmKeyFace label="Крутить" price={teaser?.free === false ? <><CapIcon size={14} />10</> : 'Бесплатно'} />
      </span>
    </span>
  </Link>;
}
