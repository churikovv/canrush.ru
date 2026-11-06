import type { CSSProperties, ReactNode } from 'react';
import { cutoutSrc } from '@/lib/can-cutout-src';
import type { AwardCategory } from '@/lib/awards-fields';

/** A category's big outline mark, in a tile's corner as Steam's award cards have theirs: the page's tiles and the story's. */
const MARKS: Record<AwardCategory, ReactNode> = {
  design: <path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.6-.9 1.2-1.8-.5-1.1.2-2.2 1.4-2.2H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10ZM7.5 12a1.3 1.3 0 1 1 0-.01M10 7.5a1.3 1.3 0 1 1 0-.01M15 7.5a1.3 1.3 0 1 1 0-.01" />,
  taste: <path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10Z" />,
  drink: <path d="M5 17h14l1-9-4.5 3.5L12 5 8.5 11.5 4 8l1 9Zm0 3h14" />,
  sugarfree: <path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14Zm0 0 7-7" />,
};

/** Each category's tile colours (top and bottom of its gradient): violet, teal, the brand blue, green — never gold. */
const COLORS: Record<AwardCategory, readonly [string, string]> = {
  design: ['#5b35d6', '#22146b'],
  taste: ['#0d7fa3', '#083a5c'],
  drink: ['#1150d8', '#0a2468'],
  sugarfree: ['#13906a', '#0a3d33'],
};

export function AwardMark({ category, className }: { category: AwardCategory; className: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{MARKS[category]}</svg>;
}

/** `--tile-a` and `--tile-b` of a category's tile, for its `style`. */
export const awardTileColors = (category: AwardCategory) => ({ '--tile-a': COLORS[category][0], '--tile-b': COLORS[category][1] }) as CSSProperties;

/** A can of a tile: our cover without its shop background, another site's photo on a light panel, or a bolt. */
export function AwardCan({ cover, className }: { cover: string | null; className: string }) {
  if (!cover) return <span className={`${className} is-empty`} aria-hidden="true">⚡</span>;
  const cut = cutoutSrc(cover);
  // eslint-disable-next-line @next/next/no-img-element -- the cutout route serves a sized WebP; a foreign photo stays as it is
  return <img className={cut ? className : `${className} is-photo`} src={cut ?? cover} alt="" loading="lazy" />;
}
