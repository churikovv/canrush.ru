import { useId, type CSSProperties } from 'react';

/**
 * Frames of the look shop (`shop-items.ts`), bought with achievement points. Regular size (130% of the avatar, like
 * «Тыквенная»): the avatar is the circle of radius ≈38.5 in the middle of the 100×100 box, so everything sits from 41 out.
 * Coordinates are written out, not computed: trigonometry of Node and the browser differs in the last digits, and the
 * frame renders on the server too.
 */
export const SHOP_FRAMES = ['bubbles', 'aurora', 'hologram'] as const;
export type ShopFrame = typeof SHOP_FRAMES[number];
export const isShopFrame = (frame: string): frame is ShopFrame => (SHOP_FRAMES as readonly string[]).includes(frame);

const fx = (delay: number, extra: Record<string, string> = {}) => ({ '--fx-delay': `${delay}s`, ...extra }) as CSSProperties;

/**
 * Soda bubbles: they start at the bottom of the ring and float up its sides by turning round the centre (`--turn`), so
 * they never cross the face; left ones turn clockwise, right ones back.
 */
const BUBBLES = [
  { x: 36.3, y: 92.6, r: 3.2, delay: 0, turn: 95 }, { x: 25.6, y: 88.2, r: 2.2, delay: -1.2, turn: 80 }, { x: 44, y: 95, r: 2.6, delay: -2.4, turn: 112 },
  { x: 63.7, y: 92.6, r: 3, delay: -.6, turn: -95 }, { x: 74.4, y: 88.2, r: 2, delay: -1.8, turn: -80 }, { x: 56, y: 95, r: 2.7, delay: -3, turn: -112 },
];

function Bubbles() {
  return <>
    <circle cx="50" cy="50" r="42.5" stroke="currentColor" strokeWidth="1.8" />
    <circle className="frame-fx frame-shop-fizz" cx="50" cy="50" r="42.5" stroke="#e8fbff" strokeWidth=".7" strokeDasharray=".6 3.4" strokeLinecap="round" />
    {BUBBLES.map(bubble => <g key={`${bubble.x}-${bubble.y}`} className="frame-fx frame-bubble" style={fx(bubble.delay, { '--turn': `${bubble.turn}deg` })}>
      <circle cx={bubble.x} cy={bubble.y} r={bubble.r} fill="rgb(120 220 255 / .2)" stroke="currentColor" strokeWidth=".7" />
      <circle cx={bubble.x - bubble.r * .35} cy={bubble.y - bubble.r * .35} r={bubble.r * .3} fill="#fff" />
    </g>)}
  </>;
}

/** Northern lights: three ribbons of green, teal and violet light drifting round the ring at their own pace. */
function Aurora({ id }: { id: string }) {
  return <>
    <defs>
      <linearGradient id={`${id}a`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3dffa0" /><stop offset=".55" stopColor="#2de0c8" /><stop offset="1" stopColor="#9a6bff" /></linearGradient>
      <linearGradient id={`${id}b`} x1="1" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b47bff" /><stop offset="1" stopColor="#3dffa0" /></linearGradient>
    </defs>
    <circle cx="50" cy="50" r="43" stroke="#0e2a3a" strokeOpacity=".35" strokeWidth="3" />
    {/* The first ribbon twice: a wide faint copy under it is its glow. */}
    <g className="frame-fx frame-aurora frame-aurora-1">
      <circle cx="50" cy="50" r="43" pathLength="100" stroke={`url(#${id}a)`} strokeOpacity=".3" strokeWidth="8" strokeLinecap="round" strokeDasharray="38 62" />
      <circle cx="50" cy="50" r="43" pathLength="100" stroke={`url(#${id}a)`} strokeWidth="4.4" strokeLinecap="round" strokeDasharray="38 62" />
    </g>
    <g className="frame-fx frame-aurora frame-aurora-2"><circle cx="50" cy="50" r="46" pathLength="100" stroke={`url(#${id}b)`} strokeWidth="2.8" strokeLinecap="round" strokeDasharray="26 74" /></g>
    <g className="frame-fx frame-aurora frame-aurora-3"><circle cx="50" cy="50" r="40.6" pathLength="100" stroke="#b9ffe4" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="16 84" /></g>
    {[[15, 15, 0], [88, 22, -1.3], [84, 86, -2.4]].map(([x, y, delay]) => <circle key={`${x}-${y}`} className="frame-fx frame-aurora-star" cx={x} cy={y} r=".9" fill="#eafff6" style={fx(delay!)} />)}
  </>;
}

/** The hologram's scale outside its ring: a tick every 15°, every third one longer (precomputed, see above). */
const TICKS = [
  'M50 1.5 50 4.8', 'M62.6 3.2 62 5.4', 'M74.3 8 73.1 10', 'M84.3 15.7 82 18', 'M92 25.7 90 26.9', 'M96.8 37.4 94.6 38',
  'M98.5 50 95.2 50', 'M96.8 62.6 94.6 62', 'M92 74.2 90 73.1', 'M84.3 84.3 82 82', 'M74.3 92 73.1 90', 'M62.6 96.8 62 94.6',
  'M50 98.5 50 95.2', 'M37.4 96.8 38 94.6', 'M25.7 92 26.9 90', 'M15.7 84.3 18 82', 'M8 74.3 10 73.1', 'M3.2 62.6 5.4 62',
  'M1.5 50 4.8 50', 'M3.2 37.4 5.4 38', 'M8 25.7 10 26.9', 'M15.7 15.7 18 18', 'M25.7 8 26.9 10', 'M37.4 3.2 38 5.4',
];
/** The iridescent ring: six arcs of colour that close into one band and turn together. */
const HOLO_COLORS = ['#ff7af6', '#a66bff', '#36d6ff', '#4dffb0', '#fff27a', '#ff9f5a'];

/** Hologram: an iridescent ring, a scale around it, HUD brackets in the corners and a scanner beam going round. */
function Hologram() {
  return <>
    <g className="frame-fx frame-holo-ring">{HOLO_COLORS.map((color, index) => <circle key={color} cx="50" cy="50" r="42.4" pathLength="102" stroke={color} strokeWidth="2.8" strokeDasharray="17.4 84.6" strokeDashoffset={-index * 17} />)}</g>
    <g stroke="#bff6ff" strokeOpacity=".75" strokeLinecap="round">{TICKS.map((d, index) => <path key={d} d={d} strokeWidth={index % 3 ? .6 : 1.1} />)}</g>
    <g className="frame-fx frame-holo-brackets" stroke="#9ff3ff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 15V6h9" /><path d="M85 6h9v9" /><path d="M94 85v9h-9" /><path d="M15 94H6v-9" />
    </g>
    <g className="frame-fx frame-holo-scan"><circle cx="50" cy="50" r="42.4" pathLength="100" stroke="#ffffff" strokeWidth="3.2" strokeLinecap="round" strokeDasharray="5 95" /></g>
  </>;
}

export function ShopAvatarFrame({ frame }: { frame: ShopFrame }) {
  const id = `shop${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return <svg className={`avatar-frame avatar-frame-shop avatar-frame-${frame}`} viewBox="0 0 100 100" fill="none" aria-hidden="true" focusable="false">
    {frame === 'bubbles' ? <Bubbles /> : frame === 'aurora' ? <Aurora id={id} /> : <Hologram />}
  </svg>;
}
