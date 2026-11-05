import { useId, type CSSProperties } from 'react';

/**
 * Frames of «Лунный цикл», the daily rewards (`daily-reward-fields.ts`). Regular size (130% of the avatar, whose circle
 * has radius ≈38.5 in the 100×100 box). No trigonometry: coordinates are written out or built from sums and products,
 * which Node and the browser compute alike (frames render on the server too). Pale silver and lavender, no gold.
 */
export const MOON_FRAMES = ['crescent', 'moon-cycle'] as const;
export type MoonFrame = typeof MOON_FRAMES[number];
export const isMoonFrame = (frame: string): frame is MoonFrame => (MOON_FRAMES as readonly string[]).includes(frame);

const fx = (delay: number) => ({ '--fx-delay': `${delay}s` }) as CSSProperties;
const round = (value: number) => Math.round(value * 100) / 100;
/** A four-point star at (x, y). */
const star = (x: number, y: number, size: number) => {
  const a = round(size), b = round(size * .28);
  return `M${x} ${round(y - a)} ${round(x + b)} ${round(y - b)} ${round(x + a)} ${y} ${round(x + b)} ${round(y + b)} ${x} ${round(y + a)} ${round(x - b)} ${round(y + b)} ${round(x - a)} ${y} ${round(x - b)} ${round(y - b)}Z`;
};

/** Полумесяц: a silver crescent hugging the avatar from the left, rocking slowly, three stars winking on the right. */
function Crescent({ id }: { id: string }) {
  return <>
    <defs>
      <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f4f6ff" /><stop offset=".5" stopColor="#c3cbfa" /><stop offset="1" stopColor="#7f8ce8" /></linearGradient>
      <mask id={`${id}m`} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
        <circle cx="50" cy="50" r="47" fill="#fff" /><circle cx="56" cy="46.5" r="44.2" fill="#000" />
      </mask>
    </defs>
    <circle cx="50" cy="50" r="42.6" stroke="#8a93e6" strokeOpacity=".6" strokeWidth=".8" />
    <g className="frame-fx frame-moon-rock"><circle cx="50" cy="50" r="47" fill={`url(#${id}g)`} mask={`url(#${id}m)`} /></g>
    <g fill="#eef2ff">
      {[[84, 15, 3.4, 0], [94, 41, 2.4, -1.3], [87, 81, 2.8, -2.4]].map(([x, y, size, delay]) =>
        <path key={`${x}-${y}`} className="frame-fx frame-moon-star" d={star(x!, y!, size!)} style={fx(delay!)} />)}
    </g>
  </>;
}

/** One phase as a lit shape over a dark disc: the terminator is a half-ellipse, `lit` 0 (new) to 1 (full). */
function Phase({ cx, cy, r, lit, waxing }: { cx: number; cy: number; r: number; lit: number; waxing: boolean }) {
  const top = `${cx} ${round(cy - r)}`, bottom = `${cx} ${round(cy + r)}`;
  const rx = round(r * Math.abs(2 * lit - 1));
  // Waxing is lit on the right: the outer arc goes top→right→bottom; waning mirrors it.
  const outer = waxing ? 1 : 0;
  const back = lit < .5 ? (waxing ? 0 : 1) : (waxing ? 1 : 0);
  return <>
    <circle cx={cx} cy={cy} r={r} fill="#141a3a" stroke="#6f79d6" strokeWidth=".7" />
    {lit >= 1 ? <circle cx={cx} cy={cy} r={r} fill="#eef2ff" />
      : lit > 0 && <path d={`M${top}A${r} ${r} 0 0 ${outer} ${bottom}A${rx} ${r} 0 0 ${back} ${top}Z`} fill="#eef2ff" />}
  </>;
}

/** The eight phases round the ring, clockwise from the full moon on top (waning on the right, waxing on the left). */
const PHASES = [
  { cx: 50, cy: 5, lit: 1, waxing: true }, { cx: 81.8, cy: 18.2, lit: .75, waxing: false }, { cx: 95, cy: 50, lit: .5, waxing: false },
  { cx: 81.8, cy: 81.8, lit: .25, waxing: false }, { cx: 50, cy: 95, lit: 0, waxing: true }, { cx: 18.2, cy: 81.8, lit: .25, waxing: true },
  { cx: 5, cy: 50, lit: .5, waxing: true }, { cx: 18.2, cy: 18.2, lit: .75, waxing: true },
];

/** Лунный цикл: a thin silver ring with the eight phases on it; light walks round them, the full moon glows on top. */
function MoonCycle() {
  return <>
    <circle cx="50" cy="50" r="45" stroke="#8a93e6" strokeOpacity=".8" strokeWidth="1" strokeDasharray="1.4 2.6" />
    <circle className="frame-fx frame-moon-halo" cx="50" cy="5" r="8.5" fill="#dfe6ff" opacity=".35" />
    {PHASES.map((phase, index) => <g key={index} className="frame-fx frame-moon-phase" style={fx(index * .45)}>
      <Phase {...phase} r={index ? 4.3 : 5.6} />
    </g>)}
  </>;
}

export function MoonAvatarFrame({ frame }: { frame: MoonFrame }) {
  const id = `moon${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return <svg className={`avatar-frame avatar-frame-moon avatar-frame-${frame}`} viewBox="0 0 100 100" fill="none" aria-hidden="true" focusable="false">
    {frame === 'crescent' ? <Crescent id={id} /> : <MoonCycle />}
  </svg>;
}
