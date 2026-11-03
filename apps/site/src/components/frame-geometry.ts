import type { CSSProperties } from 'react';

/**
 * Geometry shared by the heavy avatar frames. Their view box keeps the avatar at (0,0)–(100,100),
 * so its edge is the circle r=50 around (50,50), and the frame reaches 30 units past it.
 * Every computed coordinate is rounded: server and browser trigonometry differ in the last digits,
 * which breaks hydration.
 */
export const HEAVY_VIEW = '-30 -30 160 160';
export const round = (value: number) => Math.round(value * 100) / 100;
/** Point on a circle around the avatar centre; 0° is the top, angles grow clockwise. */
export function polar(radius: number, degrees: number): [number, number] {
  const radians = (degrees * Math.PI) / 180;
  return [round(50 + radius * Math.sin(radians)), round(50 - radius * Math.cos(radians))];
}
export const points = (list: [number, number][]) => list.map(point => point.join(' ')).join(' ');
export const fx = (delay: number, extra: Record<string, string> = {}) => ({ '--fx-delay': `${round(delay)}s`, ...extra }) as CSSProperties;
/** Deterministic 0–1 noise so frames render identically on the server and the client. */
export const noise = (seed: number) => (Math.imul(Math.round(seed * 7919) ^ 0x5bd1e995, 0x27d4eb2d) >>> 0) / 4294967296;
export function arc(radius: number, from: number, to: number) {
  const [x1, y1] = polar(radius, from), [x2, y2] = polar(radius, to);
  return `M${x1} ${y1}A${radius} ${radius} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`;
}
/** A band between two radii; the even-odd hole keeps the portrait clear. */
export const annulus = (inner: number, outer: number) => `M50 ${round(50 - outer)}A${outer} ${outer} 0 1 0 50 ${round(50 + outer)}A${outer} ${outer} 0 1 0 50 ${round(50 - outer)}ZM50 ${round(50 - inner)}A${inner} ${inner} 0 1 1 50 ${round(50 + inner)}A${inner} ${inner} 0 1 1 50 ${round(50 - inner)}Z`;
/** A closed ring outline whose radius follows `radius(angle)`, sampled every `step` degrees. */
export function ringPath(radius: (degrees: number) => number, step = 5) {
  return `M${Array.from({ length: Math.round(360 / step) }, (_, index) => polar(radius(index * step), index * step).join(' ')).join('L')}Z`;
}
export function star(count: number, outer: number, inner: number) {
  return Array.from({ length: count * 2 }, (_, index) => {
    const radius = index % 2 ? inner : outer, angle = (Math.PI * index) / count - Math.PI / 2;
    return `${index ? 'L' : 'M'}${round(radius * Math.cos(angle))} ${round(radius * Math.sin(angle))}`;
  }).join('') + 'Z';
}
/** SVG transform that puts the local origin on the circle `radius` at `degrees`, local -y pointing away from the avatar. */
export const onRing = (radius: number, degrees: number, scale = 1) => `rotate(${round(degrees)} 50 50) translate(50 ${round(50 - radius)})${scale === 1 ? '' : ` scale(${scale})`}`;
