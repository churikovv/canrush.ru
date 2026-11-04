import { useId } from 'react';
import { LEVEL_SHAPES } from '@/components/level-badge';
import { achievementIcon } from '@/lib/achievement-icons';
import { TIER_NUMERALS, type AchievementRarity } from '@/lib/profile-achievements';

/**
 * The achievement's emblem instead of a medal picture: a metal shape of its rarity (the same silhouettes as the level
 * ranks: hexagon, shield, ten- and sixteen-pointed stars, an octagon for special ones) with a dark recess and the
 * achievement's own line icon (`achievement-icons.ts`). Higher tiers add rings round it and a ribbon with the numeral.
 * Effects grow with rarity: a sheen from rare, twinkles from epic, turning rays for legendary. Only transform and
 * opacity move (`trophies.css`), and nothing moves for a locked one or under `prefers-reduced-motion`.
 */
const SHAPES: Record<AchievementRarity, string> = {
  common: LEVEL_SHAPES.rookie,
  rare: LEVEL_SHAPES.bronze,
  epic: LEVEL_SHAPES.gold,
  legendary: LEVEL_SHAPES.legend,
  special: 'M31 4h38l27 27v38L69 96H31L4 69V31Z',
};
const SPARKLE = 'M0-10Q1-1 10 0Q1 1 0 10Q-1 1-10 0Q-1-1 0-10Z';
const TWINKLES = [{ x: 90, y: 12, scale: .5, delay: 0 }, { x: 8, y: 84, scale: .36, delay: -1.3 }, { x: 96, y: 76, scale: .3, delay: -2.4 }];
const RAYS = Array.from({ length: 12 }, (_, index) => index * 30);
const inset = (scale: number) => `translate(50 50) scale(${scale}) translate(-50 -50)`;

export function AchievementEmblem({ achievementKey, rarity, tier = 1, tiers = 1, earned, className }: {
  achievementKey: string; rarity: AchievementRarity; tier?: number; tiers?: number; earned: boolean; className?: string;
}) {
  const id = `ach${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const shape = SHAPES[rarity];
  const icon = achievementIcon(achievementKey);
  const shown = earned ? tier : 0;
  const numeral = tiers > 1 && shown > 0 ? TIER_NUMERALS[shown - 1] : null;
  const ribbon = numeral ? 14 + numeral.length * 7 : 0;
  return <svg className={className ? `ach-emblem ${className}` : 'ach-emblem'} data-rarity={rarity} data-tier={shown || undefined} data-earned={earned || undefined}
    viewBox="-12 -12 124 124" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}m`} x1=".15" y1="0" x2=".85" y2="1"><stop offset="0" className="rarity-stop-light" /><stop offset=".45" className="rarity-stop-mid" /><stop offset="1" className="rarity-stop-dark" /></linearGradient>
      <radialGradient id={`${id}i`} cx=".5" cy=".38" r=".7"><stop offset="0" className="ach-inner-light" /><stop offset="1" className="ach-inner-dark" /></radialGradient>
      <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".75" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
      <clipPath id={`${id}c`}><path d={shape} /></clipPath>
    </defs>
    {earned && rarity === 'legendary' && <g className="ach-rays">{RAYS.map(angle => <path key={angle} d="M50 50 46 -8h8Z" transform={`rotate(${angle} 50 50)`} />)}</g>}
    {shown >= 2 && <circle className="ach-orbit" cx="50" cy="50" r="57" pathLength="100" />}
    {shown >= 3 && <circle className="ach-orbit ach-orbit-outer" cx="50" cy="50" r="61.5" pathLength="100" />}
    <path d={shape} className="ach-glow" />
    <path d={shape} className="ach-body" fill={`url(#${id}m)`} />
    <path d={shape} transform={inset(.8)} className="ach-inner" fill={`url(#${id}i)`} />
    <path d={shape} transform={inset(.8)} className="ach-bevel" fill="none" />
    {earned && rarity !== 'common' && <g clipPath={`url(#${id}c)`}><g transform="rotate(20 50 50)"><rect className="ach-sheen" x="-40" y="-30" width="26" height="160" fill={`url(#${id}s)`} /></g></g>}
    {'d' in icon
      ? <path className="ach-icon" d={icon.d} transform="translate(27 25) scale(1.92)" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      : <text className="ach-icon-text" x="50" y="51" textAnchor="middle" dominantBaseline="central" fontSize={icon.text.length > 2 ? 22 : 30}>{icon.text}</text>}
    {numeral && <g className="ach-tier">
      <rect x={50 - ribbon / 2} y="83" width={ribbon} height="17" rx="8.5" />
      <text x="50" y="92" textAnchor="middle" dominantBaseline="central">{numeral}</text>
    </g>}
    {earned && (rarity === 'epic' || rarity === 'legendary' || shown >= 3) && TWINKLES.map(item => <g key={item.x} transform={`translate(${item.x} ${item.y}) scale(${item.scale})`}>
      <path className="ach-twinkle" d={SPARKLE} style={{ animationDelay: `${item.delay}s` }} />
    </g>)}
  </svg>;
}
