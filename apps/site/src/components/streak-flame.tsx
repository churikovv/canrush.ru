import { useId } from 'react';
import { flameTier } from '@/lib/drink-calendar-fields';

/**
 * The streak flame, like TikTok's: an outer tongue and a bright core that flicker, coloured by the streak's length —
 * orange, pink from 30 days, purple from 100, the brand blue from 200 (`flameTier`). `waiting` — today's can is not
 * logged yet: the flame dims and breathes; `out` — the streak is gone, grey. Gradient stops read CSS variables set by
 * `data-flame` (profile.css), so a theme or a tier change needs no new SVG. Decorative: the number beside it speaks.
 */
export function StreakFlame({ length, size = 18, state = 'alive' }: { length: number; size?: number; state?: 'alive' | 'waiting' | 'out' }) {
  const id = useId().replace(/:/g, '');
  return <svg className="streak-flame" data-flame={flameTier(length)} data-state={state} width={size} height={Math.round(size * 1.18)} viewBox="0 0 22 26" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-outer`} x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" className="streak-flame-stop-base" /><stop offset=".6" className="streak-flame-stop-mid" /><stop offset="1" className="streak-flame-stop-tip" />
      </linearGradient>
      <linearGradient id={`${id}-core`} x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" className="streak-flame-stop-core" /><stop offset="1" className="streak-flame-stop-core-tip" />
      </linearGradient>
    </defs>
    <path className="streak-flame-outer" fill={`url(#${id}-outer)`} d="M11.6 1c.5 3.4-.8 5.6-2.5 7.6C7.3 10.6 4.6 12.8 4.6 16.6A6.6 6.6 0 0 0 11 25a6.7 6.7 0 0 0 6.9-6.8c0-2.2-.8-4-2-5.4.1 1.9-.6 3.2-1.8 3.9.7-4.6-.6-11.6-2.5-15.7Z" />
    <path className="streak-flame-core" fill={`url(#${id}-core)`} d="M11.3 12.4c.3 1.8-.4 3-1.3 4-.9 1-1.8 1.9-1.8 3.5a3 3 0 0 0 3 3 3.1 3.1 0 0 0 3.1-3.1c0-1-.3-1.8-.9-2.4 0 .8-.3 1.4-.8 1.7.2-2.3-.4-5-1.3-6.7Z" />
  </svg>;
}
