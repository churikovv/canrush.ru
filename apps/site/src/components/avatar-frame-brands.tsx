import { useId, type ReactNode } from 'react';
import { annulus, arc, fx, HEAVY_VIEW, noise, onRing, points, polar, ringPath, round, star } from '@/components/frame-geometry';

/**
 * Brand frames: heavy frames (160% of the avatar) themed on what the brand's name says — Monster's claws,
 * Red Bull's wings, Flash Up's lightning. Only motifs and colours: no logos, wordmarks or can art.
 * The biggest pieces sit on the diagonals: the square box leaves the most room in its corners.
 */
export const BRAND_FRAMES = ['monster', 'redbull', 'flashup', 'adrenaline', 'gorilla', 'jaguar', 'volt', 'tornado', 'burn', 'lit', 'drive'] as const;
export type BrandFrame = typeof BRAND_FRAMES[number];
export const isBrandFrame = (frame: string): frame is BrandFrame => (BRAND_FRAMES as readonly string[]).includes(frame);

type Point = [number, number];
type Curve = [Point, Point, Point, Point];
const STAR = 'M0-10Q1-1 10 0Q1 1 0 10Q-1 1-10 0Q-1-1 0-10Z';
const DROP = 'M0-2.6C1.5-.8 1.8.4 1.8 1.1A1.8 1.8 0 0 1-1.8 1.1C-1.8.4-1.5-.8 0-2.6Z';
const MIRROR = 'translate(100 0) scale(-1 1)';
const hole = (radius: number) => `M50 ${round(50 - radius)}A${radius} ${radius} 0 1 0 50 ${round(50 + radius)}A${radius} ${radius} 0 1 0 50 ${round(50 - radius)}Z`;
const dir = (degrees: number): Point => [Math.cos((degrees * Math.PI) / 180), Math.sin((degrees * Math.PI) / 180)];
const line = (list: Point[]) => `M${list.map(point => point.join(' ')).join('L')}`;
/** Y of the circle `radius` under the column `x`, for things hanging off the bottom of a ring. */
const bottomAt = (radius: number, x: number) => round(50 + Math.sqrt(radius ** 2 - (x - 50) ** 2));

/** Leaf, feather or blade from `from` towards `angle` (screen degrees, 0 = right); `bend` curls the tip sideways. */
function blade(angle: number, length: number, width: number, bend = 0, from: Point = [0, 0]) {
  const [dx, dy] = dir(angle), [nx, ny] = [-dy, dx];
  const at = (along: number, side: number) => `${round(from[0] + dx * along + nx * side)} ${round(from[1] + dy * along + ny * side)}`;
  return `M${at(0, -width * .3)}Q${at(length * .45, -width * (1 + bend))} ${at(length, width * bend)}Q${at(length * .5, width * (1 - bend))} ${at(0, width * .3)}Z`;
}
/** Pointed lens between two points: a slash, a rip or a claw mark; `bend` curves it like a claw's swipe. */
function lens(a: Point, b: Point, width: number, bend = 0) {
  const [mx, my] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const [nx, ny] = [-(b[1] - a[1]) / length, (b[0] - a[0]) / length];
  return `M${round(a[0])} ${round(a[1])}Q${round(mx + nx * (width + bend))} ${round(my + ny * (width + bend))} ${round(b[0])} ${round(b[1])}Q${round(mx - nx * (width - bend))} ${round(my - ny * (width - bend))} ${round(a[0])} ${round(a[1])}Z`;
}
function bezier(curve: Curve, t: number): { at: Point; normal: Point } {
  const [p0, p1, p2, p3] = curve, u = 1 - t;
  const at: Point = [0, 1].map(axis => u ** 3 * p0[axis]! + 3 * u * u * t * p1[axis]! + 3 * u * t * t * p2[axis]! + t ** 3 * p3[axis]!) as Point;
  const [tx, ty] = [0, 1].map(axis => 3 * u * u * (p1[axis]! - p0[axis]!) + 6 * u * t * (p2[axis]! - p1[axis]!) + 3 * t * t * (p3[axis]! - p2[axis]!)) as Point;
  const length = Math.hypot(tx, ty) || 1;
  return { at, normal: [-ty / length, tx / length] };
}
/** A horn, spike or tail along a cubic curve: `width` at the base narrowing to `tip` at the end. */
function taper(curve: Curve, width: number, tip = 0, steps = 12) {
  const left: Point[] = [], right: Point[] = [];
  for (let index = 0; index <= steps; index++) {
    const t = index / steps, { at, normal } = bezier(curve, t), half = (width + (tip - width) * t) / 2;
    left.push([round(at[0] + normal[0] * half), round(at[1] + normal[1] * half)]);
    right.push([round(at[0] - normal[0] * half), round(at[1] - normal[1] * half)]);
  }
  return `M${points(left)}L${points(right.reverse())}Z`;
}
/** A band along an arc that swells in the middle and thins to points at both ends (wind, a vine, a ribbon). */
function crescent(radius: number, from: number, to: number, width: number, steps = 14) {
  const outer: Point[] = [], inner: Point[] = [];
  for (let index = 0; index <= steps; index++) {
    const t = index / steps, half = (width * Math.sin(Math.PI * t ** .8)) / 2, angle = from + (to - from) * t;
    outer.push(polar(radius + half, angle));
    inner.push(polar(radius - half, angle));
  }
  return `M${points(outer)}L${points(inner.reverse())}Z`;
}
const flamePath = (h: number, w: number) => `M${round(-w)} 0C${round(-w)} ${round(-h * .42)} ${round(-w * .2)} ${round(-h * .62)} ${round(w * .15)} ${round(-h)}C${round(w * .1)} ${round(-h * .7)} ${round(w)} ${round(-h * .5)} ${round(w)} 0Z`;

function Glint({ at, scale, delay }: { at: Point; scale: number; delay: number }) {
  return <g transform={`translate(${at.join(' ')}) scale(${scale})`}><g className="frame-fx frame-spark" style={fx(delay)}>
    <path d={STAR} fill="currentColor" /><path className="frame-core" d={STAR} transform="scale(.4)" />
  </g></g>;
}

