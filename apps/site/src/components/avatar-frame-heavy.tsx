import { useId, type CSSProperties, type ReactNode } from 'react';

/**
 * Heavy frames are drawn in a box 30% larger than the avatar on every side. The view box
 * keeps the avatar at (0,0)–(100,100), so its edge is the circle r=50 around (50,50).
 */
export const HEAVY_FRAMES = ['frost', 'blaze', 'liquid', 'can', 'legend'] as const;
export type HeavyFrame = typeof HEAVY_FRAMES[number];
export const isHeavyFrame = (frame: string): frame is HeavyFrame => (HEAVY_FRAMES as readonly string[]).includes(frame);

const VIEW = '-30 -30 160 160';
const STAR = 'M0-10Q1-1 10 0Q1 1 0 10Q-1 1-10 0Q-1-1 0-10Z';
const round = (value: number) => Math.round(value * 100) / 100;
/** Point on a circle around the avatar centre; 0° is the top, angles grow clockwise. */
function polar(radius: number, degrees: number): [number, number] {
  const radians = (degrees * Math.PI) / 180;
  return [round(50 + radius * Math.sin(radians)), round(50 - radius * Math.cos(radians))];
}
const points = (list: [number, number][]) => list.map(point => point.join(' ')).join(' ');
const fx = (delay: number, extra: Record<string, string> = {}) => ({ '--fx-delay': `${delay}s`, ...extra }) as CSSProperties;

/** Hexagonal crystal pointing away from the avatar; the second polygon is its lit facet. */
function crystal(base: number, angle: number, length: number, width: number) {
  const spread = (width / base) * 57.3;
  const shoulder = base + length * .38;
  const left = polar(base, angle - spread), right = polar(base, angle + spread);
  const shoulderLeft = polar(shoulder, angle - spread * 1.15), shoulderRight = polar(shoulder, angle + spread * 1.15);
  const tip = polar(base + length, angle);
  return { body: points([left, shoulderLeft, tip, shoulderRight, right]), facet: points([left, shoulderLeft, tip, polar(base, angle)]), tip };
}

function Glint({ x, y, scale, delay }: { x: number; y: number; scale: number; delay: number }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <g className="frame-fx frame-spark" style={fx(delay)}>
      <path d={STAR} fill="currentColor" />
      <path className="frame-core" d={STAR} transform="scale(.4)" />
    </g>
  </g>;
}

