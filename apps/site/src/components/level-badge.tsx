import { Fragment, useId } from 'react';
import { hasPartialDegrees, levelRank, levelTier, type LevelRank, type LevelTier } from '@/lib/level-tier';
import { RANK_ART, RANK_GLYPHS, type RankPart } from '@/lib/rank-art';

function star(points: number, outer: number, inner: number) {
  return Array.from({ length: points * 2 }, (_, index) => {
    const radius = index % 2 ? inner : outer;
    const angle = (Math.PI * index) / points - Math.PI / 2;
    return `${index ? 'L' : 'M'}${(50 + radius * Math.cos(angle)).toFixed(2)} ${(50 + radius * Math.sin(angle)).toFixed(2)}`;
  }).join('') + 'Z';
}

/** Metal silhouettes of the achievement and rarity badges (`achievement-emblem.tsx`, `rarity-badge.tsx`); ranks have their own art (`rank-art.ts`). */
export const LEVEL_SHAPES: Record<LevelTier['key'], string> = {
  rookie: 'M50 5.5 89 28v44L50 94.5 11 72V28Z',
  bronze: 'M50 4 87 17v31c0 24-15 40-37 48C28 88 13 72 13 48V17Z',
  silver: star(8, 49, 41),
  gold: star(10, 49, 38),
  platinum: star(6, 50, 37),
  legend: star(16, 49, 39),
  myth: star(24, 50, 42),
};
const BOLT = 'M15 0 3 17h8L6 32l16-20h-8.5L20 0Z';
const SPARKLE = 'M0-10Q1-1 10 0Q1 1 0 10Q-1 1-10 0Q-1-1 0-10Z';
const TWINKLES = [{ x: 86, y: 14, scale: .55, delay: 0 }, { x: 12, y: 82, scale: .38, delay: -1.4 }, { x: 93, y: 74, scale: .3, delay: -2.6 }];
const TWINKLE_COUNT: Partial<Record<LevelTier['key'], number>> = { silver: 1, gold: 2, platinum: 3, legend: 3, myth: 3 };
/** Myth throws embers up from behind the crest. */
const EMBERS = [{ x: 30, y: 70, delay: 0 }, { x: 70, y: 66, delay: -.8 }, { x: 42, y: 84, delay: -1.6 }, { x: 60, y: 80, delay: -2.3 }, { x: 22, y: 50, delay: -1.1 }, { x: 78, y: 48, delay: -2.8 }];
/** The emblem grows with the degree, as competitive ranks do: smaller and plainer at the first, full at the last. */
const STAGE_SCALE = [1, .8, .9, 1];
const FILLS: Partial<Record<RankPart['k'], string>> = { chrome: 'metal', blade: 'blade', shadow: 'shadow', core: 'core', gem: 'gem' };

/** The art stage of a degree: three steps over the tier's degrees; the open-ended Myth is always at full size. */
export function rankStage(rank: LevelRank): 1 | 2 | 3 {
  if (rank.degrees === null) return 3;
  return Math.min(3, Math.max(1, Math.ceil(rank.degree * 3 / rank.degrees))) as 1 | 2 | 3;
}

/**
 * The rank emblem: an abstract chrome emblem of the rank (`RANK_ART`) — metal bands, a dark core, bright edges, blade
 * wings and a faceted gem from Legend up — that grows and gains parts with the degree. It glows in the rank's colour;
 * wings beat, the gem pulses, Myth's thorn ring turns and throws embers. `position` (rankPosition of the XP) names the
 * exact degree; a bare level shows the degree it starts with. `wings` adds lightning bolts beside it (experience panel)
 * for the ranks that have no wings of their own.
 */
