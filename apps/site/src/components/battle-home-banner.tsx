import Link from '@/components/navigation-progress';
import { DrinkBird } from '@/components/drink-bird';
import { RingIcon } from '@/components/gacha-icons';
import { SPIN_RING_COST } from '@/lib/battle-fields';
import type { BattleTeaser } from '@/lib/battle';

const ARROW = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
/** Three cards fanned out: mana in the corner, attack and health below, the brand mark on their faces. */
const CARDS = [{ mana: 2, attack: 2, health: 3 }, { mana: 4, attack: 5, health: 4 }, { mana: 3, attack: 3, health: 4 }];

/**
 * The way into «Битва банок» on the home page, next to the Bankomat in the games row: the battle's own board (the moon,
 * the lanterns) with Сова on the moon, a fan of cards, the member's rings and how many wins still pay today.
 */
export function BattleHomeBanner({ teaser }: { teaser: BattleTeaser | null }) {
  const label = teaser?.inBattle ? 'Вернуться в бой' : 'В бой';
  return <Link className="game-promo battle-home" href="/gacha/battle" aria-label={`Битва банок: ${label.toLowerCase()}`}>
    <span className="battle-home-owl" aria-hidden="true"><DrinkBird mood="waiting" size={60} /></span>
    <span className="battle-home-cards" aria-hidden="true">{CARDS.map(card => <i key={card.mana}>
      <b className="battle-home-mana">{card.mana}</b><s>{card.attack}</s><u>{card.health}</u>
    </i>)}</span>
    <span className="game-promo-body">
      <span className="game-promo-title">Битва банок</span>
      <small className="game-promo-sub">Бой с Совой картами из Банкомата</small>
      {teaser && <span className="game-promo-chips">
        <span><RingIcon size={14} />{teaser.rings} из {SPIN_RING_COST} до крутки</span>
        {!teaser.inBattle && <span>{teaser.paidLeft ? `Побед с наградой: ${teaser.paidLeft}` : 'Награды на сегодня собраны'}</span>}
      </span>}
      <span className="game-promo-cta">{label}{ARROW}</span>
    </span>
  </Link>;
}
