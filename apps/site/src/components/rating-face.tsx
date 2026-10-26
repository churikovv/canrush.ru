/**
 * The mascot beside a review scale: a CanRush can in the achievement-sticker style (brand blue, thick black outline,
 * red accents, black four-point sparkles) whose face follows the score. Five moods over 1–10; taste tops out licking
 * its lips with red motion lines, design with heart eyes and sparkles. Low scores tilt the can and sweat.
 */
export type RatingFaceKind = 'design' | 'taste';

type Eyes = 'cross' | 'worried' | 'plain' | 'happy' | 'heart';
type Mouth = 'wavy' | 'frown' | 'flat' | 'smile' | 'grin' | 'yum';
type Extra = 'sweat' | 'sparkles' | 'lines';
interface Mood { eyes: Eyes; mouth: Mouth; tilt: number; extra?: Extra; word: string }

const INK = '#111';
const BLUE = '#006EFF';
const RED = '#E8291C';
const MOODS: Record<RatingFaceKind, Mood[]> = {
  taste: [
    { eyes: 'cross', mouth: 'wavy', tilt: -12, extra: 'sweat', word: 'невкусно' },
    { eyes: 'worried', mouth: 'frown', tilt: -5, extra: 'sweat', word: 'так себе' },
    { eyes: 'plain', mouth: 'flat', tilt: 0, word: 'нормально' },
    { eyes: 'happy', mouth: 'smile', tilt: 4, word: 'вкусно' },
    { eyes: 'happy', mouth: 'yum', tilt: 8, extra: 'lines', word: 'очень вкусно' },
  ],
  design: [
    { eyes: 'cross', mouth: 'frown', tilt: -12, extra: 'sweat', word: 'не нравится' },
    { eyes: 'worried', mouth: 'flat', tilt: -5, word: 'так себе' },
    { eyes: 'plain', mouth: 'flat', tilt: 0, word: 'нормально' },
    { eyes: 'plain', mouth: 'smile', tilt: 4, word: 'красиво' },
    { eyes: 'heart', mouth: 'grin', tilt: 8, extra: 'sparkles', word: 'очень красиво' },
  ],
};

/** The mood of a 1–10 score: 1–2, 3–4, 5–6, 7–8, 9–10. */
export function ratingMood(kind: RatingFaceKind, value: number): Mood {
  const level = Math.min(4, Math.max(0, Math.ceil(value / 2) - 1));
  return MOODS[kind][level]!;
}

const HEART = 'M0 2.2c0-1.7 2.2-2.6 3.3-1 1.1-1.6 3.3-.7 3.3 1 0 2.1-3.3 4.2-3.3 4.2S0 4.3 0 2.2z';
/** The four-point sparkle of the achievement art, centred on 0,0. */
const SPARKLE = 'M0-4.2q.6 3.6 4.2 4.2-3.6.6-4.2 4.2-.6-3.6-4.2-4.2 3.6-.6 4.2-4.2z';

function Eye({ x, eyes }: { x: number; eyes: Eyes }) {
  const white = { stroke: '#fff', strokeWidth: 2.2, strokeLinecap: 'round' as const, fill: 'none' };
  switch (eyes) {
    case 'cross': return <path {...white} d={`M${x - 2.4} 21.6l4.8 4.8M${x + 2.4} 21.6l-4.8 4.8`} />;
    case 'worried': return <><circle cx={x} cy={24.5} r={3.3} fill="#fff" stroke={INK} strokeWidth={1.4} /><circle cx={x} cy={25.6} r={1.5} fill={INK} /><path {...white} strokeWidth={1.8} d={x < 24 ? `M${x - 3} 19.6l5-1.6` : `M${x + 3} 19.6l-5-1.6`} /></>;
    case 'plain': return <><circle cx={x} cy={24} r={3.4} fill="#fff" stroke={INK} strokeWidth={1.4} /><circle cx={x + .4} cy={24.2} r={1.6} fill={INK} /></>;
    case 'happy': return <path {...white} d={`M${x - 2.8} 25q2.8-4.2 5.6 0`} />;
    case 'heart': return <path d={HEART} fill={RED} stroke={INK} strokeWidth={1} transform={`translate(${x - 4.3} 20.6) scale(1.3)`} />;
  }
}

