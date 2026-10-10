export const PROFILE_BLOCKS = [
  { key: 'experience', label: 'Уровень', area: 'main' },
  { key: 'ratings', label: 'Статистика оценок', area: 'main' },
  { key: 'listings', label: 'Объявления', area: 'main' },
  { key: 'wall', label: 'Стена', area: 'main' },
  { key: 'social', label: 'Друзья и подписки', area: 'side' },
  { key: 'about', label: 'О профиле', area: 'side' },
] as const;
export type ProfileBlockKey = typeof PROFILE_BLOCKS[number]['key'];
export function isRequiredProfileBlock(key: ProfileBlockKey): boolean { return key === 'experience' || key === 'social'; }
export type ProfileLayout = { order: ProfileBlockKey[]; hidden: ProfileBlockKey[] };
export const DEFAULT_PROFILE_LAYOUT: ProfileLayout = { order: PROFILE_BLOCKS.map(x => x.key), hidden: [] };
export function parseProfileLayout(value: unknown): ProfileLayout | null {
  if (!value || typeof value !== 'object') return null;
  const { order, hidden } = value as ProfileLayout;
  const valid = (keys: unknown): keys is ProfileBlockKey[] => Array.isArray(keys) && keys.every(key => PROFILE_BLOCKS.some(block => block.key === key)) && new Set(keys).size === keys.length;
  if (!valid(order) || order.length !== PROFILE_BLOCKS.length || !valid(hidden)) return null;
  return { order, hidden: hidden.filter(key => !isRequiredProfileBlock(key)) };
}
