import { SITE_URL } from './seo';

/**
 * «QR и значок» in the business cabinet: a printed QR poster that brings a buyer at the shelf to the drink's reviews,
 * and a badge with the members' rating for the brand's own site. Both point at a drink of the company's brands or at
 * the whole brand. No database here: the browser and the badge route share these links.
 */
export type MaterialTarget =
  | { kind: 'drink'; brand: string; flavor: string; slug: string; name: string }
  | { kind: 'brand'; brand: string; name: string };

export type BadgeTheme = 'light' | 'dark';
export type PosterFormat = 'a4' | 'labels';

/** Fewer reviews than this — the badge asks to rate instead of showing a number that two people made. */
export const BADGE_MIN_REVIEWS = 3;
export const BADGE_WIDTH = 256;
export const BADGE_HEIGHT = 72;
/** Labels on one A4 sheet: two columns, four rows, cut along the dashed lines. */
export const LABELS_PER_SHEET = 8;

export const badgeTheme = (value: unknown): BadgeTheme => value === 'dark' ? 'dark' : 'light';
export const posterFormat = (value: unknown): PosterFormat => value === 'labels' ? 'labels' : 'a4';

const brandQuery = (brand: string) => `/catalog?${new URLSearchParams({ brand })}`;

/** The page the badge leads to: the drink, or the catalog filtered to the brand. */
export function targetPage(target: MaterialTarget): string {
  return SITE_URL + (target.kind === 'drink' ? `/catalog/${target.slug}` : brandQuery(target.brand));
}

/** Where the QR code leads: the drink's reviews with the form open (`#write-review`), or the brand in the catalog. */
export function targetReviewLink(target: MaterialTarget): string {
  return target.kind === 'drink' ? `${SITE_URL}/catalog/${target.slug}?tab=reviews#write-review` : targetPage(target);
}

/** The badge picture: `/badge/<drink slug>.svg` or `/badge/brand/<brand>.svg`, `?theme=dark` for dark sites. */
export function badgeImageUrl(target: MaterialTarget, theme: BadgeTheme): string {
  const path = target.kind === 'drink' ? `/badge/${target.slug}.svg` : `/badge/brand/${encodeURIComponent(target.brand)}.svg`;
  return SITE_URL + path + (theme === 'dark' ? '?theme=dark' : '');
}

const attribute = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The HTML a brand pastes into its site: the picture inside a link to the drink. */
export function badgeEmbedCode(target: MaterialTarget, theme: BadgeTheme): string {
  return `<a href="${attribute(targetPage(target))}" target="_blank" rel="noopener"><img src="${attribute(badgeImageUrl(target, theme))}" width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}" alt="${attribute(`${target.name} — оценка участников CanRush`)}"></a>`;
}

/** The cabinet's address of a target: `?drink=<slug>` or `?brand=<brand>`. */
export function targetParams(target: MaterialTarget): Record<string, string> {
  return target.kind === 'drink' ? { drink: target.slug } : { brand: target.brand };
}

/** The target a cabinet address names among the company's own, or the first one. */
export function pickTarget(targets: MaterialTarget[], params: { drink?: string; brand?: string }): MaterialTarget | null {
  return targets.find(target => target.kind === 'drink' ? target.slug === params.drink : !params.drink && target.brand === params.brand) ?? targets[0] ?? null;
}

/** Short text under the QR code, so the address can be typed in when a camera can't read it. */
export function printedAddress(target: MaterialTarget): string {
  return targetPage(target).replace(/^https:\/\//, '');
}
