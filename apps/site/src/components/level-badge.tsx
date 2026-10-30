import { useId } from 'react';
import { levelRank, levelTier, romanNumeral, type LevelTier } from '@/lib/level-tier';

function star(points: number, outer: number, inner: number) {
  return Array.from({ length: points * 2 }, (_, index) => {
    const radius = index % 2 ? inner : outer;
    const angle = (Math.PI * index) / points - Math.PI / 2;
    return `${index ? 'L' : 'M'}${(50 + radius * Math.cos(angle)).toFixed(2)} ${(50 + radius * Math.sin(angle)).toFixed(2)}`;
  }).join('') + 'Z';
}

/** Every rank has its own silhouette, growing more elaborate toward Legend's sixteen-point star. */
export const LEVEL_SHAPES: Record<LevelTier['key'], string> = {
  rookie: 'M50 5.5 89 28v44L50 94.5 11 72V28Z',
  bronze: 'M50 4 87 17v31c0 24-15 40-37 48C28 88 13 72 13 48V17Z',
  silver: star(8, 49, 41),
  gold: star(10, 49, 38),
  platinum: star(6, 50, 37),
  legend: star(16, 49, 39),
};
const BOLT = 'M15 0 3 17h8L6 32l16-20h-8.5L20 0Z';
const SPARKLE = 'M0-10Q1-1 10 0Q1 1 0 10Q-1 1-10 0Q-1-1 0-10Z';
const TWINKLES = [{ x: 86, y: 14, scale: .55, delay: 0 }, { x: 12, y: 82, scale: .38, delay: -1.4 }, { x: 93, y: 74, scale: .3, delay: -2.6 }];

/** Effects grow with the rank, Legend on top: sheen from Bronze, sparkles from Silver, a spinning aura from Gold. */
const AURA: Partial<Record<LevelTier['key'], 1 | 2>> = { gold: 1, platinum: 2, legend: 2 };
const TWINKLE_COUNT: Partial<Record<LevelTier['key'], number>> = { silver: 1, gold: 2, platinum: 3, legend: 3 };

/**
 * Large emblem: a metallic hexagon in the rank's colours with the level in white; Legend keeps its star. Older
 * ranks add effects (AURA, TWINKLE_COUNT). A ribbon carries the degree; `wings` adds lightning bolts (experience panel).
 */
export function LevelEmblem({ level, wings = false }: { level: number; wings?: boolean }) {
  const id = useId().replace(/:/g, '');
  const rank = levelRank(level);
  const { tier } = rank;
  const legend = tier.key === 'legend';
  const numeral = rank.label === tier.label ? null : romanNumeral(rank.degree);
  const ribbon = numeral ? 16 + numeral.length * 9 : 0;
  const shape = LEVEL_SHAPES[tier.key];
  const aura = AURA[tier.key] ?? 0;
  const twinkles = TWINKLES.slice(0, TWINKLE_COUNT[tier.key] ?? 0);
  return <svg className={`level-emblem${wings ? ' has-wings' : ''}`} data-level-tier={tier.key} viewBox={wings ? '-38 0 176 100' : '0 0 100 100'} role="img" aria-label={`Уровень ${level}, ранг «${rank.label}»`}>
    <defs>
      <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" className="level-stop-light" /><stop offset=".55" className="level-stop-mid" /><stop offset="1" className="level-stop-dark" />
      </linearGradient>
      <linearGradient id={`${id}-metal`} x1=".15" y1="0" x2=".85" y2="1">
        <stop offset="0" className="level-stop-light" /><stop offset=".38" className="level-stop-mid" /><stop offset="1" className="level-stop-dark" />
      </linearGradient>
      <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".7" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <clipPath id={`${id}-clip`}><path d={shape} /></clipPath>
    </defs>
    {wings && <g className="level-emblem-wings">
      <path d={BOLT} transform="translate(4 22) rotate(22) scale(-1.25 1.25)" />
      <path d={BOLT} transform="translate(-18 42) rotate(12) scale(-.8 .8)" />
      <path d={BOLT} transform="translate(96 22) rotate(-22) scale(1.25)" />
      <path d={BOLT} transform="translate(118 42) rotate(-12) scale(.8)" />
    </g>}
    {aura > 0 && <g className="level-aura" fill="none" stroke={`url(#${id}-fill)`}>
      <circle cx="50" cy="50" r={legend ? 49 : 51} strokeWidth="2.5" strokeDasharray="16 9" />
      {aura > 1 && <circle className="level-aura-reverse" cx="50" cy="50" r={legend ? 53 : 55} strokeWidth="1.2" strokeDasharray="3 12" />}
    </g>}
    <path d={shape} className="level-emblem-glow" fill="none" />
    <path d={shape} fill={`url(#${id}-${legend ? 'fill' : 'metal'})`} className="level-emblem-body" />
    {!legend && <rect x="0" y="0" width="100" height="47" clipPath={`url(#${id}-clip)`} className="level-emblem-facet" />}
    <path d={shape} transform="translate(50 50) scale(.82) translate(-50 -50)" className="level-emblem-bevel" fill="none" />
    {tier.key !== 'rookie' && <g clipPath={`url(#${id}-clip)`}><g transform="rotate(20 50 50)"><rect className="level-emblem-sheen" x="-40" y="-30" width="28" height="160" fill={`url(#${id}-sheen)`} /></g></g>}
    <text x="50" y="51" className="level-emblem-number" textAnchor="middle" dominantBaseline="central" fontSize={level >= 100 ? 30 : 40}>{level}</text>
    {numeral && <g className="level-degree">
      <rect x={50 - ribbon / 2} y="80" width={ribbon} height="20" rx="10" />
      <text x="50" y="90.5" textAnchor="middle" dominantBaseline="central">{numeral}</text>
    </g>}
    {twinkles.map(item => <g key={item.x} transform={`translate(${item.x} ${item.y}) scale(${item.scale})`}>
      <path className="level-twinkle" d={SPARKLE} style={{ animationDelay: `${item.delay}s` }} />
    </g>)}
  </svg>;
}

export function LevelChip({ level }: { level: number }) {
  const rank = levelRank(level);
  return <span className="profile-level" data-level-tier={rank.tier.key} title={rank.label}><LevelChipContent level={level} /></span>;
}

export function LevelTierGlyph({ tier }: { tier: LevelTier['key'] }) {
  return <svg className="level-tier-glyph" viewBox="0 0 100 100" aria-hidden="true"><path d={LEVEL_SHAPES[tier]} /></svg>;
}

/** Compact chip for author rows; the tier shape doubles as a glyph. */
export function LevelChipContent({ level }: { level: number }) {
  const { tier } = levelTier(level);
  return <>
    <svg className="level-chip-glyph" viewBox="0 0 100 100" aria-hidden="true"><path d={LEVEL_SHAPES[tier.key]} /></svg>
    Ур. {level}
  </>;
}
