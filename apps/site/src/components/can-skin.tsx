import type { CSSProperties } from 'react';
import { canSkin, hasAura, type CanFrame, type CanMotif } from '@/lib/can-skin';
import type { Rarity } from '@/lib/gacha-fields';

/** Flavour signs, drawn as lines on a 24 × 24 grid like the site's icons. */
const MOTIFS: Record<CanMotif, string> = {
  citrus: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18ZM12 6v12M6.8 9l10.4 6M6.8 15l10.4-6',
  berry: 'M4.5 15a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0ZM12.5 15a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0ZM8.5 9a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0ZM12 5.5V2.5l2.5-1',
  cherry: 'M4.5 16a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0ZM12.5 18a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0ZM8 12.5C9 8 12 5 17 3M16 14.5C16 10 16.5 6 17 3',
  leaf: 'M5 19C5 10 11 4 20 4c0 9-6 15-15 15ZM5 19l9-9',
  apple: 'M12 7c-3-2-7 0-7 5 0 4 3 8 5 8 1 0 1.5-.5 2-.5s1 .5 2 .5c2 0 5-4 5-8 0-5-4-7-7-5ZM12 7c0-2 1-4 3-5',
  drop: 'M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11Z',
  bean: 'M12 3c4 0 7 4 7 9s-3 9-7 9-7-4-7-9 3-9 7-9ZM12 3c-2.5 4 2.5 9 0 18',
  bubble: 'M5 12a5.5 5.5 0 1 0 11 0a5.5 5.5 0 1 0-11 0ZM15.5 18.5a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0ZM16.5 6a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0Z',
  snow: 'M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 2 3-2M9 20l3-2 3 2',
  flame: 'M12 21c-4 0-6-3-6-6 0-4 4-6 4-10 3 2 4 4 4 6 1-1 2-2 2-4 2 2 2 5 2 8 0 3-2 6-6 6Z',
  flower: 'M9 6.5a3 3 0 1 0 6 0a3 3 0 1 0-6 0ZM9 17.5a3 3 0 1 0 6 0a3 3 0 1 0-6 0ZM3.5 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0ZM14.5 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0Z',
  wave: 'M2 9c3 0 3-3 6-3s3 3 6 3 3-3 6-3M2 15c3 0 3-3 6-3s3 3 6 3 3-3 6-3M2 21c3 0 3-3 6-3s3 3 6 3 3-3 6-3',
  crown: 'M3 8l4.5 4L12 5l4.5 7L21 8l-2 10H5L3 8ZM5 21h14',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z',
  gem: 'M6 3h12l4 6-10 12L2 9l4-6ZM2 9h20M9 3l3 18M15 3l-3 18',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7l1-8Z',
};
/**
 * A frame's pieces: `f` filled with the frame's metal, `s` a line, `h` a highlight, `g` a gem, `p` a pearl, `l` a leaf,
 * `r` a rivet, `t` a tooth (styles: `.can-skin-corner [data-k]`).
 */
type Piece = readonly ['f' | 's' | 'h' | 'g' | 'p' | 'l' | 'r' | 't', string];
const dot = (x: number, y: number, r: number) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
const FILIGREE: readonly Piece[] = [['s', 'M3 29V12C3 7 7 3 12 3h17'], ['s', 'M7 27c0-10.5 9.5-20 20-20'], ['s', 'M3 18c4 0 6.5-2.6 6.5-6.5M18 3c0 4-2.6 6.5-6.5 6.5'],
  ['s', 'M13 13c3.6-1.6 6.8 1.2 5 4.1-1.4 2.3-4.8 1.2-3.9-1.3'], ['f', `${dot(7, 28.5, 1.3)}${dot(28.5, 7, 1.3)}`]];
const CLAWS: readonly Piece[] = [['f', 'M1.5 1.5h10l-2 5h-3v3l-5 2Z'], ['f', 'M10 4c7 1.5 12 6 13.5 13-3-4.5-7.5-7.5-13-8.5Z'], ['f', 'M4 10c1.5 7 6 12 13.5 13.5-4.5-3-7.5-7.5-8.5-13Z'],
  ['f', 'M7 7c6.5 3 10.5 8.5 12 16-3.5-5-7.5-9.5-13-12.5Z'], ['h', 'M11 5.5c5 1.5 9 5 11 10M5.5 11c1.5 5 5 9 10 11']];
