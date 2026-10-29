import type { CSSProperties } from 'react';
import { HeavyAvatarFrame, isHeavyFrame } from '@/components/avatar-frame-heavy';
import type { ProfileAppearance } from '@/lib/profile-appearance';

type Spark = { x: number; y: number; scale: number; delay: number; embers?: [number, number][] };

const STAR = 'M0-10Q1-1 10 0Q1 1 0 10Q-1 1-10 0Q-1-1 0-10Z';
const HEART = 'M0 3.4C-4.8.2-5.4-3.4-2.7-4.5-1.3-5 0-4.1 0-2.9 0-4.1 1.3-5 2.7-4.5 5.4-3.4 4.8.2 0 3.4Z';
const TENDRIL = 'M-2 0C-1.6-4-.4-7 1.4-11C.4-6.5.9-3.5 2 0Z';
const SPARKS: Spark[] = [
  { x: 16, y: 14, scale: 1.2, delay: 0, embers: [[-8, -6], [-2, -9], [-9, 1]] },
  { x: 86, y: 81, scale: .85, delay: -1.7, embers: [[7, 6], [1, 9], [9, -1]] },
  { x: 88, y: 21, scale: .52, delay: -3.2 },
  { x: 9, y: 70, scale: .42, delay: -2.4 },
];
const BOLTS = [
  { delay: 0, main: 'M6.4 43.9 4.1 37.7 11.8 33.8 10.1 26 17.7 23.9 17.9 15.6 26.2 16 28.9 8.6 36.5 10.7 41.4 5.8', branch: 'M17.9 15.6 12.2 12.6 13.4 8 9 4.8', tip: [41.4, 5.8] },
  { delay: -2.2, main: 'M93.6 56.1 95.9 62.3 88.2 66.2 89.9 74 82.3 76.1 82.1 84.4 73.8 84 71.1 91.4 63.5 89.3 58.6 94.2', branch: 'M82.1 84.4 87.8 87.4 86.6 92 91 95.2', tip: [58.6, 94.2] },
] as const;
const BLUSH = ['M8 55 5 65', 'M14 54 11 66', 'M20 55 17 65', 'M83 55 80 65', 'M89 54 86 66', 'M95 55 92 65'];
const TENDRILS = [
  { angle: 125, scale: .85, delay: -2.2 }, { angle: 150, scale: 1.1, delay: 0 }, { angle: 175, scale: 1.4, delay: -.9 },
  { angle: 200, scale: 1.05, delay: -1.7 }, { angle: 225, scale: .9, delay: -.5 }, { angle: 62, scale: .65, delay: -1.3 }, { angle: 298, scale: .7, delay: -2.6 },
];
const ABYSS_EMBERS = [{ x: 3, y: 63, dx: -2, delay: 0 }, { x: 8, y: 78, dx: -3, delay: -1.1 }, { x: 97, y: 63, dx: 2, delay: -.6 }, { x: 92, y: 78, dx: 3, delay: -1.9 }, { x: 26, y: 93, dx: -4, delay: -2.5 }, { x: 74, y: 93, dx: 4, delay: -1.5 }];
const NOVA_COLORS = ['#ff3d9a', '#ff8a1e', '#ffd23a', '#3ce8ff', '#7c5cff'];

const BAT = 'M0 0C-2-3-5-3.6-8-2.4-6.6-1.8-6-.6-6.2.8-4.6-.4-3-.2-1.8 1.2-1.2.2-.5 0 0 .6.5 0 1.2.2 1.8 1.2 3-.2 4.6-.4 6.2.8 6-.6 6.6-1.8 8-2.4 5-3.6 2-3 0 0Z';
const BATS = [{ x: 15, y: 16, scale: 1, delay: 0 }, { x: 88, y: 26, scale: .7, delay: -.45 }, { x: 93, y: 56, scale: .55, delay: -.9 }];

