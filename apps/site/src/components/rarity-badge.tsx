import { useId } from 'react';
import { LEVEL_SHAPES } from '@/components/level-badge';
import { RARITY_LABELS, type Rarity } from '@/lib/gacha-fields';

/** Silhouettes borrowed from the ranks: the rarer the card, the more elaborate the shape, as with Legend's star. */
const SHAPE: Record<Rarity, string> = {
  common: LEVEL_SHAPES.rookie,
  rare: LEVEL_SHAPES.bronze,
  epic: LEVEL_SHAPES.gold,
  legendary: LEVEL_SHAPES.legend,
};
const BOLT = 'M56 22 34 54h13l-4 24 23-33H52Z';
const SPARKLE = 'M0-10Q1-1 10 0Q1 1 0 10Q-1 1-10 0Q-1-1 0-10Z';
const TWINKLES = [{ x: 90, y: 16, scale: .5, delay: 0 }, { x: 10, y: 84, scale: .36, delay: -1.3 }, { x: 94, y: 78, scale: .3, delay: -2.5 }];
const TWINKLE_COUNT: Record<Rarity, number> = { common: 0, rare: 0, epic: 2, legendary: 3 };

/** A metal pill with the rarity's silhouette, like the rank chip. */
export function RarityChip({ rarity }: { rarity: Rarity }) {
  return <span className="rarity-chip" data-rarity={rarity}>
    <svg className="rarity-chip-glyph" viewBox="0 0 100 100" aria-hidden="true"><path d={SHAPE[rarity]} /></svg>
    {RARITY_LABELS[rarity]}
  </span>;
}

/** The rarity's metal emblem with a bolt: a smaller cousin of `LevelEmblem`. Decorative, the label stands next to it. */
export function RarityEmblem({ rarity }: { rarity: Rarity }) {
  const id = useId().replace(/:/g, '');
  return <svg className="rarity-emblem" data-rarity={rarity} viewBox="0 0 100 100" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-metal`} x1=".15" y1="0" x2=".85" y2="1">
        <stop offset="0" className="rarity-stop-light" /><stop offset=".42" className="rarity-stop-mid" /><stop offset="1" className="rarity-stop-dark" />
      </linearGradient>
    </defs>
    <path className="rarity-emblem-body" d={SHAPE[rarity]} fill={`url(#${id}-metal)`} />
    <path className="rarity-emblem-bevel" d={SHAPE[rarity]} transform="translate(50 50) scale(.8) translate(-50 -50)" fill="none" />
    <path className="rarity-emblem-bolt" d={BOLT} />
  </svg>;
}

/** The moving light of a `.rarity-card`, its first child: effects grow with rarity as they do with rank. Long grids pass `twinkles={false}`. */
export function RarityShine({ rarity, twinkles = true }: { rarity: Rarity; twinkles?: boolean }) {
  if (rarity === 'common') return null;
  return <span className="rarity-shine" aria-hidden="true">
    <i className="rarity-sheen" />
    {twinkles && TWINKLES.slice(0, TWINKLE_COUNT[rarity]).map(item => <svg key={item.x} className="rarity-twinkle" viewBox="-10 -10 20 20" style={{ left: `${item.x}%`, top: `${item.y}%`, width: `${item.scale * 36}px`, animationDelay: `${item.delay}s` }}><path d={SPARKLE} /></svg>)}
  </span>;
}
