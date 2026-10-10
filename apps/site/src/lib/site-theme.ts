export const SITE_THEME_COOKIE = 'canrush-theme';
export type SiteTheme = 'light' | 'graphite';
export function parseSiteTheme(value: unknown): SiteTheme | null {
  return value === 'light' || value === 'graphite' ? value : null;
}