/** «Тыквенная» — эксклюзив Тыквенного автомата: оранжевое кольцо-лоза, тыква со светящимся лицом и летучие мыши. */
function PumpkinFrame() {
  return <>
    <circle className="frame-pumpkin-ring" cx="50" cy="50" r="44" stroke="currentColor" strokeWidth="2.4" strokeDasharray="10 3 2 3" strokeLinecap="round" />
    <path className="frame-pumpkin-vine" d="M62 7C70 3 76 6 77 11M38 95C32 99 26 98 24 93" stroke="#3f8f3a" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M75 9C78 6 82 7 82 10C79 11 77 11 75 9Z" fill="#3f8f3a" />
    {BATS.map(bat => <g key={`${bat.x}-${bat.y}`} transform={`translate(${bat.x} ${bat.y}) scale(${bat.scale})`}>
      <g className="frame-fx frame-bat" style={fx(bat.delay)}><path d={BAT} fill="#2a1f3d" /><circle cx="-.9" cy=".3" r=".35" fill="#ffcf4a" /><circle cx=".9" cy=".3" r=".35" fill="#ffcf4a" /></g>
    </g>)}
    <g transform="translate(17 83)">
      <g className="frame-fx frame-pumpkin">
        <path d="M0-9.5C1-12 2.5-12.8 3.6-12.4" stroke="#3f8f3a" strokeWidth="1.8" strokeLinecap="round" />
        <ellipse cx="-5" cy="0" rx="6" ry="8.5" fill="#e86a10" />
        <ellipse cx="5" cy="0" rx="6" ry="8.5" fill="#e86a10" />
        <ellipse cx="0" cy="0" rx="6.4" ry="9.2" fill="#ff8a1e" stroke="#c4560a" strokeWidth=".8" />
        <g className="frame-fx frame-pumpkin-face" fill="#ffe27a">
          <path d="M-5.6-2.6-3.2-5.4-1.4-2.6Z" /><path d="M5.6-2.6 3.2-5.4 1.4-2.6Z" />
          <path d="M-6 1.6C-3 5.6 3 5.6 6 1.6L3.6 2.8 2.4 1.4 1 3 0 1.6-1 3-2.4 1.4-3.6 2.8Z" />
        </g>
      </g>
    </g>
  </>;
}

const fx = (delay: number, extra: Record<string, string> = {}) => ({ '--fx-delay': `${delay}s`, ...extra }) as CSSProperties;

function SparkGlint({ delay }: { delay?: number }) {
  return <g className="frame-fx frame-spark" style={delay === undefined ? undefined : fx(delay)}>
    <path className="frame-fx frame-spark-flare" d="M-14 0H14M0-14V14" stroke="currentColor" strokeWidth=".5" strokeLinecap="round" />
    <path d={STAR} fill="currentColor" />
    <path d={STAR} transform="rotate(45) scale(.45)" fill="currentColor" opacity=".85" />
    <path className="frame-core" d={STAR} transform="scale(.32)" />
    <circle className="frame-core" r="1.1" />
  </g>;
}