// Frost: an icy rim with crystal clusters at the top right and bottom left.
/** Deterministic 0–1 noise so frames render identically on the server and the client. */
const noise = (seed: number) => (Math.imul(Math.round(seed * 7919) ^ 0x5bd1e995, 0x27d4eb2d) >>> 0) / 4294967296;
const FROST_SHARDS: [number, number, number][] = [
  [8, 10, 3], [20, 17, 4], [33, 30, 5.6], [45, 21, 4.4], [57, 12, 3.2], [72, 8, 2.6], [100, 9, 2.8], [124, 7, 2.4], [150, 11, 3],
  [172, 15, 3.6], [190, 22, 4.4], [204, 34, 6], [218, 26, 5], [232, 17, 4], [248, 11, 3], [272, 8, 2.6], [300, 10, 2.8], [326, 13, 3.2], [346, 16, 3.6],
];
// A jagged frost band: the outer edge is noisy, the inner edge hugs the portrait (even-odd cut-out).
const FROST_CRUST = `M${Array.from({ length: 72 }, (_, index) => polar(index % 2 ? 53.4 : 55.4 + noise(index) * 2.6, index * 5).join(' ')).join('L')}ZM50 0.5A49.5 49.5 0 1 0 50 99.5A49.5 49.5 0 1 0 50 0.5Z`;
function Snowflake({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) {
  const [s, w, h, k] = [size, round(size * .3), round(size * .7), round(size * .45)];
  const arms = [0, 60, 120].map(angle => <path key={angle} transform={`rotate(${angle})`} d={`M0 ${-s}V${s}M${-w} ${-h}L0 ${-k} ${w} ${-h}M${-w} ${h}L0 ${k} ${w} ${h}`} />);
  return <g transform={`translate(${x} ${y})`}><g className="frame-fx frame-turn" style={fx(delay)} strokeLinecap="round">
    <g stroke="#2f86c2" strokeWidth="1.5">{arms}</g><g stroke="#f4fbff" strokeWidth=".6">{arms}</g>
  </g></g>;
}
function Frost({ id }: { id: string }) {
  return <>
    <defs>
      <linearGradient id={`${id}-ice`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f5fcff" /><stop offset=".5" stopColor="#8fd0f3" /><stop offset="1" stopColor="#2a7fbf" /></linearGradient>
      <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset=".35" stopColor="#b5e3fa" /><stop offset=".7" stopColor="#4fa9de" /><stop offset="1" stopColor="#dff4ff" /></linearGradient>
    </defs>
    {FROST_SHARDS.map(([angle, length, width]) => {
      const shard = crystal(52, angle, length, width);
      return <g key={angle}><polygon points={shard.body} fill={`url(#${id}-ice)`} stroke="#2f86c2" strokeWidth=".55" strokeLinejoin="round" /><polygon points={shard.facet} fill="#fff" opacity=".5" /></g>;
    })}
    <path d={FROST_CRUST} fillRule="evenodd" fill="#e3f5ff" stroke="#5aaee0" strokeWidth=".5" strokeLinejoin="round" />
    <circle cx="50" cy="50" r="52.6" stroke={`url(#${id}-rim)`} strokeWidth="5.2" />
    <circle cx="50" cy="50" r="50.4" stroke="#2f86c2" strokeWidth=".7" />
    <circle cx="50" cy="50" r="51.2" stroke="#fff" strokeOpacity=".9" strokeWidth=".6" />
    <Snowflake x={106} y={6} size={4.6} delay={0} />
    <Snowflake x={-8} y={100} size={3.8} delay={-4} />
    <Snowflake x={96} y={104} size={2.6} delay={-9} />
    {[[...crystal(52, 204, 34, 6).tip, .55, 0], [...crystal(52, 33, 30, 5.6).tip, .5, -1.6], [...crystal(52, 346, 16, 3.6).tip, .32, -3.1], [...crystal(52, 172, 15, 3.6).tip, .3, -4.2]].map(([x, y, scale, delay]) => <Glint key={`${x}`} x={x!} y={y!} scale={scale!} delay={delay!} />)}
  </>;
}

// Blaze: living fire. Every spot on the ring emits licks on overlapping cycles: a lick is born at the base,
// stretches, drifts up, breaks off and fades, so the silhouette keeps changing. A low bed of flame and a
// smouldering band keep the ring alight between licks; licks are tallest at the bottom.
type Lick = { angle: number; base: number; height: number; width: number; rise: number; sway: number; duration: number; delay: number };
function licks(count: number, offset: number, base: number, scale: number, seed: number, phases = 3): Lick[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = index * (360 / count) + offset + (noise(index + seed) - .5) * 7;
    const radians = (angle * Math.PI) / 180, bottom = (1 - Math.cos(radians)) / 2;
    const duration = 1 + noise(index + seed + 200) * .7;
    return Array.from({ length: phases }, (_, phase) => {
      const size = .75 + noise(index * 3 + phase + seed + 40) * .5;
      return {
        angle: round(angle + (phase - 1) * 2.2), base,
        height: round((9 + bottom ** 1.5 * 22) * size * scale), width: round((4.6 + bottom * 2.8) * size * scale),
        rise: round((5 + bottom * 13) * scale), sway: round(-Math.sin(radians) * (2 + bottom * 4) * scale + (noise(index + phase + seed + 80) - .5) * 3),
        duration: round(duration), delay: -round(duration * (phase / phases) + noise(index + seed + 120) * .4),
      };
    });
  }).flat();
}
// Every coordinate is rounded: server and browser trigonometry differ in the last digits, which breaks hydration.
const lickPath = (h: number, w: number) => `M${round(-w)} 0C${round(-w)} ${round(-h * .45)} ${round(-w * .35)} ${round(-h * .7)} 0 ${round(-h)}C${round(w * .35)} ${round(-h * .7)} ${round(w)} ${round(-h * .45)} ${round(w)} 0Z`;
const BED = Array.from({ length: 36 }, (_, index) => {
  const angle = index * 10, bottom = (1 - Math.cos((angle * Math.PI) / 180)) / 2;
  return { angle, height: round(5 + bottom * 6 + noise(index + 700) * 2), width: round(4.2 + bottom * 1.5), delay: -round(noise(index + 740) * 1.2) };
});
const BACK_LICKS = licks(24, 0, 50.6, 1, 1);
const FRONT_LICKS = licks(30, 6, 51, .45, 13, 2).filter(item => item.angle > 105 && item.angle < 255);
function LickFlame({ item, id }: { item: Lick; id: string }) {
  return <g transform={`rotate(${item.angle} 50 50) translate(50 ${round(50 - item.base)})`}>
    <g className="frame-fx frame-lick" style={{ ...fx(item.delay, { '--rise': `${item.rise}px`, '--sway': `${item.sway}px` }), animationDuration: `${item.duration}s` }}>
      <path d={lickPath(item.height, item.width)} fill={`url(#${id}-fire)`} />
      <path d={lickPath(item.height * .55, item.width * .5)} transform={`translate(0 ${round(-item.height * .04)})`} fill="#ffd36b" />
    </g>
  </g>;
}
function FireDefs({ id }: { id: string }) {
  return <defs>
    <linearGradient id={`${id}-fire`} x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#ff5a0a" /><stop offset=".45" stopColor="#ff7f1a" /><stop offset=".8" stopColor="#f2400b" /><stop offset="1" stopColor="#b3200a" stopOpacity=".85" /></linearGradient>
    <radialGradient id={`${id}-heat`} cx="50" cy="50" r="70" gradientUnits="userSpaceOnUse"><stop offset=".7" stopColor="#ff6a1a" stopOpacity="0" /><stop offset=".78" stopColor="#ff6a1a" stopOpacity=".45" /><stop offset="1" stopColor="#ff6a1a" stopOpacity="0" /></radialGradient>
  </defs>;
}
function BlazeBack({ id }: { id: string }) {
  return <>
    <FireDefs id={id} />
    <circle cx="50" cy="50" r="70" fill={`url(#${id}-heat)`} />
    {BACK_LICKS.map(item => <LickFlame key={`${item.angle}-${item.delay}`} item={item} id={id} />)}
    {BED.map(item => <g key={item.angle} transform={`rotate(${item.angle} 50 50) translate(50 -1)`}>
      <g className="frame-fx frame-flame" style={fx(item.delay)}><path d={lickPath(item.height, item.width)} fill="#ff6a12" /><path d={lickPath(item.height * .5, item.width * .5)} fill="#ffd36b" /></g>
    </g>)}
  </>;
}
const BLAZE_EMBERS = Array.from({ length: 12 }, (_, index) => {
  const angle = 100 + index * 14 + (noise(index + 300) - .5) * 10;
  const [x, y] = polar(60 + noise(index + 340) * 22, angle);
  return { x, y, r: round(.6 + noise(index + 380) * .9), dx: round(Math.sin((angle * Math.PI) / 180) * 3), delay: -round(noise(index + 420) * 3.2) };
});
function Blaze({ id }: { id: string }) {
  return <>
    <FireDefs id={id} />
    <circle cx="50" cy="50" r="51.6" stroke="#8f1503" strokeWidth="3.6" />
    <circle className="frame-fx frame-ember-band" cx="50" cy="50" r="51.6" stroke="#ff8a1e" strokeWidth="2" strokeDasharray="7 3 12 4 5 3" />
    <circle cx="50" cy="50" r="50.2" stroke="#ffe3a0" strokeWidth=".7" />
    {FRONT_LICKS.map(item => <LickFlame key={`${item.angle}-${item.delay}`} item={item} id={id} />)}
    {BLAZE_EMBERS.map(ember => <circle key={`${ember.x}-${ember.y}`} className="frame-fx frame-rise" cx={ember.x} cy={ember.y} r={ember.r} fill="#ffd27a" style={fx(ember.delay, { '--dx': `${ember.dx}px` })} />)}
  </>;
}

