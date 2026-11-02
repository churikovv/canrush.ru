import type { CSSProperties } from 'react';
import { CanSkin } from '@/components/can-skin';
import { CanVolume } from '@/components/can-volume';
import { CoverImage } from '@/components/cover-image';
import { canSkin } from '@/lib/can-skin';
import { cutoutSrc } from '@/lib/can-cutout-src';
import { RarityChip, RarityShine } from '@/components/rarity-badge';
import type { Rarity } from '@/lib/gacha-fields';

/** What a big card needs: the can, its rarity and how many copies the member has. */
export interface ShownCard { brand: string; flavor: string; name: string; cover: string; href: string; rarity: Rarity; count?: number }

/**
 * A Bankomat card at full size, like a trading card: the can on a light panel, the rarity's metal, the can's own look
 * (`CanSkin`) and the name below. `live` turns on the look's motion (particles, foil, sparkles) — only for the card in
 * focus, so a row of big cards does not animate all at once.
 */
export function BigCard({ card, live = false }: { card: ShownCard; live?: boolean }) {
  const cutout = cutoutSrc(card.cover);
  return <div className="big-card rarity-card" data-rarity={card.rarity} style={{ '--skin-a': canSkin(card.brand, card.flavor).a } as CSSProperties}>
    <RarityShine rarity={card.rarity} twinkles={live} />
    <CanSkin brand={card.brand} flavor={card.flavor} rarity={card.rarity} lite={!live} />
    {/* The can stands cut out over the card's look, lit by its flavour (and round in the big view, `CanVolume`); a cover
        from elsewhere keeps a panel tinted to its white. */}
    {cutout
      ? <span className="big-card-art" data-cutout=""><CanVolume src={cutout} /></span>
      : <span className="big-card-art">{card.cover ? <CoverImage src={card.cover} width={320} height={320} sizes="320px" unoptimized alt="" draggable={false} /> : <span className="big-card-silhouette" />}</span>}
    <span className="big-card-foot">
      <RarityChip rarity={card.rarity} />
      <strong>{card.brand}</strong>
      <span>{card.name}</span>
    </span>
    {(card.count ?? 0) > 1 && <span className="big-card-count">×{card.count}</span>}
  </div>;
}

/** A can that is not in the collection yet: its brand, a silhouette and a question mark — the flavour stays a surprise. */
export function MissingBigCard({ brand }: { brand: string }) {
  return <div className="big-card is-missing">
    <span className="big-card-art"><span className="big-card-silhouette" /><b aria-hidden="true">?</b></span>
    <span className="big-card-foot"><strong>{brand}</strong><span>Ещё нет в коллекции</span></span>
  </div>;
}
