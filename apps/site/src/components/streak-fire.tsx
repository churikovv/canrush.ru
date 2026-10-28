'use client';
import { useEffect, useId, useState, type CSSProperties } from 'react';
import { flameTier } from '@/lib/drink-calendar-fields';

const SEEN_KEY = 'canrush-streak-seen';
/** Sparks of the burst: fixed angles and reaches, so the server and the browser draw the same thing. */
const BURST = Array.from({ length: 14 }, (_, index) => {
  const angle = (index / 14) * Math.PI * 2 - Math.PI / 2;
  const reach = 46 + (index % 3) * 14;
  return { x: Math.round(Math.cos(angle) * reach), y: Math.round(Math.sin(angle) * reach * 0.9), size: 4 + (index % 4) * 1.5, delay: (index % 5) * 18 };
});
const EMBERS = [{ x: -10, d: 0 }, { x: 8, d: 420 }, { x: -2, d: 900 }, { x: 13, d: 1300 }, { x: -14, d: 1700 }, { x: 4, d: 2100 }];

/**
 * The big streak fire of the calendar: a flame of three layers that sway at their own pace (outer tongue, middle,
 * white-hot core), two side tongues that tear off and rise, embers floating up and a pulsing glow — all CSS transforms
 * and opacity, so it stays smooth on phones; colours by the streak's tier (`data-flame`), like `StreakFlame`. The
 * number sits in a chip at the foot. When the streak has grown since this browser last saw it (or grows on the page
 * after a can is logged), the fire bursts once: a shock ring and sparks thrown out. Reduced motion: still flame, no
 * burst.
 */
export function StreakFire({ length, state }: { length: number; state: 'alive' | 'waiting' | 'out' }) {
  const id = useId().replace(/:/g, '');
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    // The streak is written as seen only when the timer runs: a cancelled effect (React re-running it) keeps the old
    // value, so the second run still sees the growth. A timer, not a frame: frames wait while the tab is hidden.
    const remember = () => { try { localStorage.setItem(SEEN_KEY, String(length)); } catch { /* storage off: no burst memory */ } };
    let seen = NaN;
    try { seen = Number(localStorage.getItem(SEEN_KEY) ?? 'NaN'); } catch { /* storage off */ }
    const grew = Number.isFinite(seen) && length > seen && length > 0 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => { remember(); if (grew) setBurst(value => value + 1); }, 0);
    return () => window.clearTimeout(timer);
  }, [length]);
  const tier = flameTier(Math.max(length, 1));
  return <span className="streak-fire" data-flame={tier} data-state={state} aria-hidden="true">
    <span className="streak-fire-glow" />
    <svg className="streak-fire-svg" viewBox="0 0 64 80" width="76" height="95">
      <defs>
        <linearGradient id={`${id}-o`} x1="0" y1="1" x2="0" y2="0"><stop offset="0" className="streak-flame-stop-base" /><stop offset=".55" className="streak-flame-stop-mid" /><stop offset="1" className="streak-flame-stop-tip" /></linearGradient>
        <linearGradient id={`${id}-m`} x1="0" y1="1" x2="0" y2="0"><stop offset="0" className="streak-flame-stop-mid" /><stop offset="1" className="streak-flame-stop-tip" /></linearGradient>
        <linearGradient id={`${id}-c`} x1="0" y1="1" x2="0" y2="0"><stop offset="0" className="streak-flame-stop-core" /><stop offset="1" className="streak-flame-stop-core-tip" /></linearGradient>
      </defs>
      <path className="fire-tongue fire-tongue-left" fill={`url(#${id}-o)`} d="M16 44c-5-6-5-13-2-19 1 6 4 9 8 11-3 2-5 5-6 8Z" />
      <path className="fire-tongue fire-tongue-right" fill={`url(#${id}-o)`} d="M48 42c4-5 5-12 3-18-2 5-5 8-9 10 3 2 5 5 6 8Z" />
      <path className="fire-outer" fill={`url(#${id}-o)`} d="M33 2c3 12 18 20 18 42 0 18-9 32-19 32S13 62 13 45c0-11 6-18 10-22 0 8 4 12 8 13-3-11-1-23 2-34Z" />
      <path className="fire-mid" fill={`url(#${id}-m)`} d="M32 22c2 9 12 15 12 29 0 12-6 21-12 21s-12-9-12-20c0-7 4-12 7-15 0 5 2 8 5 9-2-8-1-16 0-24Z" />
      <path className="fire-core" fill={`url(#${id}-c)`} d="M32 42c1 5 7 9 7 17 0 7-3 12-7 12s-7-5-7-11c0-5 3-8 4-10 0 3 1 5 3 5-1-5-1-9 0-13Z" />
    </svg>
    <span className="streak-fire-embers">{EMBERS.map((ember, index) => <i key={index} style={{ '--x': `${ember.x}px`, animationDelay: `${ember.d}ms` } as CSSProperties} />)}</span>
    {burst > 0 && <span key={burst} className="streak-fire-burst">
      <b className="streak-fire-ring" />
      {BURST.map((spark, index) => <i key={index} style={{ '--x': `${spark.x}px`, '--y': `${spark.y}px`, '--s': `${spark.size}px`, animationDelay: `${spark.delay}ms` } as CSSProperties} />)}
    </span>}
    <span className="streak-fire-count">{length}</span>
  </span>;
}