/** Seven teeth along a jaw, stretched to the card's width. */
const TEETH = `M0 0H70${Array.from({ length: 14 }, (_, step) => `L${70 - 5 * (step + 1)} ${step % 2 ? 0 : 9.5}`).join('')}Z`;
/** The top-left corner on a 32 × 32 grid; the other corners mirror it, so a column's capital becomes its base below. */
const CORNER_ART: Partial<Record<CanFrame, readonly Piece[]>> = {
  filigree: FILIGREE, gilded: FILIGREE, claws: CLAWS, dragon: CLAWS,
  deco: [['s', 'M3 29V3h26'], ['s', 'M7.5 29V7.5H29'], ['s', 'M12 21v-9h9'], ['s', 'M12 12l7.5 2.5M12 12l5.5 5.5M12 12l2.5 7.5']],
  vine: [['s', 'M4 29C4 15 15 4 29 4'], ['l', 'M9.5 16.5c-4-.5-6.5-3.5-6.5-7 4 .3 6.4 3.3 6.5 7ZM16.5 9.5c.5-4 3.5-6.5 7-6.5-.3 4-3.3 6.4-7 6.5ZM6.5 24.5c-2.6-.4-4.4-2.5-4.2-5 2.6.3 4.4 2.4 4.2 5ZM24.5 6.5c-.4-2.6-2.5-4.4-5-4.2.3 2.6 2.4 4.4 5 4.2Z'], ['g', dot(11.5, 11.5, 1.8)]],
  pearl: [['p', `${dot(7, 7, 4.6)}${dot(15.5, 4, 2.4)}${dot(4, 15.5, 2.4)}${dot(22, 4, 1.8)}${dot(4, 22, 1.8)}`], ['h', 'M4.6 5.6a2.8 2.8 0 0 1 2.4-1.6']],
  columns: [['f', 'M1.5 1.5h17V5h-17Z'], ['s', 'M4 5.5c-.6 3 1 5.2 3.6 5.2 2 0 3-1.4 3-2.8 0-1.3-1-2-2-2-1.1 0-1.7.8-1.5 1.6'], ['s', 'M5.5 13v17M9.5 12.5V30']],
  gems: [['s', 'M15 3h14M3 15v14'], ['g', 'M8 1.5 14.5 8 8 14.5 1.5 8Z'], ['h', 'M1.5 8h13M8 1.5v13']],
  armor: [['f', 'M1.5 1.5h19l-4 6h-9v9l-6 4Z'], ['h', 'M3.5 3.5h14M3.5 3.5v14'], ['r', `${dot(5.5, 5.5, 1.6)}${dot(13, 5, 1.3)}${dot(5, 13, 1.3)}`]],
  spikes: [['f', 'M1.5 1.5H11L9.5 6 24 24 6 9.5l-4.5 1.5Z'], ['f', 'M14 2.5l8 4.5-9-1.3ZM2.5 14l4.5 8-1.3-9Z'], ['h', 'M4.5 4.5l17 17']],
  chain: [['s', dot(7, 7, 4)], ['r', dot(7, 7, 1.4)]],
  maw: [['t', 'M2 2h10L7 17Z'], ['t', 'M2 2v10l15-5Z']],
  royal: [['s', 'M15 3h14M3 15v14'], ['f', 'M8 2c-2.2 3-2.2 6 0 8.5 2.2-2.5 2.2-5.5 0-8.5ZM8 10.5c-3.2.3-5.6-1.6-6-4.2 2.4-.3 4.7 1 6 4.2ZM8 10.5c3.2.3 5.6-1.6 6-4.2-2.4-.3-4.7 1-6 4.2Z'], ['s', 'M5 12.5h6']],
  chrome: [['r', dot(6, 6, 2.4)], ['h', 'M4.6 6h2.8M6 4.6v2.8']],
};
/** A piece at the top centre (`wide` — along the whole edge, stretched), and mirrored at the bottom with `bottom`. */
const CREST_ART: Partial<Record<CanFrame, { box: string; pieces: readonly Piece[]; wide?: true; bottom?: true }>> = {
  deco: { box: '0 0 32 12', pieces: [['s', 'M4 1.5h24M8 1.5a8 8 0 0 0 16 0M12 1.5a4 4 0 0 0 8 0M16 1.5v8.5']] },
  arch: { box: '0 0 32 12', pieces: [['f', 'M12.5 0h7L18 9.5h-4Z'], ['h', 'M14 1.5h4']] },
  spikes: { box: '0 0 32 12', pieces: [['f', 'M2 0 6 6 10 0 13 10 16 0 19 10 22 0 26 6 30 0Z']] },
  maw: { box: '0 0 70 10', wide: true, bottom: true, pieces: [['t', TEETH]] },
  gilded: { box: '0 0 32 12', pieces: [['s', 'M6 1.5c3 0 4 3 6.5 3S15 1.5 16 1.5s1 3 3.5 3S23 1.5 26 1.5'], ['g', dot(16, 6.5, 1.8)]] },
  royal: { box: '0 0 32 14', pieces: [['f', 'M5 13 6 4l5 4 5-7 5 7 5-4 1 9Z'], ['g', `${dot(16, 7, 1.4)}${dot(10.5, 9.5, 1)}${dot(21.5, 9.5, 1)}`], ['h', 'M7 11.5h18']] },
  facets: { box: '0 0 32 12', pieces: [['g', 'M10 0h12l-6 10Z'], ['h', 'M10 0l6 10 6-10M13 0l3 10 3-10']] },
  dragon: { box: '0 0 32 14', pieces: [['f', 'M5 14C5 7 9 2 15 0c-3 4-4 8-3 12ZM27 14C27 7 23 2 17 0c3 4 4 8 3 12Z'], ['g', dot(16, 8, 2.2)], ['h', 'M7 12C7 7 10 3.5 13.5 1.5M25 12C25 7 22 3.5 18.5 1.5']] },
};
const art = (pieces: readonly Piece[]) => pieces.map(([kind, d], index) => <path key={index} data-k={kind} d={d} />);