// Monster: a torn black-steel collar with curved spikes and a maw of teeth round the portrait, claw marks glowing and slime pouring off the bottom.
const MONSTER_EDGE = `${ringPath(angle => 61.2 + noise(angle + 3) * 2.6 + (angle % 10 ? 0 : 2.6), 5)}${hole(49.4)}`;
const MONSTER_SPIKES = [[84, 15], [106, 13], [244, 13], [264, 16], [286, 19], [308, 21], [330, 20], [352, 17]].map(([angle, length]) => ({
  angle: angle!, d: taper([[0, 0], [0, -length! * .45], [length! * .18, -length! * .78], [length! * .4, -length!]], 8.4, 0),
}));
// The rim is a maw: jagged teeth all round the portrait, longer fangs at the top and bottom.
const MONSTER_TEETH = Array.from({ length: 26 }, (_, index) => {
  const angle = index * (360 / 26) + 7, fang = [0, 12, 13, 25].includes(index);
  const length = round(fang ? 9.4 : 4 + noise(index + 600) * 2.6), width = round(fang ? 6.6 : 4 + noise(index + 640) * 1.4);
  return { angle, d: `M${round(-width / 2)} 0Q${round(-width * .3)} ${round(length * .55)} ${round(width * .12)} ${length}Q${round(width * .26)} ${round(length * .5)} ${round(width / 2)} 0Z` };
});
const MONSTER_SCRATCHES = [-6, 0, 6].map(shift => line([polar(51.6, 262 + shift), polar(62.6, 274 + shift)]));
const SLIME_DRIPS = [[25, 7, 2.8], [33, 13, 3.4], [41, 9, 3], [50, 16, 3.8], [59, 10, 3.2], [67, 14, 3.4], [75, 6, 2.6]] as const;
const MONSTER_BUBBLES = [[18, 118, 1.6, -2, 0], [82, 118, 1.3, 2, -1.1], [36, 126, 1, -1, -2.2], [64, 127, 1.8, 1, -.6], [108, 98, 1.2, 2, -1.7], [-8, 98, 1.4, -2, -2.8]] as const;
function Monster({ id }: { id: string }) {
  return <>
    <defs>
      <linearGradient id={`${id}-steel`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#465046" /><stop offset=".42" stopColor="#0e110e" /><stop offset=".68" stopColor="#2a312a" /><stop offset="1" stopColor="#060706" /></linearGradient>
      <linearGradient id={`${id}-spike`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#040504" /><stop offset=".55" stopColor="#1f281f" /><stop offset="1" stopColor="#6bdc1c" /></linearGradient>
      <linearGradient id={`${id}-tooth`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9a9272" /><stop offset=".4" stopColor="#f3eed8" /><stop offset="1" stopColor="#fffdf2" /></linearGradient>
      <linearGradient id={`${id}-slime`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c8ff6e" /><stop offset=".55" stopColor="#62e414" /><stop offset="1" stopColor="#2b9404" /></linearGradient>
    </defs>
    {MONSTER_SPIKES.map(spike => <g key={spike.angle} transform={onRing(61, spike.angle)}><path d={spike.d} fill={`url(#${id}-spike)`} stroke="#000" strokeWidth=".6" strokeLinejoin="round" /></g>)}
    <path d={MONSTER_EDGE} fillRule="evenodd" fill={`url(#${id}-steel)`} stroke="#000" strokeWidth=".8" strokeLinejoin="round" />
    <circle cx="50" cy="50" r="59.6" stroke="#7dff1a" strokeOpacity=".45" strokeWidth=".6" strokeDasharray="2 3" />
    <circle cx="50" cy="50" r="52.8" stroke="#000" strokeOpacity=".55" strokeWidth="1.4" />
    {Array.from({ length: 12 }, (_, index) => { const [x, y] = polar(56.4, index * 30 + 15); return <g key={index}><circle cx={x} cy={y} r="1.7" fill="#2f372f" stroke="#000" strokeWidth=".4" /><circle cx={round(x - .5)} cy={round(y - .5)} r=".6" fill="#b3c1b3" /></g>; })}
    <circle cx="50" cy="50" r="50.2" stroke="#7dff1a" strokeWidth="1.8" />
    <circle cx="50" cy="50" r="51.6" stroke="#000" strokeWidth=".8" />
    <path d={arc(62.6, 118, 242)} stroke="#164d02" strokeWidth="8.4" strokeLinecap="round" />
    <path d={arc(62.6, 118, 242)} stroke={`url(#${id}-slime)`} strokeWidth="7" strokeLinecap="round" />
    {SLIME_DRIPS.map(([x, length, width]) => {
      const y = round(bottomAt(64, x) - 2.4), r = round(width * .5);
      return <g key={x}>
        <path d={`M${round(x - width)} ${y}C${round(x - width)} ${round(y + length * .55)} ${round(x - r)} ${round(y + length * .7)} ${round(x - r)} ${round(y + length)}A${r} ${r} 0 0 0 ${round(x + r)} ${round(y + length)}C${round(x + r)} ${round(y + length * .7)} ${round(x + width)} ${round(y + length * .55)} ${round(x + width)} ${y}Z`} fill={`url(#${id}-slime)`} stroke="#164d02" strokeWidth=".5" />
        <ellipse cx={round(x - width * .4)} cy={round(y + length * .45)} rx=".6" ry={round(length * .18)} fill="#f0ffd6" opacity=".75" />
        {length > 11 && <g transform={`translate(${x} ${round(y + length + 3)})`}><path className="frame-fx frame-fall" d={DROP} transform="scale(1.3)" fill="#7dff1a" stroke="#164d02" strokeWidth=".3" style={fx(-length * .2)} /></g>}
      </g>;
    })}
    <path d={arc(63.4, 128, 232)} stroke="#f0ffd6" strokeOpacity=".7" strokeWidth=".9" strokeLinecap="round" strokeDasharray="6 4 14 5" />
    {MONSTER_SCRATCHES.map((scratch, index) => <g key={scratch} className="frame-fx frame-rip" style={fx(-index * .3)}>
      <path d={scratch} stroke="#000" strokeWidth="3" strokeLinecap="round" />
      <path d={scratch} stroke="#7dff1a" strokeWidth="1.8" strokeLinecap="round" />
      <path d={scratch} stroke="#f4ffe6" strokeWidth=".6" strokeLinecap="round" />
    </g>)}
    {MONSTER_TEETH.map(tooth => <g key={tooth.angle} transform={onRing(51.4, tooth.angle)}><path d={tooth.d} fill={`url(#${id}-tooth)`} stroke="#1c1a0e" strokeWidth=".5" strokeLinejoin="round" /></g>)}
    {MONSTER_BUBBLES.map(([x, y, r, dx, delay]) => <circle key={`${x}-${y}`} className="frame-fx frame-rise" cx={x} cy={y} r={r} fill="#9dff4a" fillOpacity=".85" stroke="#2f9e05" strokeWidth=".3" style={fx(delay, { '--dx': `${dx}px` })} />)}
  </>;
}

// Red Bull: a polished silver-and-navy ring between two great feathered wings, bull horns on top and a ruby crest below.
const WRIST: Point = [10, -16];
const BONE: Curve = [[0, 0], [1, -6], [5, -12], WRIST];
const along = (t: number) => bezier(BONE, t).at.map(round) as Point;
const FEATHERS = [
  ...[[-114, 25], [-98, 30], [-82, 33], [-66, 34], [-50, 33], [-34, 30], [-19, 25]].map(([angle, length]) => ({ d: blade(angle!, length!, 6, .1, WRIST), tone: 'feather' })),
  ...[[.12, 16, 19], [.32, 4, 21], [.52, -8, 23], [.72, -20, 24], [.92, -32, 24]].map(([t, angle, length]) => ({ d: blade(angle!, length!, 5.6, .08, along(t!)), tone: 'feather' })),
  ...[[.2, -2], [.45, -18], [.7, -36], [.95, -56]].map(([t, angle]) => ({ d: blade(angle!, 13, 5, .05, along(t!)), tone: 'covert' })),
];
const HORN_CURVE: Curve = [[0, 0], [6, -9], [19, -8], [21, -28]];
const HORN = taper(HORN_CURVE, 10.4, .5);
const HORN_BANDS = [.07, .14, .21].map(t => { const { at, normal } = bezier(HORN_CURVE, t), half = 5.2 - t * 6; return line([[round(at[0] + normal[0] * half), round(at[1] + normal[1] * half)], [round(at[0] - normal[0] * half), round(at[1] - normal[1] * half)]]); });
function Wing({ id }: { id: string }) {
  return <g transform={`translate(${polar(58, 74).join(' ')}) scale(.86)`}><g className="frame-fx frame-flap">
    {FEATHERS.map(feather => <path key={feather.d} d={feather.d} fill={`url(#${id}-${feather.tone})`} stroke="#14306b" strokeWidth=".5" strokeLinejoin="round" />)}
    {FEATHERS.filter(feather => feather.tone === 'covert').map(feather => <path key={`${feather.d}-gold`} d={feather.d} stroke="#ffcc00" strokeOpacity=".8" strokeWidth=".35" />)}
    <path d={`M0 0C1-6 5-12 ${WRIST.join(' ')}`} stroke="#0b1d4a" strokeWidth="4.8" strokeLinecap="round" />
    <path d={`M0 0C1-6 5-12 ${WRIST.join(' ')}`} stroke="#d5deea" strokeWidth="3.4" strokeLinecap="round" />
  </g></g>;
}
function Horn({ id }: { id: string }) {
  return <g transform={`translate(${polar(58.5, 24).join(' ')})`}>
    <path d={HORN} fill={`url(#${id}-horn)`} stroke="#3d2406" strokeWidth=".6" strokeLinejoin="round" />
    {HORN_BANDS.map(band => <path key={band} d={band} stroke="#7a4a10" strokeWidth=".8" strokeLinecap="round" opacity=".75" />)}
    <path d="M3-5C8-8.6 15-7.8 18.4-14" stroke="#fff" strokeOpacity=".7" strokeWidth=".9" strokeLinecap="round" />
  </g>;
}
function RedBull({ id }: { id: string }) {
  return <>
    <defs>
      <linearGradient id={`${id}-feather`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset=".55" stopColor="#e1eaf8" /><stop offset="1" stopColor="#9db4dc" /></linearGradient>
      <linearGradient id={`${id}-covert`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#d4e0f4" /><stop offset="1" stopColor="#6f8cc2" /></linearGradient>
      <linearGradient id={`${id}-silver`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset=".28" stopColor="#9aa7b8" /><stop offset=".52" stopColor="#f2f5f9" /><stop offset=".78" stopColor="#5f6d82" /><stop offset="1" stopColor="#dfe6ef" /></linearGradient>
      <linearGradient id={`${id}-horn`} x1="0" y1="0" x2="21" y2="-28" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#b57a1c" /><stop offset=".3" stopColor="#fff4d6" /><stop offset=".78" stopColor="#ecc77e" /><stop offset="1" stopColor="#4a2e0c" /></linearGradient>
      <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff2a8" /><stop offset=".5" stopColor="#ffcc00" /><stop offset="1" stopColor="#9a6a00" /></linearGradient>
      <linearGradient id={`${id}-ruby`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ff8aa0" /><stop offset=".45" stopColor="#e4002b" /><stop offset="1" stopColor="#6a0012" /></linearGradient>
    </defs>
    <Wing id={id} /><g transform={MIRROR}><Wing id={id} /></g>
    <Horn id={id} /><g transform={MIRROR}><Horn id={id} /></g>
    <circle cx="50" cy="50" r="55.4" stroke="#0b1d4a" strokeWidth="13" />
    <circle cx="50" cy="50" r="55.4" stroke={`url(#${id}-silver)`} strokeWidth="11" />
    <circle cx="50" cy="50" r="55.4" stroke="#14306b" strokeWidth="4.8" />
    <circle cx="50" cy="50" r="52.7" stroke="#ffcc00" strokeOpacity=".8" strokeWidth=".5" />
    <circle cx="50" cy="50" r="58.1" stroke="#ffcc00" strokeOpacity=".8" strokeWidth=".5" />
    <circle className="frame-fx frame-sweep" cx="50" cy="50" r="55.4" pathLength={100} stroke="#fff" strokeOpacity=".8" strokeWidth="11" strokeDasharray="3 97" />
    {Array.from({ length: 12 }, (_, index) => { const [x, y] = polar(55.4, index * 30 + 15); return <circle key={index} cx={x} cy={y} r="1.3" fill={`url(#${id}-gold)`} stroke="#7a5a00" strokeWidth=".3" />; })}
    <circle cx="50" cy="50" r="50.2" stroke="#ffcc00" strokeWidth="1.6" />
    <g transform="translate(50 112)">
      <path d="M-15-3C-10-1-6-4-6-8-2-6 2-6 6-8 6-4 10-1 15-3 12 1 8 1 6 0Z" fill={`url(#${id}-gold)`} stroke="#7a5a00" strokeWidth=".5" strokeLinejoin="round" />
      <path d="M-8-9H8V0C8 6 4 9.5 0 11.5-4 9.5-8 6-8 0Z" fill={`url(#${id}-gold)`} stroke="#7a5a00" strokeWidth=".6" />
      <path d="M0-6 5-.5 0 6-5-.5Z" fill={`url(#${id}-ruby)`} stroke="#4a000c" strokeWidth=".4" />
      <path d="M0-6 5-.5H-5Z" fill="#fff" opacity=".3" />
    </g>
    <Glint at={[52, 107]} scale={.45} delay={-1} />
    <Glint at={[polar(58.5, 24)[0] + 21, polar(58.5, 24)[1] - 28]} scale={.36} delay={-2.6} />
    <Glint at={polar(84, 306)} scale={.3} delay={-3.6} />
  </>;
}

// Flash Up: a thick hazard-striped ring with lightning striking out of it — the heaviest bolts fill the corners.
const HAZARD = Array.from({ length: 36 }, (_, index) => points([polar(49.6, index * 10), polar(49.6, index * 10 + 5), polar(61.6, index * 10 + 10), polar(61.6, index * 10 + 5)]));
const BOLT = 'M2-20-8-8H1L0 0 10-12H1Z';
const BOLTS = [[315, 1.85], [45, 1.6], [135, 1.45], [225, 1.65], [0, .95], [90, .9], [180, .8], [270, .95], [22, .7], [338, .75], [200, .65], [112, .7]] as const;
const CRACKLE = [[24, 0], [110, -.7], [200, -1.4], [290, -2.1]].map(([angle, delay]) => ({
  d: line(Array.from({ length: 7 }, (_, index) => polar(63.4 + (index % 2 ? 3 : 0), angle! + index * 3.6))), delay: delay!,
}));
function FlashUp({ id }: { id: string }) {
  return <>
    <defs>
      <linearGradient id={`${id}-volt`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fffbd1" /><stop offset=".4" stopColor="#ffe600" /><stop offset="1" stopColor="#ff9d00" /></linearGradient>
    </defs>
    <circle className="frame-fx frame-glow" cx="50" cy="50" r="64" stroke="#ffe600" strokeWidth="5" opacity=".4" />
    {BOLTS.map(([angle, scale], index) => <g key={angle} transform={onRing(60.5, angle, scale)}>
      <g className="frame-fx frame-strike" style={fx(-index * .37)}>
        <path d={BOLT} transform="scale(.9 1.15)" fill={`url(#${id}-volt)`} stroke="#111" strokeWidth={round(1 / scale)} strokeLinejoin="round" />
        <path d={BOLT} transform="translate(.6 -2.4) scale(.42 .62)" fill="#fff" />
      </g>
    </g>)}
    <path d={annulus(49.6, 61.6)} fillRule="evenodd" fill="#ffe100" />
    {HAZARD.map(stripe => <polygon key={stripe} points={stripe} fill="#111" />)}
    <circle cx="50" cy="50" r="55.6" stroke="#fff" strokeOpacity=".22" strokeWidth="5" />
    <circle cx="50" cy="50" r="61.8" stroke="#111" strokeWidth="1.8" />
    <circle cx="50" cy="50" r="62.9" stroke="#ffe100" strokeWidth=".7" />
    <circle cx="50" cy="50" r="50" stroke="#111" strokeWidth="1.6" />
    <circle cx="50" cy="50" r="49.2" stroke="#fff6a8" strokeWidth=".6" />
    {CRACKLE.map(item => <path key={item.d} className="frame-fx frame-crackle" d={item.d} stroke="#fffbd1" strokeWidth=".9" strokeLinejoin="round" style={fx(item.delay)} />)}
    <Glint at={polar(106, 315)} scale={.55} delay={0} />
    <Glint at={polar(96, 225)} scale={.4} delay={-2.2} />
  </>;
}

// Adrenaline Rush: a carbon ring with racing stripes, a heart monitor trace racing round it and a pounding heart in the corner.
const BEAT: Point[] = [[-14, 0], [-9, 2.4], [-5.5, 0], [-3, 0], [-1.6, -4], [0, 17], [1.8, -9], [3.4, 0], [7, 0], [10, 3.6], [13.4, 0]];
const BEATS = [45, 165, 285];
const ECG = BEATS.map((center, index) => {
  const beat = BEAT.map(([shift, lift]) => polar(66.5 + lift, center + shift).join(' ')).join('L');
  const next = BEATS[(index + 1) % BEATS.length]! + (index === BEATS.length - 1 ? 360 : 0);
  const [x, y] = polar(66.5, next - 14);
  return `${index ? 'L' : 'M'}${beat}A66.5 66.5 0 0 1 ${x} ${y}`;
}).join('') + 'Z';
const CARBON = Array.from({ length: 40 }, (_, index) => points([polar(49.6, index * 9), polar(49.6, index * 9 + 4.5), polar(61.4, index * 9 + 9), polar(61.4, index * 9 + 4.5)]));
const HEART = 'M0 9C-10 3-13.4-3.6-10.4-8-7.6-12-2.6-11.4 0-7.4 2.6-11.4 7.6-12 10.4-8 13.4-3.6 10 3 0 9Z';
function Adrenaline({ id }: { id: string }) {
  return <>
    <defs>
      <linearGradient id={`${id}-stripe`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#ffb300" /><stop offset=".5" stopColor="#ff5a00" /><stop offset="1" stopColor="#e10600" /></linearGradient>
      <radialGradient id={`${id}-heart`} cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#ffb07a" /><stop offset=".45" stopColor="#ff3d00" /><stop offset="1" stopColor="#9a0500" /></radialGradient>
    </defs>
    {[[-28, 30, 18, 0], [-30, 40, 24, -.25], [-27, 50, 16, -.5], [-30, 60, 22, -.75], [-26, 70, 14, -1]].map(([x, y, length, delay]) => <path key={y} className="frame-fx frame-streak" d={`M${x} ${y}h${length}`} stroke="#ff7a1a" strokeWidth="1.8" strokeLinecap="round" style={fx(delay!)} />)}
    <path d={annulus(49.6, 61.4)} fillRule="evenodd" fill="#141414" />
    {CARBON.map(cell => <polygon key={cell} points={cell} fill="#2d2d2d" />)}
    {[[15, 85], [195, 265]].map(([from, to]) => <g key={from}>
      <path d={arc(55.5, from!, to!)} stroke={`url(#${id}-stripe)`} strokeWidth="7.4" />
      <path d={arc(51.2, from!, to!)} stroke="#fff" strokeWidth=".7" /><path d={arc(59.8, from!, to!)} stroke="#fff" strokeWidth=".7" />
    </g>)}
    <circle cx="50" cy="50" r="61.6" stroke="#ff5a00" strokeWidth="1.8" />
    <circle cx="50" cy="50" r="50.2" stroke="#ff8a1e" strokeWidth="1.4" />
    <path d={ECG} stroke="#ff5a00" strokeOpacity=".45" strokeWidth="1.6" strokeLinejoin="round" />
    <path className="frame-fx frame-trace" d={ECG} pathLength={100} stroke="#ffd9a8" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="16 84" />
    <path className="frame-fx frame-trace" d={ECG} pathLength={100} stroke="#fff" strokeWidth=".9" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="4 96" style={fx(-.18)} />
    <g transform={`translate(${polar(88, 315).join(' ')}) rotate(-12) scale(1.15)`}><g className="frame-fx frame-beat">
      <path d={HEART} fill={`url(#${id}-heart)`} stroke="#3a0200" strokeWidth=".8" strokeLinejoin="round" />
      <path d="M-8.4-1.4H-4.6L-2.8-5 0 3 1.8-1.4H8.4" stroke="#fff" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round" />
      <ellipse cx="-6" cy="-7" rx="2.2" ry="1.3" transform="rotate(-30 -6 -7)" fill="#fff" opacity=".55" />
    </g></g>
    {[0, 1, 2].map(index => <path key={index} className="frame-fx frame-rush" d={`M${109 + index * 6.4} 42L${116 + index * 6.4} 50 ${109 + index * 6.4} 58`} stroke="#ff5a00" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" style={fx(-1.2 + index * .2)} />)}
  </>;
}

// Gorilla: a ring of carved stone split by glowing cracks, a vine and jungle leaves round it, two huge fists pounding out shockwaves.
const STONES = Array.from({ length: 10 }, (_, index) => {
  const from = index * 36 + 1.6, to = from + 32.8;
  const inner = Array.from({ length: 8 }, (_, step) => polar(49.6, from + (step * (to - from)) / 7));
  const outer = Array.from({ length: 8 }, (_, step) => polar(62 + noise(index * 8 + step) * 2.2, to - (step * (to - from)) / 7));
  return { body: points([...inner, ...outer]), top: line(outer) };
});
const CRACKS = [[20, 0], [92, 1], [160, 2], [236, 3], [300, 4]].map(([angle, seed]) => line([0, 1, 2, 3, 4].map(step => polar(51 + step * 2.6, angle! + (noise(seed! * 5 + step) - .5) * 7))));
const VINE = line(Array.from({ length: 46 }, (_, index) => polar(56 + Math.sin((index * 6 * Math.PI) / 15) * 5, 120 + index * 4)));
const VINE_LEAVES = [150, 190, 230, 270].map(angle => ({ at: polar(56 + Math.sin(((angle - 120) * Math.PI) / 10) * 5, angle), angle: angle + 90 }));
const LEAVES = [
  { at: polar(62, 318), leaves: [[-178, 30, 8.4], [-152, 36, 9.6], [-124, 34, 9.2], [-98, 26, 7.4]] },
  { at: polar(62, 60), leaves: [[-62, 22, 6.6], [-36, 27, 7.6], [-10, 22, 6.6]] },
] as const;
function leafVeins(angle: number, length: number) {
  const [dx, dy] = dir(angle), [nx, ny] = [-dy, dx];
  return `M0 0L${round(dx * length * .92)} ${round(dy * length * .92)}` + [.25, .45, .65].map(t => {
    const [x, y] = [dx * length * t, dy * length * t];
    return `M${round(x)} ${round(y)}L${round(x + dx * 4 + nx * 5)} ${round(y + dy * 4 + ny * 5)}M${round(x)} ${round(y)}L${round(x + dx * 4 - nx * 5)} ${round(y + dy * 4 - ny * 5)}`;
  }).join('');
}
function Fist({ id }: { id: string }) {
  return <g className="frame-fx frame-pound">
    <path d="M-10-3C-10-9-6-12 0-12S10-9 10-3V5C10 9 7 11 2 11H-3C-8 11-10 8-10 3Z" fill={`url(#${id}-fur)`} stroke="#050403" strokeWidth=".8" />
    {[-7, -2.4, 2.4, 7].map(x => <g key={x}><ellipse cx={x} cy="-9.4" rx="2.6" ry="2.4" fill={`url(#${id}-knuckle)`} stroke="#050403" strokeWidth=".55" /><ellipse cx={round(x - .6)} cy="-10.2" rx=".9" ry=".5" fill="#c9b8aa" opacity=".6" /></g>)}
    <path d="M-4.6-7V2M0-7V3M4.6-7V2" stroke="#050403" strokeWidth=".6" opacity=".7" />
    <path d="M-10 0C-6-2-2-1 1 2 2 4 0 6-2 5-5 4-8 4-10 5Z" fill="#3a302a" stroke="#050403" strokeWidth=".6" />
    <path d="M-9 11-7 15-5 11.4-3 15.4-1 11.6 1 15.6 3 11.6 5 15.2 7 11.2 9 14.4" stroke="#1a1410" strokeWidth="1.4" strokeLinejoin="round" />
  </g>;
}
function Gorilla({ id }: { id: string }) {
  return <>
    <defs>
      <linearGradient id={`${id}-stone`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#a8a399" /><stop offset=".5" stopColor="#5f5a51" /><stop offset="1" stopColor="#2a2823" /></linearGradient>
      <linearGradient id={`${id}-leaf`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6fd47b" /><stop offset=".55" stopColor="#1f7a33" /><stop offset="1" stopColor="#0b3816" /></linearGradient>
      <linearGradient id={`${id}-fur`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4d433c" /><stop offset="1" stopColor="#15110e" /></linearGradient>
      <radialGradient id={`${id}-knuckle`} cx=".4" cy=".35" r=".7"><stop offset="0" stopColor="#8a7a6e" /><stop offset="1" stopColor="#2b241f" /></radialGradient>
    </defs>
    {[0, -1.3].map(delay => <circle key={delay} className="frame-fx frame-shock" cx="50" cy="50" r="64" stroke="#ff6a1a" strokeWidth="1.8" style={fx(delay)} />)}
    {LEAVES.map(cluster => <g key={cluster.at.join()} transform={`translate(${cluster.at.join(' ')})`}><g className="frame-fx frame-sway frame-pivot">
      {cluster.leaves.map(([angle, length, width]) => <g key={angle}>
        <path d={blade(angle, length, width, .12)} fill={`url(#${id}-leaf)`} stroke="#072a10" strokeWidth=".55" />
        <path d={leafVeins(angle, length)} stroke="#c4f2b4" strokeOpacity=".6" strokeWidth=".45" strokeLinecap="round" />
      </g>)}
    </g></g>)}
    <path d={annulus(49.4, 64)} fillRule="evenodd" fill="#ff3d00" />
    <path className="frame-fx frame-glow" d={annulus(49.4, 64)} fillRule="evenodd" fill="#ffc46b" />
    {STONES.map(stone => <g key={stone.body}><polygon points={stone.body} fill={`url(#${id}-stone)`} stroke="#11100d" strokeWidth=".7" strokeLinejoin="round" /><path d={stone.top} stroke="#d6d2c6" strokeOpacity=".65" strokeWidth=".7" /></g>)}
    {CRACKS.map(crack => <g key={crack}><path d={crack} stroke="#ff4a0a" strokeWidth="1.6" strokeLinejoin="round" /><path d={crack} stroke="#ffd08a" strokeWidth=".5" strokeLinejoin="round" /></g>)}
    <path d={VINE} stroke="#0b3816" strokeWidth="2.4" strokeLinecap="round" />
    <path d={VINE} stroke="#3fa34d" strokeWidth="1.3" strokeLinecap="round" />
    {VINE_LEAVES.map(leaf => <path key={leaf.angle} d={blade(leaf.angle, 7, 2.8, .1, leaf.at)} fill={`url(#${id}-leaf)`} stroke="#072a10" strokeWidth=".4" />)}
    <circle cx="50" cy="50" r="49.8" stroke="#ff5a1a" strokeWidth="1.4" />
    <g transform={`translate(${polar(78, 222).join(' ')}) rotate(42) scale(1.7)`}><Fist id={id} /></g>
    <g transform={`translate(${polar(78, 138).join(' ')}) rotate(-42) scale(-1.7 1.7)`}><g style={fx(-.65)}><Fist id={id} /></g></g>
  </>;
}

// Jaguar: a golden spotted pelt that becomes a head — ears, watching green eyes and fangs closing over the portrait.
const PELT_EDGE = `${ringPath(angle => 62.6 + Math.sin((angle * 30 * Math.PI) / 180) * .7, 3)}${hole(49.6)}`;
// One path for all the hairs: 72 separate strokes would weigh down every avatar with this frame.
const FUR = Array.from({ length: 72 }, (_, index) => { const angle = index * 5 + noise(index + 700) * 2; return line([polar(61, angle), polar(64.4 + noise(index + 740) * 1.6, angle + 3)]); }).join('');
const ROSETTES = Array.from({ length: 24 }, (_, index) => {
  const angle = index * 15 + (noise(index + 50) - .5) * 6;
  return { at: polar([53.4, 57.6, 61][index % 3]!, angle), size: round(1.7 + noise(index + 90) * .8), turn: Math.round(noise(index + 130) * 90) };
}).filter(item => Math.hypot(item.at[0] - 50, item.at[1] + 7) > 22);
const FANG = 'M-3.4 0C-3.4 5.6-1.5 10 .6 14C1.1 10 3 5.6 3.4 0Z';
const JAGUAR_SLASHES = [-7, 0, 7].map(shift => { const at = (radius: number, side: number): Point => [50 + Math.SQRT1_2 * radius + Math.SQRT1_2 * side, 50 + Math.SQRT1_2 * radius - Math.SQRT1_2 * side]; return lens(at(72, shift - 4), at(100, shift + 4), 2.6); });
function Jaguar({ id }: { id: string }) {
  return <>
    <defs>
      <radialGradient id={`${id}-pelt`} cx="50" cy="50" r="67" gradientUnits="userSpaceOnUse"><stop offset=".74" stopColor="#6e3604" /><stop offset=".82" stopColor="#f0a531" /><stop offset=".9" stopColor="#ffd98a" /><stop offset="1" stopColor="#b8690d" /></radialGradient>
      <linearGradient id={`${id}-fang`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#cfc4a4" /><stop offset=".45" stopColor="#fffdf3" /><stop offset="1" stopColor="#f2ecd8" /></linearGradient>
      <radialGradient id={`${id}-eye`} cx=".5" cy=".5" r=".55"><stop offset="0" stopColor="#f4ff9a" /><stop offset=".55" stopColor="#3bdc5a" /><stop offset="1" stopColor="#0a5a24" /></radialGradient>
    </defs>
    {JAGUAR_SLASHES.map((slash, index) => <path key={slash} className="frame-fx frame-rip" d={slash} fill="#ffcf5a" stroke="#5a2e02" strokeWidth=".5" style={fx(-index * .25)} />)}
    {[1, -1].map(side => <g key={side} transform={side < 0 ? MIRROR : undefined}>
      <polygon points={points([polar(61, 24), polar(90, 40), polar(60, 56)])} fill={`url(#${id}-pelt)`} stroke="#3a1d02" strokeWidth=".8" strokeLinejoin="round" />
      <polygon points={points([polar(63, 30), polar(83, 40.6), polar(62.5, 50)])} fill="#2a1402" />
      <polygon points={points([polar(64.5, 34), polar(78, 41), polar(64, 46.5)])} fill="#e9a68a" opacity=".6" />
      <path d={line([polar(86, 38), polar(93, 37), polar(88, 41), polar(94, 42)])} stroke="#3a1d02" strokeWidth=".7" strokeLinejoin="round" />
    </g>)}
    <path d={FUR} stroke="#8a4a08" strokeWidth="1.6" strokeLinecap="round" />
    <path d={PELT_EDGE} fillRule="evenodd" fill={`url(#${id}-pelt)`} stroke="#3a1d02" strokeWidth=".6" strokeLinejoin="round" />
    <path d={FUR} stroke="#ffd98a" strokeWidth=".55" strokeLinecap="round" />
    {ROSETTES.map(rosette => <g key={rosette.at.join()} transform={`translate(${rosette.at.join(' ')}) rotate(${rosette.turn})`}>
      <circle r={round(rosette.size * .62)} fill="#a8580a" />
      <circle r={rosette.size} stroke="#1a0c02" strokeWidth={round(rosette.size * .58)} strokeDasharray={`${round(rosette.size * 1.6)} ${round(rosette.size * .7)}`} />
    </g>)}
    {[1, -1].map(side => <g key={side} transform={`translate(${polar(57.4, side * 13).join(' ')}) rotate(${side * 16})`}>
      <path d="M-7.6-3.6Q0-7.4 7.6-3.2" stroke="#2a1402" strokeWidth="1.4" strokeLinecap="round" transform={side < 0 ? 'scale(-1 1)' : undefined} />
      <ellipse rx="6.4" ry="3.6" fill="#1a0c02" />
      <g className="frame-fx frame-blink"><ellipse rx="5.2" ry="2.8" fill={`url(#${id}-eye)`} /><ellipse rx=".85" ry="2.6" fill="#050200" /><circle cx="-1.8" cy="-1" r=".7" fill="#fff" /></g>
    </g>)}
    <circle cx="50" cy="50" r="50" stroke="#2a1402" strokeWidth="1.6" />
    {[[-16, 1, 1], [16, 1, -1], [164, .82, 1], [196, .82, -1]].map(([angle, scale, side]) => <g key={angle} transform={onRing(58, angle!, scale)}>
      <path d={FANG} transform={`scale(${side} 1)`} fill={`url(#${id}-fang)`} stroke="#4a3a1a" strokeWidth=".55" strokeLinejoin="round" />
    </g>)}
  </>;
}

// Volt Energy: a copper coil, four electrode spheres in the corners and plasma arcs jumping between them.
const NODES = [45, 135, 225, 315];
const PLASMA = NODES.flatMap((from, index) => [0, 1].map(variant => ({
  d: line(Array.from({ length: 15 }, (_, step) => polar(step === 0 || step === 14 ? 74 : 79 + (noise(index * 40 + step + variant * 17) - .5) * 10, from + 6 + step * (78 / 14)))),
  delay: -round(index * .45 + variant * .9),
})));
const SPURS = NODES.map((angle, index) => ({ d: line([polar(70, angle - 4), polar(66.5, angle + 3 + noise(index) * 3), polar(64, angle - 2)]), delay: -round(index * .3) }));
function Volt({ id }: { id: string }) {
  return <>
    <defs>
      <linearGradient id={`${id}-copper`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffd2a3" /><stop offset=".35" stopColor="#c46a2b" /><stop offset=".65" stopColor="#f0a467" /><stop offset="1" stopColor="#6e2f0c" /></linearGradient>
      <radialGradient id={`${id}-sphere`} cx=".35" cy=".3" r=".75"><stop offset="0" stopColor="#ffffff" /><stop offset=".35" stopColor="#c7d3e3" /><stop offset=".8" stopColor="#5b6680" /><stop offset="1" stopColor="#2a3045" /></radialGradient>
      <radialGradient id={`${id}-halo`} cx=".5" cy=".5" r=".5"><stop offset=".25" stopColor="#3cf2ff" stopOpacity=".95" /><stop offset="1" stopColor="#8b5cff" stopOpacity="0" /></radialGradient>
    </defs>
    {PLASMA.map(item => <g key={item.d} className="frame-fx frame-arc" style={fx(item.delay)}>
      <path d={item.d} stroke="#8b5cff" strokeWidth="3.4" strokeLinejoin="round" strokeOpacity=".55" />
      <path d={item.d} stroke="#3cf2ff" strokeWidth="1.6" strokeLinejoin="round" />
      <path d={item.d} stroke="#fff" strokeWidth=".55" strokeLinejoin="round" />
    </g>)}
    {SPURS.map(spur => <path key={spur.d} className="frame-fx frame-crackle" d={spur.d} stroke="#c9fbff" strokeWidth=".9" strokeLinejoin="round" style={fx(spur.delay)} />)}
    {NODES.map(angle => <g key={angle} transform={onRing(61, angle)}>
      <path d="M-2.4 0V-10H2.4V0Z" fill="#9aa4b5" stroke="#2a3045" strokeWidth=".5" />
      <path d="M-4-2.4H4M-4-5H4M-4-7.6H4" stroke="#2a3045" strokeWidth="1.1" strokeLinecap="round" />
      <circle className="frame-fx frame-pulse" cy="-16" r="11" fill={`url(#${id}-halo)`} />
      <circle cy="-16" r="6.4" fill={`url(#${id}-sphere)`} stroke="#1a1f30" strokeWidth=".6" />
    </g>)}
    <circle cx="50" cy="50" r="55.6" stroke="#1b1b2e" strokeWidth="12.6" />
    <circle cx="50" cy="50" r="55.6" stroke={`url(#${id}-copper)`} strokeWidth="9.6" />
    <circle cx="50" cy="50" r="55.6" stroke="#4a1e06" strokeWidth="9.6" strokeDasharray=".6 1.1" strokeOpacity=".7" />
    <circle cx="50" cy="50" r="58.2" stroke="#ffe0c2" strokeOpacity=".6" strokeWidth=".6" />
    <circle className="frame-fx frame-sweep" cx="50" cy="50" r="55.6" pathLength={100} stroke="#3cf2ff" strokeOpacity=".7" strokeWidth="9.6" strokeDasharray="2 23" />
    <circle cx="50" cy="50" r="50.2" stroke="#3cf2ff" strokeWidth="1.4" />
    <circle cx="50" cy="50" r="61.3" stroke="#8b5cff" strokeWidth="1" />
  </>;
}

// Tornado: wind ribbons spinning round the portrait with debris caught in them and a funnel touching down below.
const WINDS = [
  { radius: 61, speed: 'fast', opacity: .95, ribbons: [[0, 110, 6.4], [120, 230, 5.4], [240, 350, 6.4]] },
  { radius: 67, speed: 'mid', opacity: .75, ribbons: [[40, 150, 5.4], [165, 270, 4.6], [290, 395, 5.4]] },
  { radius: 73, speed: 'slow', opacity: .55, ribbons: [[80, 170, 4.4], [200, 290, 3.8], [318, 410, 4.4]] },
] as const;
const FUNNEL = [[104, 28, 3], [108.5, 22.4, 2.6], [112.6, 17.4, 2.2], [116.4, 13, 1.8], [120, 9.4, 1.5], [123.2, 6.4, 1.2], [126.2, 4, .9]] as const;
const CLOUD = [[-7, 2, 7], [0, -3, 8.4], [8, 1, 7.4], [14, 4, 5.4], [-12, 6, 5], [3, 6, 7]] as const;
const CLOUD_BOLT = 'M1-1-4 7H0L-3 15 5 5H1L4-1Z';
function Tornado({ id }: { id: string }) {
  return <>
    <defs>
      <linearGradient id={`${id}-storm`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6b8396" /><stop offset=".5" stopColor="#1c2a36" /><stop offset="1" stopColor="#0b1218" /></linearGradient>
      <linearGradient id={`${id}-funnel`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9db4c8" /><stop offset="1" stopColor="#3a4c5c" /></linearGradient>
      <linearGradient id={`${id}-wind`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#b9dcff" /></linearGradient>
    </defs>
    <path d="M14 98Q33 110 40 121Q45.6 130 50 130Q54.4 130 60 121Q67 110 86 98Z" fill={`url(#${id}-funnel)`} stroke="#2a3946" strokeWidth=".6" />
    <g className="frame-fx frame-twist">
      {FUNNEL.map(([y, rx, ry], index) => <ellipse key={y} className="frame-fx frame-funnel" cx="50" cy={y} rx={rx} ry={ry} pathLength={100} stroke="#eef6ff" strokeOpacity=".85" strokeWidth={round(1.3 - index * .08)} strokeDasharray="36 14" style={fx(-index * .15)} />)}
    </g>
    <circle cx="50" cy="50" r="54" stroke="#0b1218" strokeWidth="9.4" />
    <circle cx="50" cy="50" r="54" stroke={`url(#${id}-storm)`} strokeWidth="8" />
    <circle cx="50" cy="50" r="50.2" stroke="#7fe3ff" strokeWidth="1.4" />
    {WINDS.map(wind => <g key={wind.radius} className={`frame-fx frame-whirl frame-whirl-${wind.speed}`}>
      <circle cx="50" cy="50" r={wind.radius + 5} stroke="none" />
      {wind.ribbons.map(([from, to, width]) => <path key={from} d={crescent(wind.radius, from, to, width)} fill={`url(#${id}-wind)`} fillOpacity={wind.opacity} stroke="#2a3946" strokeOpacity=".5" strokeWidth=".4" />)}
      {wind.radius === 67 && <>
        <g transform={`translate(${polar(67, 25).join(' ')}) rotate(30)`}><rect x="-2.2" y="-3.8" width="4.4" height="7.6" rx="1" fill="#006eff" stroke="#0b1218" strokeWidth=".4" /><rect x="-2.2" y="-3.8" width="4.4" height="1.3" fill="#c9d1d8" /></g>
        <g transform={`translate(${polar(67, 155).join(' ')}) rotate(-40)`}><path d={blade(0, 7, 2.6, .1, [-3.5, 0])} fill="#5cc46a" stroke="#0c3d17" strokeWidth=".35" /></g>
        <g transform={`translate(${polar(67, 280).join(' ')}) rotate(15)`}><polygon points="-2.6,-1.4 .8,-2.8 2.8,0 1.2,2.6 -2.2,1.8" fill="#8a8f96" stroke="#2a2e33" strokeWidth=".4" /></g>
      </>}
      {wind.radius === 73 && <>
        <g transform={`translate(${polar(73, 60).join(' ')}) rotate(70)`}><path d={blade(0, 6.4, 2.4, -.1, [-3.2, 0])} fill="#e0a53a" stroke="#6b4a10" strokeWidth=".35" /></g>
        <g transform={`translate(${polar(73, 300).join(' ')}) rotate(-25)`}><rect x="-4" y="-1" width="8" height="2" fill="#a0703a" stroke="#4a3010" strokeWidth=".35" /></g>
      </>}
    </g>)}
    <g transform={`translate(${polar(90, 312).join(' ')})`}>
      <g transform="translate(0 6)"><path className="frame-fx frame-crackle" d={CLOUD_BOLT} fill="#fff6a8" stroke="#2a3946" strokeWidth=".5" strokeLinejoin="round" style={fx(-.6)} /></g>
      {CLOUD.map(([x, y, r]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#24323e" stroke="#0b1218" strokeWidth=".6" />)}
      {CLOUD.map(([x, y, r]) => <circle key={`${x}-${y}-top`} cx={round(x - r * .2)} cy={round(y - r * .3)} r={round(r * .62)} fill="#5f778b" opacity=".75" />)}
    </g>
    <Glint at={polar(84, 45)} scale={.36} delay={-1.4} />
  </>;
}

// Burn: an obsidian ring cracked with molten veins, fire climbing off its upper half and lava dripping below.
const OBSIDIAN = `${ringPath(angle => 61.4 + noise(angle + 70) * 3, 6)}${hole(49.4)}`;
const VEINS = [[10, 4], [55, 5], [100, 6], [150, 7], [205, 8], [255, 9], [300, 10], [340, 11]].map(([angle, seed]) => line([0, 1, 2, 3, 4, 5].map(step => polar(50.4 + step * 2.2, angle! + (noise(seed! * 7 + step) - .5) * 10 + step * 1.4))));
// Each flame is as tall as the room above it allows, so the fire crowns the ring and towers on its shoulders.
const BURN_FLAMES = Array.from({ length: 24 }, (_, index) => {
  const angle = -104 + index * 9, back = index % 2 === 0;
  const [x, y] = polar(61, angle), room = Math.min(40, y + 31);
  return { x, y: round(y + 2.4), h: round(room * (back ? .92 : .62) * (.82 + noise(index + 900) * .18)), w: round((back ? 5.6 : 4.4) + Math.cos((angle * Math.PI) / 180) * 1.6), delay: -round(noise(index + 940) * 1.4), back };
});
const LAVA = [[34, 8, -.4], [42, 12, 0], [50, 15, -1.4], [58, 10, -.7], [66, 7, -2]] as const;
const BURN_EMBERS = Array.from({ length: 12 }, (_, index) => {
  const [x, y] = polar(72 + noise(index + 300) * 16, -80 + index * 14 + (noise(index + 320) - .5) * 8);
  return { x, y, r: round(.7 + noise(index + 340) * .9), dx: round((noise(index + 360) - .5) * 6), delay: -round(noise(index + 380) * 3.2) };
});
function BurnFlames({ id, back }: { id: string; back: boolean }) {
  return <>{BURN_FLAMES.filter(flame => flame.back === back).map(flame => <g key={flame.x} transform={`translate(${flame.x} ${flame.y})`}>
    <g className="frame-fx frame-flame" style={fx(flame.delay)}>
      <path d={flamePath(flame.h, flame.w)} fill={`url(#${id}-fire)`} />
      <path d={flamePath(flame.h * .55, flame.w * .5)} fill="#ffe08a" />
    </g>
  </g>)}</>;
}
function BurnDefs({ id }: { id: string }) {
  return <defs>
    <linearGradient id={`${id}-fire`} x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#ff4d00" /><stop offset=".5" stopColor="#ff8a1e" /><stop offset=".85" stopColor="#e3260b" /><stop offset="1" stopColor="#8f1503" stopOpacity=".7" /></linearGradient>
    <linearGradient id={`${id}-rock`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#55392c" /><stop offset=".4" stopColor="#120a07" /><stop offset=".75" stopColor="#2e1a11" /><stop offset="1" stopColor="#050302" /></linearGradient>
    <radialGradient id={`${id}-heat`} cx="50" cy="44" r="80" gradientUnits="userSpaceOnUse"><stop offset=".62" stopColor="#ff5a0a" stopOpacity="0" /><stop offset=".74" stopColor="#ff5a0a" stopOpacity=".55" /><stop offset="1" stopColor="#ff5a0a" stopOpacity="0" /></radialGradient>
  </defs>;
}
function BurnBack({ id }: { id: string }) {
  return <><BurnDefs id={id} /><circle className="frame-fx frame-pulse" cx="50" cy="46" r="80" fill={`url(#${id}-heat)`} /><BurnFlames id={id} back /></>;
}
function Burn({ id }: { id: string }) {
  return <>
    <BurnDefs id={id} />
    <BurnFlames id={id} back={false} />
    <path d={OBSIDIAN} fillRule="evenodd" fill={`url(#${id}-rock)`} stroke="#000" strokeWidth=".7" strokeLinejoin="round" />
    {VEINS.map(vein => <g key={vein}><path d={vein} stroke="#ff4d00" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" /><path className="frame-fx frame-glow" d={vein} stroke="#ffe08a" strokeWidth=".9" strokeLinejoin="round" strokeLinecap="round" /></g>)}
    <circle cx="50" cy="50" r="50" stroke="#ff6a12" strokeWidth="1.6" />
    {LAVA.map(([x, length, delay]) => {
      const y = round(bottomAt(61.4, x) - 1.6);
      return <g key={x}>
        <path d={`M${x - 2.8} ${y}Q${x - 2} ${round(y + length * .7)} ${x} ${y + length}Q${x + 2} ${round(y + length * .7)} ${x + 2.8} ${y}Z`} fill="#ff6a12" stroke="#7a1203" strokeWidth=".4" />
        <path d={`M${x - .8} ${y + 1}Q${x - .5} ${round(y + length * .5)} ${x} ${round(y + length * .8)}`} stroke="#ffe08a" strokeWidth=".6" strokeLinecap="round" />
        {length > 9 && <g transform={`translate(${x} ${round(y + length + 2.4)})`}><path className="frame-fx frame-fall" d={DROP} transform="scale(1.2)" fill="#ffb03a" stroke="#7a1203" strokeWidth=".3" style={fx(delay)} /></g>}
      </g>;
    })}
    {BURN_EMBERS.map(ember => <circle key={`${ember.x}-${ember.y}`} className="frame-fx frame-rise" cx={ember.x} cy={ember.y} r={ember.r} fill="#ffd27a" style={fx(ember.delay, { '--dx': `${ember.dx}px` })} />)}
  </>;
}

// Lit Energy: a marquee of chasing bulbs between neon tubes, a neon flame sign on top and neon bolts in the corners.
const BULBS = Array.from({ length: 24 }, (_, index) => ({ at: polar(56.2, index * 15), phase: index % 3 }));
const NEON_FLAME = 'M0 0C-6 0-8.4-4.6-6.8-8.8-6-11-4.2-12.2-4.4-15.4-2-13.8-1.2-11.6-1.4-9.6-.2-12.4 1.4-15.6.8-19.4 4.6-17 7.6-12.6 7.2-7.6 6.9-3.2 4.4 0 0 0Z';
const NEON_BOLT = 'M2-9-4-1H0L-2 9 4 1H0Z';
const LIT_STARS = [{ at: polar(92, 300), size: 5, color: '#22e6ff', delay: 0 }, { at: polar(94, 60), size: 4.4, color: '#ffd23a', delay: -1.6 }];
function Lit() {
  return <>
    <path d={annulus(49.4, 63)} fillRule="evenodd" fill="#160924" />
    <circle cx="50" cy="50" r="56.2" stroke="#2c1446" strokeWidth="8.4" />
    <circle cx="50" cy="50" r="56.2" stroke="#4a2470" strokeWidth="8.4" strokeDasharray="1 2.93" strokeOpacity=".6" />
    {BULBS.map(bulb => <g key={bulb.at.join()} transform={`translate(${bulb.at.join(' ')})`}>
      <circle r="2.8" fill="#0d0516" />
      <circle r="2.3" fill="#6a3418" />
      <g className="frame-fx frame-chase" style={fx(-bulb.phase * .4)}><circle r="2.3" fill="#fff1c4" /><circle r="1" fill="#fff" /></g>
    </g>)}
    <path className="frame-fx frame-neon" d={annulus(64.6, 68)} fillRule="evenodd" fill="#ff2bd6" opacity=".25" />
    <circle className="frame-fx frame-neon" cx="50" cy="50" r="66.3" stroke="#ff2bd6" strokeWidth="3" />
    <circle className="frame-fx frame-neon" cx="50" cy="50" r="66.3" stroke="#ffe0fa" strokeWidth="1" />
    <path d={arc(71.4, 100, 160)} stroke="#22e6ff" strokeWidth="2.2" strokeLinecap="round" /><path d={arc(71.4, 100, 160)} stroke="#e0fdff" strokeWidth=".7" strokeLinecap="round" />
    <path d={arc(71.4, 200, 260)} stroke="#22e6ff" strokeWidth="2.2" strokeLinecap="round" /><path d={arc(71.4, 200, 260)} stroke="#e0fdff" strokeWidth=".7" strokeLinecap="round" />
    <circle cx="50" cy="50" r="50.2" stroke="#22e6ff" strokeWidth="2.2" />
    <circle cx="50" cy="50" r="50.2" stroke="#e0fdff" strokeWidth=".7" />
    <g transform="translate(50 -10) scale(1.2)"><g className="frame-fx frame-neon-sign">
      <path d={NEON_FLAME} stroke="#ff8a1e" strokeWidth="2.6" strokeLinejoin="round" fill="#160924" />
      <path d={NEON_FLAME} stroke="#ffe8cc" strokeWidth=".8" strokeLinejoin="round" />
      <path d={NEON_FLAME} transform="translate(0 -1.6) scale(.45)" stroke="#22e6ff" strokeWidth="1.8" strokeLinejoin="round" />
    </g></g>
    {[[polar(90, 135), 1.4, -12], [polar(90, 225), 1.4, 12]].map(([at, scale, turn], index) => <g key={index} transform={`translate(${(at as Point).join(' ')}) rotate(${turn}) scale(${scale})`}><g className="frame-fx frame-neon" style={fx(-index * 1.7)}>
      <path d={NEON_BOLT} stroke="#ffd23a" strokeWidth="1.6" strokeLinejoin="round" /><path d={NEON_BOLT} stroke="#fff6cc" strokeWidth=".5" strokeLinejoin="round" />
    </g></g>)}
    {LIT_STARS.map(item => <g key={item.color} transform={`translate(${item.at.join(' ')})`}><g className="frame-fx frame-spark" style={fx(item.delay)}>
      <path d={star(4, item.size, round(item.size * .3))} stroke={item.color} strokeWidth="1.1" strokeLinejoin="round" />
    </g></g>)}
  </>;
}

// Drive Me: the portrait rides in a spinning tyre on a chrome rim, a chequered flag waving, speed lines and smoke behind.
const CHECKS = Array.from({ length: 24 }, (_, index) => ({ x: (index % 6) * 3.6, y: Math.floor(index / 6) * 3.4, dark: (index % 6 + Math.floor(index / 6)) % 2 === 0 }));
const SMOKE = [[-6, 104, 4.4, 0], [-14, 96, 3.4, -.8], [2, 112, 3.8, -1.6]] as const;
function Drive({ id }: { id: string }) {
  return <>
    <defs>
      <linearGradient id={`${id}-chrome`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset=".3" stopColor="#8e98a6" /><stop offset=".55" stopColor="#f4f6f9" /><stop offset=".8" stopColor="#4d5663" /><stop offset="1" stopColor="#c9d0d8" /></linearGradient>
      <linearGradient id={`${id}-rubber`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#45454b" /><stop offset=".5" stopColor="#121214" /><stop offset="1" stopColor="#2a2a2e" /></linearGradient>
      <radialGradient id={`${id}-smoke`} cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#d9dde3" stopOpacity=".9" /><stop offset="1" stopColor="#d9dde3" stopOpacity="0" /></radialGradient>
    </defs>
    {[[-28, 30, 16, 0], [-30, 40, 22, -.22], [-27, 50, 14, -.44], [-30, 60, 20, -.66], [-26, 70, 12, -.88]].map(([x, y, length, delay]) => <path key={y} className="frame-fx frame-streak" d={`M${x} ${y}h${length}`} stroke="#c9d0d8" strokeWidth="1.6" strokeLinecap="round" style={fx(delay!)} />)}
    {SMOKE.map(([x, y, r, delay]) => <circle key={x} className="frame-fx frame-rise" cx={x} cy={y} r={r} fill={`url(#${id}-smoke)`} style={fx(delay, { '--dx': '-6px' })} />)}
    <g transform={`translate(${polar(68, 40).join(' ')}) rotate(16)`}>
      <path d="M0 4V-26" stroke="#2a2f37" strokeWidth="2" strokeLinecap="round" /><path d="M0 4V-26" stroke="#d9dfe6" strokeWidth="1" strokeLinecap="round" />
      <circle cy="-26.4" r="1.4" fill="#ffcc00" stroke="#7a5a00" strokeWidth=".3" />
      <g transform="translate(.8 -25.4)"><g className="frame-fx frame-flag">
        {CHECKS.map(check => <rect key={`${check.x}-${check.y}`} x={check.x} y={check.y} width="3.7" height="3.5" fill={check.dark ? '#111' : '#fff'} />)}
        <rect width="21.6" height="13.6" stroke="#111" strokeWidth=".6" />
      </g></g>
    </g>
    <circle cx="50" cy="50" r="62" stroke={`url(#${id}-rubber)`} strokeWidth="14" />
    <circle className="frame-fx frame-roll" cx="50" cy="50" r="67.6" pathLength={100} stroke="#060607" strokeWidth="3.4" strokeDasharray="1.2 .8" />
    <circle cx="50" cy="50" r="69" stroke="#000" strokeWidth=".6" />
    <circle className="frame-fx frame-roll" cx="50" cy="50" r="64.4" pathLength={100} stroke="#4a4a52" strokeWidth=".8" strokeDasharray="1.2 .8" />
    <circle cx="50" cy="50" r="61.2" stroke="#fff" strokeOpacity=".3" strokeWidth="1" strokeDasharray="5 3 2 3" />
    <circle cx="50" cy="50" r="58.4" stroke="#ff1e2d" strokeWidth="1.4" />
    <circle cx="50" cy="50" r="52.4" stroke="#2a2f37" strokeWidth="6.4" />
    <circle cx="50" cy="50" r="52.4" stroke={`url(#${id}-chrome)`} strokeWidth="5.2" />
    {Array.from({ length: 10 }, (_, index) => { const [x, y] = polar(52.4, index * 36 + 18); return <g key={index}><circle cx={x} cy={y} r="1.5" fill="#2a2f37" /><circle cx={x} cy={y} r=".85" fill="#e3e8ee" /></g>; })}
    <circle cx="50" cy="50" r="49.8" stroke="#ff1e2d" strokeWidth="1.2" />
    {[[106, 108, 7, 0], [111, 103, 5, -.35], [102, 113, 6, -.7], [109, 110, 4, -1.05]].map(([x, y, length, delay]) => <path key={`${x}-${y}`} className="frame-fx frame-ember" d={`M${x} ${y}l${length} ${round(-length! * .45)}`} stroke="#ffb03a" strokeWidth="1.1" strokeLinecap="round" style={fx(delay!, { '--dx': '5px', '--dy': '-3px' })} />)}
  </>;
}

const FRONT: Record<BrandFrame, (id: string) => ReactNode> = {
  monster: id => <Monster id={id} />, redbull: id => <RedBull id={id} />, flashup: id => <FlashUp id={id} />, adrenaline: id => <Adrenaline id={id} />,
  gorilla: id => <Gorilla id={id} />, jaguar: id => <Jaguar id={id} />, volt: id => <Volt id={id} />, tornado: id => <Tornado id={id} />,
  burn: id => <Burn id={id} />, lit: () => <Lit />, drive: id => <Drive id={id} />,
};
const BACK: Partial<Record<BrandFrame, (id: string) => ReactNode>> = { burn: id => <BurnBack id={id} /> };

export function BrandAvatarFrame({ frame }: { frame: BrandFrame }) {
  const id = `frame${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const back = BACK[frame];
  return <>
    {back && <svg className={`avatar-frame avatar-frame-heavy avatar-frame-brand avatar-frame-back avatar-frame-${frame}`} viewBox={HEAVY_VIEW} fill="none" aria-hidden="true" focusable="false">{back(id)}</svg>}
    <svg className={`avatar-frame avatar-frame-heavy avatar-frame-brand avatar-frame-${frame}`} viewBox={HEAVY_VIEW} fill="none" aria-hidden="true" focusable="false">{FRONT[frame](`${id}f`)}</svg>
  </>;
}