function MouthShape({ mouth }: { mouth: Mouth }) {
  const white = { stroke: '#fff', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  switch (mouth) {
    case 'wavy': return <path {...white} d="M18 33.2q1.5-1.8 3 0t3 0 3 0 3 0" />;
    case 'frown': return <path {...white} d="M19.5 34.2q4.5-3.8 9 0" />;
    case 'flat': return <path {...white} d="M20.5 32.6h7" />;
    case 'smile': return <path {...white} d="M19 31q5 4.6 10 0" />;
    case 'grin': return <><path d="M18.6 30.4h10.8q0 5.6-5.4 5.6t-5.4-5.6z" fill={INK} stroke={INK} strokeWidth={1.2} strokeLinejoin="round" /><path d="M21.4 34.4q2.6-1.9 5.2 0-2.6 1.6-5.2 0z" fill={RED} /></>;
    case 'yum': return <><path {...white} d="M19 30.6q5 4.6 10 0" /><path d="M25.2 33.2q3.2-1 4 1.6.7 2.6-1.7 2.9-2.3.3-2.3-4.5z" fill={RED} stroke={INK} strokeWidth={1.2} strokeLinejoin="round" /></>;
  }
}

function Extras({ extra }: { extra?: Extra }) {
  switch (extra) {
    case 'sweat': return <path d="M38.6 13.4q2.6 3.6 2.6 5.2a2.6 2.6 0 0 1-5.2 0q0-1.6 2.6-5.2z" fill="#9CC8FF" stroke={INK} strokeWidth={1.3} strokeLinejoin="round" />;
    case 'sparkles': return <g fill="currentColor"><path d={SPARKLE} transform="translate(7 12)" /><path d={SPARKLE} transform="translate(41.5 20) scale(.75)" /><path d={SPARKLE} transform="translate(8.5 37) scale(.6)" /></g>;
    case 'lines': return <g stroke={RED} strokeWidth={2.2} strokeLinecap="round"><path d="M37.5 9.5l2.6-3.6" /><path d="M40.4 14.4l4-1.6" /><path d="M7.6 13.6l-3.4-2" /></g>;
    default: return null;
  }
}

export function RatingFace({ kind, value }: { kind: RatingFaceKind; value: number }) {
  const mood = ratingMood(kind, value);
  return <span className="rating-face" aria-hidden="true">
    {/* Keyed by mood, so the can pops only when the mood changes, not on every step of the slider. */}
    <svg key={`${kind}-${mood.word}`} viewBox="0 0 48 48" width="44" height="44">
      <Extras extra={mood.extra} />
      <g transform={`rotate(${mood.tilt} 24 27)`}>
        {/* A white sticker edge, as on the achievement art: keeps the black outline readable on dark themes. */}
        <g fill="#fff" stroke="#fff" strokeWidth="5" strokeLinejoin="round"><rect x="13.5" y="11" width="21" height="31" rx="5" /><rect x="14.5" y="8" width="19" height="5.2" rx="2.6" /></g>
        {/* Can: blue body, white lid with the red band of the achievement cans, a pull tab on top. */}
        <rect x="13.5" y="11" width="21" height="31" rx="5" fill={BLUE} stroke={INK} strokeWidth="2.4" />
        <path d="M13.5 15.4h21" stroke={RED} strokeWidth="2.2" />
        <rect x="14.5" y="8" width="19" height="5.2" rx="2.6" fill="#fff" stroke={INK} strokeWidth="2.2" />
        <path d="M22 8.2q.4-2.8 3.4-2.6" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M16.6 19v16" stroke="#fff" strokeOpacity=".35" strokeWidth="2" strokeLinecap="round" />
        <Eye x={19.6} eyes={mood.eyes} />
        <Eye x={28.4} eyes={mood.eyes} />
        <MouthShape mouth={mood.mouth} />
      </g>
    </svg>
  </span>;
}