/**
 * The can's own look under the card's content (`canSkin`): its world, colours, ornament, light, frame and flavour signs,
 * the same for this brand and flavour everywhere. The outer metal stays the rarity's; the effect behind the can shows from
 * rare up, particles from epic up, the foil moves on legendary cards. `lite` (long rows of cards) keeps the look and
 * drops the motion.
 */
export function CanSkin({ brand, flavor, rarity, lite = false }: { brand: string; flavor: string; rarity: Rarity; lite?: boolean }) {
  const skin = canSkin(brand, flavor);
  const style = { '--skin-a': skin.a, '--skin-b': skin.b, '--skin-rim': skin.rim, '--skin-angle': `${skin.angle}deg` } as CSSProperties;
  const particles = !lite && (rarity === 'epic' || rarity === 'legendary');
  const corner = CORNER_ART[skin.frame], crest = CREST_ART[skin.frame];
  return <span className="can-skin" data-ornament={skin.ornament} data-frame={skin.frame} data-particles={particles ? skin.particles : undefined} style={style} aria-hidden="true">
    <i className="can-skin-world" data-world={skin.world} data-still={lite || undefined} />
    {hasAura(rarity) && <i className="can-skin-aura" data-aura={skin.aura} data-still={lite || undefined} />}
    {skin.light !== 'matte' && <i className="can-skin-light" data-light={skin.light} />}
    {rarity === 'legendary' && <i className="can-skin-foil" data-foil={skin.foil} data-still={lite || undefined} />}
    {corner && (['tl', 'tr', 'bl', 'br'] as const).map(at => <svg key={at} className="can-skin-corner" data-c={at} viewBox="0 0 32 32">{art(corner)}</svg>)}
    {crest && (crest.bottom ? ['top', 'bottom'] : ['top']).map(at => <svg key={at} className="can-skin-crest" data-at={at} data-wide={crest.wide || undefined} viewBox={crest.box} preserveAspectRatio={crest.wide ? 'none' : undefined}>{art(crest.pieces)}</svg>)}
    {skin.marks.map((mark, index) => <svg key={index} className="can-skin-mark" viewBox="0 0 24 24" style={{ left: `${mark.x}%`, top: `${mark.y}%`, width: `calc(var(--mark-scale, 1) * ${mark.size}px)`, transform: `translate(-50%, -50%) rotate(${mark.turn}deg)` }}><path d={MOTIFS[skin.motif]} /></svg>)}
    {particles && skin.dots.map((dot, index) => <i key={index} className="can-skin-dot" style={{ left: `${dot.x}%`, top: `${dot.y}%`, width: `calc(var(--mark-scale, 1) * ${dot.size}px)`, animationDelay: `-${dot.delay}s`, animationDuration: `${dot.duration}s` }} />)}
  </span>;
}
