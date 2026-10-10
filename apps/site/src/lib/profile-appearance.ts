export const PROFILE_THEMES = [
  { key: 'default', label: 'Canrush', description: 'Светлый и фирменный синий' },
  { key: 'dark', label: 'Графит', description: 'Тёмный фон и голубые акценты' },
  { key: 'lavender', label: 'Лаванда', description: 'Светлый фон с фиолетовым оттенком' },
  { key: 'mint', label: 'Мята', description: 'Зелёные акценты и свежий светлый фон' },
] as const;
export const PROFILE_FRAMES = [
  { key: 'none', label: 'Без рамки' },
  { key: 'orbit', label: 'Орбита' },
  { key: 'pulse', label: 'Пульс' },
  { key: 'prism', label: 'Призма' },
] as const;
export type ProfileAppearance = { theme: typeof PROFILE_THEMES[number]['key']; frame: typeof PROFILE_FRAMES[number]['key'] };
export const DEFAULT_PROFILE_APPEARANCE: ProfileAppearance = { theme: 'default', frame: 'none' };
export function parseProfileAppearance(value: unknown): ProfileAppearance | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { theme, frame } = value as ProfileAppearance;
  return PROFILE_THEMES.some(item => item.key === theme) && PROFILE_FRAMES.some(item => item.key === frame) ? { theme, frame } : null;
}