// Stable preset keys preserve previously saved selections.
export function AvatarFrame({ frame }: { frame: ProfileAppearance['frame'] }) {
  if (frame === 'none') return null;
  if (isHeavyFrame(frame)) return <HeavyAvatarFrame frame={frame} />;
  const ring = frame === 'abyss' || frame === 'nova';
  if (frame === 'pumpkin') return <svg className="avatar-frame avatar-frame-pumpkin" viewBox="0 0 100 100" fill="none" aria-hidden="true" focusable="false"><PumpkinFrame /></svg>;
  return <>
    {ring && <span className={`avatar-ring avatar-ring-${frame}`} aria-hidden="true"><span className="avatar-ring-band" /></span>}
    <svg className={`avatar-frame avatar-frame-${frame}`} viewBox="0 0 100 100" fill="none" aria-hidden="true" focusable="false">
      {frame === 'orbit' ? <g strokeLinecap="round" strokeLinejoin="round">
        {BOLTS.map(bolt => <g key={bolt.main} className="frame-fx frame-bolt" style={fx(bolt.delay)}>
          {[bolt.main, bolt.branch].map(d => <g key={d}>
            <path className="frame-fx frame-bolt-line" d={d} pathLength={1} stroke="currentColor" strokeWidth={d === bolt.main ? 1.8 : 1.2} />
            <path className="frame-fx frame-bolt-line frame-core-stroke" d={d} pathLength={1} strokeWidth={d === bolt.main ? .7 : .45} />
          </g>)}
          <circle className="frame-fx frame-bolt-tip frame-core" cx={bolt.tip[0]} cy={bolt.tip[1]} r="1.6" />
        </g>)}
      </g> : frame === 'pulse' ? <>
        {SPARKS.map(spark => <g key={`${spark.x}-${spark.y}`} style={fx(spark.delay)}>
          <g transform={`translate(${spark.x} ${spark.y}) scale(${spark.scale})`}><SparkGlint /></g>
          {spark.embers?.map(([dx, dy]) => <path key={`${dx}-${dy}`} className="frame-fx frame-ember" d={`M${spark.x + dx * .7} ${spark.y + dy * .7}l${dx * .35} ${dy * .35}`} stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" style={{ '--dx': `${dx * 1.1}px`, '--dy': `${dy * 1.1}px` } as CSSProperties} />)}
        </g>)}
      </> : frame === 'abyss' ? <>
        {TENDRILS.map(tendril => <g key={tendril.angle} transform={`rotate(${tendril.angle} 50 50) translate(50 2.5) scale(${tendril.scale})`}>
          <g className="frame-fx frame-tendril" style={fx(tendril.delay)}>
            <path d={TENDRIL} fill="currentColor" />
            <path className="frame-core-stroke" d="M0 0C0-4 .4-7 1.2-10" strokeWidth=".45" strokeLinecap="round" />
          </g>
        </g>)}
        {ABYSS_EMBERS.map(ember => <circle key={`${ember.x}-${ember.y}`} className="frame-fx frame-rise frame-core" cx={ember.x} cy={ember.y} r=".9" style={fx(ember.delay, { '--dx': `${ember.dx}px` })} />)}
      </> : frame === 'nova' ? <>
        {Array.from({ length: 10 }, (_, index) => <g key={index} transform={`rotate(${index * 36 + 18} 50 50)`}>
          <path className="frame-fx frame-ray" d="M50 .5V-5.5" stroke={NOVA_COLORS[index % NOVA_COLORS.length]} strokeWidth="1.7" strokeLinecap="round" style={fx(index * .28)} />
        </g>)}
        <g className="frame-fx frame-ride">
          <g transform="translate(50 3.3) scale(.6)"><SparkGlint delay={0} /></g>
          <g transform="translate(50 96.7) scale(.48)"><SparkGlint delay={-1.2} /></g>
        </g>
      </> : <>
        <g stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          {BLUSH.map((d, index) => <path key={d} className="frame-fx frame-blush" d={d} style={fx((index % 3) * .08 + (index > 2 ? .3 : 0))} />)}
        </g>
        <g transform="translate(85 19)"><g className="frame-fx frame-heart" style={fx(.5)}>
          <path d={HEART} fill="currentColor" /><ellipse className="frame-core" cx="-2.4" cy="-2.6" rx="1" ry=".7" transform="rotate(-35 -2.4 -2.6)" />
        </g></g>
        <g transform="translate(14 23) scale(.7)"><g className="frame-fx frame-heart" style={fx(-2.1)}>
          <path d={HEART} fill="currentColor" /><ellipse className="frame-core" cx="-2.4" cy="-2.6" rx="1" ry=".7" transform="rotate(-35 -2.4 -2.6)" />
        </g></g>
        <g transform="translate(93 31) scale(.45)"><SparkGlint delay={.75} /></g>
      </>}
    </svg>
  </>;
}
