export const PROFILE_THEMES = [
  { key: 'default', level: 1, label: 'Canrush', description: 'Тема сайта и фирменный синий' },
  { key: 'dark', level: 2, label: 'Чёрная', description: 'Чистый чёрный и серебристые акценты' },
  { key: 'lavender', level: 4, label: 'Лаванда', description: 'Светлый фон с фиолетовым оттенком' },
  { key: 'mint', level: 6, label: 'Мята', description: 'Зелёные акценты и свежий светлый фон' },
] as const;
export const PROFILE_FRAMES = [
  { key: 'none', level: 1, label: 'Без рамки' },
  { key: 'orbit', level: 5, label: 'Разряд' },
  { key: 'pulse', level: 3, label: 'Искры' },
  { key: 'prism', level: 8, label: 'Nya desuu' },
] as const;
export type ProfileAppearance = { theme: typeof PROFILE_THEMES[number]['key']; frame: typeof PROFILE_FRAMES[number]['key'] };
export const DEFAULT_PROFILE_APPEARANCE: ProfileAppearance = { theme: 'default', frame: 'none' };
export function parseProfileAppearance(value: unknown): ProfileAppearance | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { theme, frame } = value as ProfileAppearance;
  return PROFILE_THEMES.some(item => item.key === theme) && PROFILE_FRAMES.some(item => item.key === frame) ? { theme, frame } : null;
}

/** Existing equipped cosmetics remain usable; new choices require earned levels. */
export function canUseProfileAppearance(value: ProfileAppearance, level: number, current = DEFAULT_PROFILE_APPEARANCE): boolean {
  return (value.theme === current.theme || PROFILE_THEMES.some(item => item.key === value.theme && item.level <= level))
    && (value.frame === current.frame || PROFILE_FRAMES.some(item => item.key === value.frame && item.level <= level));
}
