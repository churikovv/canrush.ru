import { useId } from 'react';
import { levelTier, type LevelTier } from '@/lib/level-tier';

function star(points: number, outer: number, inner: number) {
  return Array.from({ length: points * 2 }, (_, index) => {
    const radius = index % 2 ? inner : outer;
    const angle = (Math.PI * index) / points - Math.PI / 2;
    return `${index ? 'L' : 'M'}${(50 + radius * Math.cos(angle)).toFixed(2)} ${(50 + radius * Math.sin(angle)).toFixed(2)}`;
  }).join('') + 'Z';
}

const SHAPES: Record<LevelTier['key'], string> = {
  rookie: 'M50 9a41 41 0 1 1 0 82a41 41 0 1 1 0-82Z',
  bronze: 'M50 6 87 19v29c0 23-15 39-37 47C28 87 13 71 13 48V19Z',
  silver: 'M50 5 89 27.5v45L50 95 11 72.5v-45Z',
  gold: star(12, 47, 40),
  platinum: 'M50 4 92 50 50 96 8 50Z',
  legend: star(16, 49, 39),
};
const FACETS: Partial<Record<LevelTier['key'], string>> = { platinum: 'M8 50h84M50 4 33 50l17 46M50 4l17 46-17 46' };
const SPARKLE = 'M0-10Q1-1 10 0Q1 1 0 10Q-1 1-10 0Q-1-1 0-10Z';
const TWINKLES = [{ x: 86, y: 14, scale: .55, delay: 0 }, { x: 12, y: 82, scale: .38, delay: -1.4 }, { x: 93, y: 74, scale: .3, delay: -2.6 }];

/** Large emblem: the shape, material and motion grow with the level tier. */
export function LevelEmblem({ level }: { level: number }) {
  const id = useId().replace(/:/g, '');
  const { tier } = levelTier(level);
  const shape = SHAPES[tier.key];
  const rich = tier.key === 'gold' || tier.key === 'platinum' || tier.key === 'legend';
  return <svg className="level-emblem" data-level-tier={tier.key} viewBox="0 0 100 100" role="img" aria-label={`Уровень ${level}, ранг «${tier.label}»`}>
    <defs>
      <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" className="level-stop-light" /><stop offset=".55" className="level-stop-mid" /><stop offset="1" className="level-stop-dark" />
      </linearGradient>
      <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".7" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <clipPath id={`${id}-clip`}><path d={shape} /></clipPath>
    </defs>
    {tier.key === 'legend' && <g className="level-aura" fill="none" stroke={`url(#${id}-fill)`}>
      <circle cx="50" cy="50" r="49" strokeWidth="2.5" strokeDasharray="16 9" />
      <circle className="level-aura-reverse" cx="50" cy="50" r="53" strokeWidth="1.2" strokeDasharray="3 12" />
    </g>}
    <path d={shape} fill={`url(#${id}-fill)`} className="level-emblem-body" />
    {FACETS[tier.key] && <path d={FACETS[tier.key]} className="level-emblem-facets" fill="none" />}
    <path d={shape} transform="translate(50 50) scale(.84) translate(-50 -50)" className="level-emblem-bevel" fill="none" />
    {tier.key !== 'rookie' && <g clipPath={`url(#${id}-clip)`}><g transform="rotate(20 50 50)"><rect className="level-emblem-sheen" x="-40" y="-30" width="28" height="160" fill={`url(#${id}-sheen)`} /></g></g>}
    <text x="50" y="52" className="level-emblem-number" textAnchor="middle" dominantBaseline="central" fontSize={level >= 100 ? 30 : 38}>{level}</text>
    {rich && TWINKLES.map(item => <g key={item.x} transform={`translate(${item.x} ${item.y}) scale(${item.scale})`}>
      <path className="level-twinkle" d={SPARKLE} style={{ animationDelay: `${item.delay}s` }} />
    </g>)}
  </svg>;
}

export function LevelChip({ level }: { level: number }) {
  const { tier } = levelTier(level);
  return <span className="profile-level" data-level-tier={tier.key} title={tier.label}><LevelChipContent level={level} /></span>;
}

/** Compact chip for author rows; the tier shape doubles as a glyph. */
export function LevelChipContent({ level }: { level: number }) {
  const { tier } = levelTier(level);
  return <>
    <svg className="level-chip-glyph" viewBox="0 0 100 100" aria-hidden="true"><path d={SHAPES[tier.key]} /></svg>
    Ур. {level}
  </>;
}
