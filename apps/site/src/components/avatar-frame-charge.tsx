import type { CSSProperties } from 'react';

/**
 * «Заряд» — the newcomer's frame from «Первые шаги» (`first-steps.ts`), regular size like the shop's (130% of the
 * avatar, whose circle has radius ≈38.5 in the 100×100 box). A ring of twelve cells charges up clockwise from the top,
 * the bolt in its badge flashes, sparks fly off the diagonals, then the charge drains and it starts again. Coordinates
 * are written out, not computed: trigonometry of Node and the browser differs in the last digits.
 */
const CELLS = ['#46e6ff', '#3fd6ff', '#38c4ff', '#32b2ff', '#2ca0ff', '#2a8cff', '#2f7bff', '#3a6cff', '#4a5eff', '#5c53ff', '#6f4bff', '#8446ff'];
/** Four-point sparks on the diagonals just outside the ring (radius 47 at 45°). */
const SPARKS = [
  'M83.2 13.6 83.8 16.2 86.4 16.8 83.8 17.4 83.2 20 82.6 17.4 80 16.8 82.6 16.2Z',
  'M83.2 80 83.8 82.6 86.4 83.2 83.8 83.8 83.2 86.4 82.6 83.8 80 83.2 82.6 82.6Z',
  'M16.8 80 17.4 82.6 20 83.2 17.4 83.8 16.8 86.4 16.2 83.8 13.6 83.2 16.2 82.6Z',
  'M16.8 13.6 17.4 16.2 20 16.8 17.4 17.4 16.8 20 16.2 17.4 13.6 16.8 16.2 16.2Z',
];

export function ChargeAvatarFrame() {
  return <svg className="avatar-frame avatar-frame-charge" viewBox="0 0 100 100" fill="none" aria-hidden="true" focusable="false">
    <circle cx="50" cy="50" r="43" stroke="#0b3a8f" strokeOpacity=".3" strokeWidth="4.6" />
    {/* The cells start at the top: a circle's dash starts at three o'clock, so the group turns a quarter back. */}
    <g transform="rotate(-90 50 50)">
      {CELLS.map((color, index) => <circle key={color} className="frame-fx frame-charge-cell" cx="50" cy="50" r="43" pathLength="120"
        stroke={color} strokeWidth="4.6" strokeDasharray="8 112" strokeDashoffset={-(index * 10 + 1)} style={{ '--fx-delay': `${index * .12}s` } as CSSProperties} />)}
    </g>
    <circle className="frame-fx frame-charge-flash" cx="50" cy="50" r="43" stroke="#ffffff" strokeWidth="2.2" />
    <g className="frame-fx frame-charge-spark" fill="#e9fbff">{SPARKS.map(d => <path key={d} d={d} />)}</g>
    <g className="frame-fx frame-charge-badge">
      <circle cx="50" cy="6" r="6.4" fill="#0b47d1" stroke="#ffffff" strokeWidth="1.1" />
      <path d="M51.3 1.8 46.9 7.2H49.9L48.9 10.8 53.3 5.2H50.3Z" fill="#ffffff" />
    </g>
  </svg>;
}