export function LevelEmblem({ level, position = level, wings = false }: { level: number; position?: number; wings?: boolean }) {
  const id = useId().replace(/:/g, '');
  const rank = levelRank(position);
  const { tier } = rank;
  const stage = rankStage(rank);
  const parts = RANK_ART[tier.key].filter(part => (part.s ?? 1) <= stage);
  const bolts = wings && !parts.some(part => part.g === 'wl');
  const twinkles = TWINKLES.slice(0, TWINKLE_COUNT[tier.key] ?? 0);
  return <svg className={`level-emblem${bolts ? ' has-wings' : ''}`} data-level-tier={tier.key} data-stage={stage} viewBox={bolts ? '-38 0 176 100' : '0 0 100 100'} role="img" aria-label={`Уровень ${level}, ранг «${rank.label}»`}>
    <defs>
      {/* Chrome: light, mid, a bright band, a dark band, mid again — a polished metal reflection. */}
      <linearGradient id={`${id}-metal`} x1=".1" y1="0" x2=".9" y2="1">
        <stop offset="0" className="level-stop-light" /><stop offset=".28" className="level-stop-mid" /><stop offset=".46" className="level-stop-light" /><stop offset=".64" className="level-stop-dark" /><stop offset="1" className="level-stop-mid" />
      </linearGradient>
      <linearGradient id={`${id}-blade`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" className="level-stop-light" /><stop offset=".5" className="level-stop-mid" /><stop offset="1" className="level-stop-dark" /></linearGradient>
      <linearGradient id={`${id}-shadow`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" className="level-stop-mid" /><stop offset="1" className="level-stop-core" /></linearGradient>
      <linearGradient id={`${id}-core`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" className="level-stop-core" /><stop offset="1" className="level-stop-deep" /></linearGradient>
      <radialGradient id={`${id}-gem`} cx=".45" cy=".35" r=".75"><stop offset="0" stopColor="#fff" /><stop offset=".3" className="level-stop-gem" /><stop offset="1" className="level-stop-gem-deep" /></radialGradient>
      <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".7" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      {/* An SVG blur, not a CSS one: Safari ignores CSS filters on elements inside an SVG. */}
      <filter id={`${id}-blur`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.5" /></filter>
      <clipPath id={`${id}-clip`}>{parts.filter(part => part.k !== 'shadow' && part.g !== 'thorns' && part.g !== 'halo').map((part, index) => <path key={index} d={part.d} />)}</clipPath>
    </defs>
    {bolts && <g className="level-emblem-wings">
      <path d={BOLT} transform="translate(4 22) rotate(22) scale(-1.25 1.25)" />
      <path d={BOLT} transform="translate(-18 42) rotate(12) scale(-.8 .8)" />
      <path d={BOLT} transform="translate(96 22) rotate(-22) scale(1.25)" />
      <path d={BOLT} transform="translate(118 42) rotate(-12) scale(.8)" />
    </g>}
    <g transform={`translate(50 50) scale(${STAGE_SCALE[stage]}) translate(-50 -50)`}>
      {parts.map((part, index) => {
        const fill = FILLS[part.k];
        return <Fragment key={index}>
          {part.k === 'gem' && <path d={part.d} className="rank-gem-glow" filter={`url(#${id}-blur)`} />}
          <path d={part.d} className={`rank-${part.k}`} data-g={part.g} fill={fill ? `url(#${id}-${fill})` : undefined} fillRule={part.e ? 'evenodd' : undefined} />
        </Fragment>;
      })}
      {tier.key !== 'rookie' && <g clipPath={`url(#${id}-clip)`}><g transform="rotate(20 50 50)"><rect className="level-emblem-sheen" x="-40" y="-30" width="26" height="160" fill={`url(#${id}-sheen)`} /></g></g>}
      {tier.key === 'myth' && EMBERS.map(ember => <circle key={ember.x} className="rank-ember" cx={ember.x} cy={ember.y} r="1.4" style={{ animationDelay: `${ember.delay}s` }} />)}
    </g>
    {twinkles.map(item => <g key={item.x} transform={`translate(${item.x} ${item.y}) scale(${item.scale})`}>
      <path className="level-twinkle" d={SPARKLE} style={{ animationDelay: `${item.delay}s` }} />
    </g>)}
  </svg>;
}

export function LevelChip({ level }: { level: number }) {
  const rank = levelRank(level);
  // A bare level cannot tell the degrees inside it (Новичок, Бронза), so the hint names the rank alone there.
  return <span className="profile-level" data-level-tier={rank.tier.key} title={hasPartialDegrees(rank.tier) ? rank.tier.label : rank.label}><LevelChipContent level={level} /></span>;
}

export function LevelTierGlyph({ tier }: { tier: LevelTier['key'] }) {
  return <svg className="level-tier-glyph" viewBox="0 0 100 100" aria-hidden="true"><path d={RANK_GLYPHS[tier]} /></svg>;
}

/** Compact chip for author rows; the tier shape doubles as a glyph. */
export function LevelChipContent({ level }: { level: number }) {
  const { tier } = levelTier(level);
  return <>
    <svg className="level-chip-glyph" viewBox="0 0 100 100" aria-hidden="true"><path d={RANK_GLYPHS[tier.key]} /></svg>
    Ур. {level}
  </>;
}
