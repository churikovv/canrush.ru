export const PROFILE_THEMES = [
  { key: 'default', level: 1, tone: null, label: 'Canrush', description: 'Тема сайта и фирменный синий' },
  { key: 'dark', level: 2, tone: 'dark', label: 'Чёрная', description: 'Чистый чёрный и серебристые акценты' },
  { key: 'lavender', level: 4, tone: 'light', label: 'Лаванда', description: 'Светлый фон с фиолетовым оттенком' },
  { key: 'mint', level: 6, tone: 'light', label: 'Мята', description: 'Зелёные акценты и свежий светлый фон' },
  { key: 'gold', level: 8, tone: 'light', label: 'Золото', description: 'Тёплый кремовый фон и янтарные акценты' },
  { key: 'ocean', level: 10, tone: 'dark', label: 'Глубина', description: 'Ночной синий и бирюзовые акценты' },
  { key: 'platinum', level: 12, tone: 'light', label: 'Платина', description: 'Холодный серебристый фон и стальные акценты' },
  { key: 'cobalt', level: 15, tone: 'dark', label: 'Кобальт', description: 'Весь профиль в фирменном синем, жёлтые акценты' },
  { key: 'ember', level: 18, tone: 'dark', label: 'Пламя', description: 'Тёмный фон и раскалённые оранжевые акценты' },
  { key: 'legend', level: 20, tone: 'dark', label: 'Легенда', description: 'Глубокий индиго в цвет эмблемы ранга Легенда' },
] as const;
/** Theme attributes for a profile surface: `data-profile-tone` carries the light/dark fixes shared by all presets of that tone. */
export function profileThemeAttributes(theme: string | undefined) {
  const preset = PROFILE_THEMES.find(item => item.key === theme) ?? PROFILE_THEMES[0];
  return { 'data-profile-theme': preset.key, 'data-profile-tone': preset.tone ?? undefined };
}
export const PROFILE_FRAMES = [
  { key: 'none', level: 1, label: 'Без рамки' },
  { key: 'pulse', level: 3, label: 'Искры' },
  { key: 'orbit', level: 5, label: 'Разряд' },
  { key: 'abyss', level: 5, label: 'Бездна' },
  { key: 'nova', level: 6, label: 'Сверхновая' },
  { key: 'prism', level: 8, label: 'Nya desuu' },
  { key: 'frost', level: 10, label: 'Иней' },
  { key: 'blaze', level: 12, label: 'Огненное кольцо' },
  { key: 'liquid', level: 15, label: 'Жидкая энергия' },
  { key: 'can', level: 18, label: 'Холодная банка' },
  { key: 'legend', level: 20, label: 'Корона Легенды' },
  // Эксклюзив Банкомата (`gachaCosmetic`): уровнем не открывается, только с «Тыквенного автомата».
  { key: 'pumpkin', level: 999, label: 'Тыквенная', special: 'Тыквенный автомат' },
] as const;
export type ProfileAppearance = { theme: typeof PROFILE_THEMES[number]['key']; frame: typeof PROFILE_FRAMES[number]['key'] };
export const DEFAULT_PROFILE_APPEARANCE: ProfileAppearance = { theme: 'default', frame: 'none' };
export function parseProfileAppearance(value: unknown): ProfileAppearance | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { theme, frame } = value as ProfileAppearance;
  return PROFILE_THEMES.some(item => item.key === theme) && PROFILE_FRAMES.some(item => item.key === frame) ? { theme, frame } : null;
}

/** The nearest level that opens new cosmetics, with everything it opens; null when all are open. */
export function nextAppearanceUnlock(level: number): { level: number; themes: string[]; frames: string[] } | null {
  const next = Math.min(...[...PROFILE_THEMES, ...PROFILE_FRAMES].filter(item => !('special' in item)).map(item => item.level).filter(required => required > level));
  if (!Number.isFinite(next)) return null;
  return {
    level: next,
    themes: PROFILE_THEMES.filter(item => item.level === next).map(item => item.label),
    frames: PROFILE_FRAMES.filter(item => item.level === next).map(item => item.label),
  };
}

/** Existing equipped cosmetics remain usable; new choices require earned levels or, for the gacha's frames, owning them. */
export function canUseProfileAppearance(value: ProfileAppearance, level: number, current = DEFAULT_PROFILE_APPEARANCE, owned: readonly string[] = []): boolean {
  return (value.theme === current.theme || PROFILE_THEMES.some(item => item.key === value.theme && item.level <= level))
    && (value.frame === current.frame || owned.includes(value.frame) || PROFILE_FRAMES.some(item => item.key === value.frame && item.level <= level));
}
