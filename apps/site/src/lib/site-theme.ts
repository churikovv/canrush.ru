export const SITE_THEME_COOKIE = 'canrush-theme';
export type SiteTheme = 'system' | 'light' | 'graphite';
export function parseSiteTheme(value: unknown): SiteTheme | null {
  return value === 'system' || value === 'light' || value === 'graphite' ? value : null;
}
