import { BADGE_HEIGHT, BADGE_MIN_REVIEWS, BADGE_WIDTH, type BadgeTheme } from './brand-materials-fields';
import { MARK_PATHS } from './canrush-mark';
import { pluralRu } from './drink-calendar-fields';

/**
 * The rating badge a brand puts on its own site: a self-contained SVG (no fonts or pictures to load from us — a page
 * elsewhere shows it as a plain image), the CanRush mark on the brand blue, the members' average out of 10 and the
 * number of reviews. Text runs as `tspan`s, so nothing has to be measured.
 */
const PALETTE: Record<BadgeTheme, { background: string; line: string; ink: string; muted: string }> = {
  light: { background: '#ffffff', line: '#e2e5eb', ink: '#0b0d12', muted: '#5b6270' },
  dark: { background: '#12151c', line: '#2a2f3a', ink: '#ffffff', muted: '#a3a9b6' },
};
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";
const STAR = 'M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.3l6.5-.9z';

const text = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** «8.1» — one decimal with a dot, as the drink page shows it. */
export const badgeScore = (value: number) => (Math.round(value * 10) / 10).toFixed(1);

export function ratingBadgeSvg({ name, reviews, score, theme }: { name: string; reviews: number; score: number; theme: BadgeTheme }): string {
  const color = PALETTE[theme];
  const rated = reviews >= BADGE_MIN_REVIEWS;
  const count = `${new Intl.NumberFormat('ru-RU').format(reviews)} ${pluralRu(reviews, 'отзыв', 'отзыва', 'отзывов')}`;
  const label = rated ? `${name}: ${badgeScore(score)} из 10 на CanRush, ${count}` : `${name} на CanRush: оцените первым`;
  const line = rated
    ? `<path d="${STAR}" transform="translate(74 40) scale(.62)" fill="#006eff"/>`
      + `<text x="92" y="55" font-family="${FONT}" fill="${color.ink}"><tspan font-size="22" font-weight="700">${badgeScore(score)}</tspan>`
      + `<tspan font-size="13" fill="${color.muted}">/10</tspan><tspan font-size="12" fill="${color.muted}" dx="6">· ${count}</tspan></text>`
    : `<text x="74" y="54" font-family="${FONT}" font-size="16" font-weight="700" fill="${color.ink}">Оцените первым</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}" viewBox="0 0 ${BADGE_WIDTH} ${BADGE_HEIGHT}" role="img" aria-label="${text(label)}">`
    + `<title>${text(label)}</title>`
    + `<rect x=".5" y=".5" width="${BADGE_WIDTH - 1}" height="${BADGE_HEIGHT - 1}" rx="16" fill="${color.background}" stroke="${color.line}"/>`
    + `<rect x="12" y="12" width="48" height="48" rx="12" fill="#006eff"/>`
    + `<g transform="translate(22 24.5) scale(.763)" fill="#ffffff">${MARK_PATHS.map(d => `<path d="${d}"/>`).join('')}</g>`
    + `<text x="74" y="29" font-family="${FONT}" font-size="12" font-weight="500" fill="${color.muted}">Оценка на CanRush</text>`
    + line
    + '</svg>';
}