// Liquid: a thick glass ring half-filled with energy drink that sloshes and fizzes, with splashes
// jumping over the rim and a drop falling from the bottom.
const SURFACE = 40;
/** A long seamless wave; sliding it by one period (40 units) loops without a seam. */
const wave = (amplitude: number) => `M-80 ${SURFACE}${Array.from({ length: 8 }, () => `q10 ${-amplitude} 20 0t20 0`).join('')}`;
const TUBE = 'M50 -13A63 63 0 1 1 50 113A63 63 0 1 1 50 -13ZM50 0A50 50 0 1 0 50 100A50 50 0 1 0 50 0Z';
const BUBBLES = Array.from({ length: 18 }, (_, index) => {
  const angle = 96 + index * 9.4 + (noise(index + 500) - .5) * 6;
  const [x, y] = polar(56.5 + (noise(index + 540) - .5) * 9, angle);
  return { x, y, r: round(.6 + noise(index + 580) * 1.1), delay: -round(noise(index + 620) * 2.6) };
});
/** Tapered jet from (0,0) towards `angle` (screen degrees, 0 = right) ending in a droplet. */
function jet(angle: number, length: number, width: number) {
  const radians = (angle * Math.PI) / 180, [dx, dy] = [Math.cos(radians), Math.sin(radians)], [nx, ny] = [-dy, dx];
  const at = (along: number, side: number) => `${round(dx * along + nx * side)} ${round(dy * along + ny * side)}`;
  return { d: `M${at(0, -width)}Q${at(length * .55, -width * .45)} ${at(length * .9, 0)}Q${at(length * .55, width * .45)} ${at(0, width)}Z`, drop: [round(dx * (length + 2.4)), round(dy * (length + 2.4))] as const };
}
const SPLASHES = [
  { x: 108, y: 38, jets: [[-104, 13, 2.4], [-78, 19, 2.8], [-52, 16, 2.6], [-26, 11, 2.2], [-6, 7, 1.8]] },
  { x: -8, y: 38, jets: [[-174, 7, 1.8], [-150, 11, 2.2], [-122, 14, 2.4], [-96, 9, 2]] },
] as const;
function Liquid({ id }: { id: string }) {
  const drink = `url(#${id}-drink)`;
  return <>
    <defs>
      <clipPath id={`${id}-tube`}><path d={TUBE} clipRule="evenodd" /></clipPath>
      <linearGradient id={`${id}-drink`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5fd4ff" /><stop offset=".35" stopColor="#1f8bff" /><stop offset="1" stopColor="#0a3fb3" /></linearGradient>
      <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff" stopOpacity=".95" /><stop offset=".5" stopColor="#cfe3f7" stopOpacity=".2" /><stop offset="1" stopColor="#ffffff" stopOpacity=".6" /></linearGradient>
    </defs>
    <path d={TUBE} fillRule="evenodd" fill="#dcebfa" fillOpacity=".6" />
    <g clipPath={`url(#${id}-tube)`}>
      <g className="frame-fx frame-slosh">
        <g className="frame-fx frame-wave frame-wave-back"><path d={`${wave(5)}V150H-80Z`} fill="#38b6ff" opacity=".55" transform="translate(-20 -2.5)" /></g>
        <g className="frame-fx frame-wave"><path d={`${wave(4)}V150H-80Z`} fill={drink} /><path d={wave(4)} stroke="#c9f3ff" strokeWidth="1.4" /></g>
        {BUBBLES.map(bubble => <circle key={`${bubble.x}-${bubble.y}`} className="frame-fx frame-fizz" cx={bubble.x} cy={bubble.y} r={bubble.r} fill="#eafaff" fillOpacity=".9" style={fx(bubble.delay)} />)}
      </g>
    </g>
    <path d={TUBE} fillRule="evenodd" stroke="#5f8fc2" strokeWidth=".8" />
    <path d={arc(60.4, 290, 354)} stroke={`url(#${id}-glass)`} strokeWidth="3.2" strokeLinecap="round" />
    <path d={arc(52.4, 298, 334)} stroke="#fff" strokeOpacity=".85" strokeWidth="1.1" strokeLinecap="round" />
    <path d={arc(60.6, 112, 150)} stroke="#fff" strokeOpacity=".5" strokeWidth="1.2" strokeLinecap="round" />
    {SPLASHES.map(splash => <g key={splash.x} transform={`translate(${splash.x} ${splash.y}) scale(1.35)`}><g className="frame-fx frame-burst" style={fx(splash.x > 50 ? 0 : -1.3)}>
      {splash.jets.map(([angle, length, width]) => { const item = jet(angle, length, width); return <g key={angle}>
        <path d={item.d} fill={drink} stroke="#0a3a9e" strokeWidth=".45" strokeLinejoin="round" />
        <circle cx={item.drop[0]} cy={item.drop[1]} r={round(width * .7)} fill="#1f8bff" stroke="#0a3a9e" strokeWidth=".4" />
      </g>; })}
      <ellipse rx="5" ry="1.8" fill={drink} stroke="#0a3a9e" strokeWidth=".45" />
    </g></g>)}
    <path d="M44 112.6Q50 117.5 56 112.6" fill="#1f8bff" stroke="#0a3a9e" strokeWidth=".45" />
    <g transform="translate(50 115)"><path className="frame-fx frame-fall" d="M0-3C2-.8 2.5.6 2.5 1.5A2.5 2.5 0 0 1-2.5 1.5C-2.5.6-2-.8 0-3Z" fill="#1f8bff" stroke="#0a3a9e" strokeWidth=".45" style={fx(0)} /></g>
  </>;
}

// Can: a knurled aluminium rim with a pull tab, the blue label, condensation and fizz.
const DROPS = [[24, 54.5, 1], [70, 52.6, .8], [128, 55, .9], [160, 52.8, .7], [236, 55.2, .85], [300, 52.7, .75], [332, 55, 1]] as const;
const DRIPS = [{ angle: 48, delay: 0 }, { angle: 146, delay: -2.4 }, { angle: 316, delay: -1.2 }];
const DROP = 'M0-2.4C1.4-.7 1.7.4 1.7 1A1.7 1.7 0 0 1-1.7 1C-1.7.4-1.4-.7 0-2.4Z';
const FIZZ = [{ x: 20, y: 114, r: 1.4, dx: -2, delay: 0 }, { x: 36, y: 120, r: 1, dx: 1, delay: -1 }, { x: 64, y: 120, r: 1.2, dx: -1, delay: -2.1 }, { x: 80, y: 114, r: .9, dx: 2, delay: -.5 }, { x: 50, y: 124, r: 1.6, dx: 0, delay: -1.6 }];
function arc(radius: number, from: number, to: number) {
  const [x1, y1] = polar(radius, from), [x2, y2] = polar(radius, to);
  return `M${x1} ${y1}A${radius} ${radius} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`;
}
function Can({ id }: { id: string }) {
  return <>
    <defs>
      <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fbfcfd" /><stop offset=".3" stopColor="#aeb8c2" /><stop offset=".55" stopColor="#eef2f5" /><stop offset=".8" stopColor="#7d8894" /><stop offset="1" stopColor="#d9e0e6" /></linearGradient>
    </defs>
    <path d="M30 108Q36 100 42 107T54 106T66 108" stroke="#3d9bff" strokeWidth="2.2" strokeLinecap="round" />
    {[[34, 101, 1.3, 0], [47, 98, 1.6, -.6], [60, 100, 1.2, -1.1]].map(([x, y, r, delay]) => <circle key={x} className="frame-fx frame-splash" cx={x} cy={y} r={r} fill="#3d9bff" style={fx(delay!)} />)}
    <circle cx="50" cy="50" r="54" stroke={`url(#${id}-metal)`} strokeWidth="8" />
    <circle cx="50" cy="50" r="54" stroke="#5d6873" strokeOpacity=".35" strokeWidth="8" strokeDasharray=".45 2.4" />
    <path d={arc(54, 198, 302)} stroke="#006eff" strokeWidth="8" />
    <path d={arc(54, 198, 302)} stroke="#4d9bff" strokeWidth="1.2" transform="translate(0 -2.2)" opacity=".7" />
    <g transform={`translate(${polar(54, 250).join(' ')}) rotate(-20)`}><path d="M1.2-4.4-2.6.6H.2L-1.2 4.4 2.6-.6H-.2Z" fill="#ffd23f" /></g>
    <circle cx="50" cy="50" r="50.2" stroke="#56616c" strokeWidth="1" />
    <circle cx="50" cy="50" r="58.2" stroke="#fff" strokeOpacity=".8" strokeWidth=".7" />
    <g transform="translate(50 -6.5)"><g className="frame-fx frame-tab" style={fx(0)}>
      <path fillRule="evenodd" d="M-9-3A5 5 0 0 1-4-8H4A5 5 0 0 1 9-3V1A6 6 0 0 1 3 7H-3A6 6 0 0 1-9 1ZM-4.6-4.2A1.8 1.8 0 0 0-2.8-2.4H2.8A1.8 1.8 0 0 0 4.6-4.2A1.8 1.8 0 0 0 2.8-6H-2.8A1.8 1.8 0 0 0-4.6-4.2Z" fill={`url(#${id}-metal)`} stroke="#6b7681" strokeWidth=".5" />
      <circle cy="3" r="1.6" fill="#c9d1d8" stroke="#6b7681" strokeWidth=".4" />
    </g></g>
    {DROPS.map(([angle, radius, scale]) => { const [x, y] = polar(radius, angle); return <g key={angle} transform={`translate(${x} ${y}) scale(${scale})`}><path d={DROP} fill="#fff" fillOpacity=".75" stroke="#8ea1b3" strokeWidth=".3" /><circle cx="-.5" cy=".4" r=".45" fill="#fff" /></g>; })}
    {DRIPS.map(drip => { const [x, y] = polar(56.5, drip.angle); return <g key={drip.angle} transform={`translate(${x} ${y})`}><path className="frame-fx frame-drip" d={DROP} fill="#fff" fillOpacity=".85" stroke="#8ea1b3" strokeWidth=".3" style={fx(drip.delay)} /></g>; })}
    {FIZZ.map(bubble => <circle key={`${bubble.x}-${bubble.y}`} className="frame-fx frame-rise" cx={bubble.x} cy={bubble.y} r={bubble.r} stroke="#7cb8ff" strokeWidth=".5" fill="#fff" fillOpacity=".5" style={fx(bubble.delay, { '--dx': `${bubble.dx}px` })} />)}
  </>;
}

// Legend: a faceted ring in the rank emblem colours, a crystal crown, wings and a 16-point star.
function star(count: number, outer: number, inner: number) {
  return Array.from({ length: count * 2 }, (_, index) => {
    const radius = index % 2 ? inner : outer, angle = (Math.PI * index) / count - Math.PI / 2;
    return `${index ? 'L' : 'M'}${round(radius * Math.cos(angle))} ${round(radius * Math.sin(angle))}`;
  }).join('') + 'Z';
}
const LEGEND_STAR = star(16, 13, 10.4);
const FACETS = Array.from({ length: 24 }, (_, index) => {
  const from = index * 15, to = from + 15, light = (Math.cos(((from + 7.5 - 315) * Math.PI) / 180) + 1) / 2;
  return {
    outer: points([polar(54, from), polar(58.5, from), polar(58.5, to), polar(54, to)]),
    inner: points([polar(50, from), polar(54, from), polar(54, to), polar(50, to)]),
    outerFill: `hsl(${Math.round(272 + light * 18)} 72% ${Math.round(30 + light * 34)}%)`, innerFill: `hsl(${Math.round(262 + light * 10)} 70% ${Math.round(20 + light * 22)}%)`,
  };
});
const CROWN = [[-22, 9], [-11, 13], [0, 19], [11, 13], [22, 9]] as const;
const WINGS = [[70, 11, 2.8], [80, 18, 3.4], [91, 25, 4.2], [103, 15, 3], [257, 15, 3], [269, 25, 4.2], [280, 18, 3.4], [290, 11, 2.8]] as const;
function Legend({ id }: { id: string }) {
  const crystalFill = `url(#${id}-crystal)`;
  return <>
    <defs>
      <linearGradient id={`${id}-crystal`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffd6f6" /><stop offset=".5" stopColor="#c447ff" /><stop offset="1" stopColor="#4a18c8" /></linearGradient>
    </defs>
    {WINGS.map(([angle, length, width]) => { const shard = crystal(58, angle, length, width); return <g key={angle}><polygon points={shard.body} fill={crystalFill} stroke="#2a0b6e" strokeWidth=".4" strokeLinejoin="round" /><polygon points={shard.facet} fill="#fff" opacity=".3" /></g>; })}
    {FACETS.map(facet => <g key={facet.outer}><polygon points={facet.outer} fill={facet.outerFill} /><polygon points={facet.inner} fill={facet.innerFill} /></g>)}
    <circle cx="50" cy="50" r="58.5" stroke="#ffd6f6" strokeOpacity=".7" strokeWidth=".6" />
    <circle cx="50" cy="50" r="50.3" stroke="#ffd6f6" strokeOpacity=".8" strokeWidth=".6" />
    <g className="frame-fx frame-ride"><circle cx="50" cy="50" r="54.2" stroke="#fff" strokeOpacity=".55" strokeWidth="8.6" strokeDasharray="5 336" /></g>
    <path d={`${arc(61.5, -30, 30)}`} stroke="#2a0b6e" strokeWidth="5.4" strokeLinecap="round" />
    <path d={`${arc(61.5, -30, 30)}`} stroke={crystalFill} strokeWidth="4" strokeLinecap="round" />
    {CROWN.map(([angle, height]) => { const shard = crystal(63, angle, height, 3.2); return <g key={angle}><polygon points={shard.body} fill={crystalFill} stroke="#2a0b6e" strokeWidth=".45" strokeLinejoin="round" /><polygon points={shard.facet} fill="#fff" opacity=".35" /></g>; })}
    {[-15, 0, 15].map(angle => { const [x, y] = polar(61.5, angle); return <circle key={angle} cx={x} cy={y} r={angle ? 1.2 : 1.6} fill="#ffd6f6" stroke="#2a0b6e" strokeWidth=".4" />; })}
    <g transform="translate(50 112)">
      <g className="frame-fx frame-turn" style={fx(0)}><path d={LEGEND_STAR} fill={crystalFill} stroke="#2a0b6e" strokeWidth=".6" /></g>
      <circle r="6.6" fill="#2a0b6e" />
      <path d={STAR} transform="scale(.52)" fill="#ffd6f6" />
    </g>
    {[[...polar(82, 0), .5, 0], [...crystal(58, 91, 25, 4.2).tip, .45, -1.8], [...crystal(58, 269, 25, 4.2).tip, .45, -3.2]].map(([x, y, scale, delay]) => <Glint key={`${x}-${y}`} x={x!} y={y!} scale={scale!} delay={delay!} />)}
  </>;
}

const FRONT: Record<HeavyFrame, (id: string) => ReactNode> = {
  frost: id => <Frost id={id} />, blaze: id => <Blaze id={id} />, liquid: id => <Liquid id={id} />, can: id => <Can id={id} />, legend: id => <Legend id={id} />,
};
const BACK: Partial<Record<HeavyFrame, (id: string) => ReactNode>> = { blaze: id => <BlazeBack id={id} /> };

export function HeavyAvatarFrame({ frame }: { frame: HeavyFrame }) {
  const id = `frame${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const back = BACK[frame];
  return <>
    {back && <svg className={`avatar-frame avatar-frame-heavy avatar-frame-back avatar-frame-${frame}`} viewBox={VIEW} fill="none" aria-hidden="true" focusable="false">{back(id)}</svg>}
    <svg className={`avatar-frame avatar-frame-heavy avatar-frame-${frame}`} viewBox={VIEW} fill="none" aria-hidden="true" focusable="false">{FRONT[frame](`${id}f`)}</svg>
  </>;
}
