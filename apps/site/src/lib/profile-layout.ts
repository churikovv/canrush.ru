export const PROFILE_BLOCKS = [
  { key: 'experience', label: 'Уровень', area: 'main' },
  { key: 'calendar', label: 'Календарь выпитого', area: 'main' },
  { key: 'collection', label: 'Коллекция вкусов', area: 'main' },
  { key: 'ratings', label: 'Статистика оценок', area: 'main' },
  { key: 'listings', label: 'Объявления', area: 'main' },
  { key: 'social', label: 'Друзья и подписки', area: 'side' },
  { key: 'favorites', label: 'Избранное', area: 'main' },
  { key: 'about', label: 'О профиле', area: 'side' },
  { key: 'wall', label: 'Стена', area: 'main' },
] as const;
export type ProfileBlockKey = typeof PROFILE_BLOCKS[number]['key'];
export function isRequiredProfileBlock(key: ProfileBlockKey): boolean { return key === 'experience' || key === 'social'; }
export type ProfileLayout = { order: ProfileBlockKey[]; hidden: ProfileBlockKey[] };
export const DEFAULT_PROFILE_LAYOUT: ProfileLayout = { order: PROFILE_BLOCKS.map(x => x.key), hidden: ['favorites', 'listings'] };
/** Places `key` right before or after `target`; returns null when the order would not change. */
export function placeProfileBlock(order: readonly ProfileBlockKey[], key: ProfileBlockKey, target: ProfileBlockKey, after: boolean): ProfileBlockKey[] | null {
  if (key === target || !order.includes(key) || !order.includes(target)) return null;
  const next = order.filter(item => item !== key);
  next.splice(next.indexOf(target) + (after ? 1 : 0), 0, key);
  return next.every((item, index) => item === order[index]) ? null : next;
}
export function parseProfileLayout(value: unknown): ProfileLayout | null {
  if (!value || typeof value !== 'object') return null;
  const { order, hidden } = value as ProfileLayout;
  const valid = (keys: unknown): keys is ProfileBlockKey[] => Array.isArray(keys) && keys.every(key => PROFILE_BLOCKS.some(block => block.key === key)) && new Set(keys).size === keys.length;
  if (!valid(order) || !valid(hidden)) return null;
  // Layouts saved before a block existed only lack those later blocks: favorites joins hidden at the end,
  // the calendar right after the level and the collection right after the calendar.
  if (PROFILE_BLOCKS.some(block => !order.includes(block.key) && block.key !== 'favorites' && block.key !== 'calendar' && block.key !== 'collection')) return null;
  const nextOrder = [...order], nextHidden = [...hidden];
  if (!nextOrder.includes('calendar')) nextOrder.splice(nextOrder.indexOf('experience') + 1, 0, 'calendar');
  if (!nextOrder.includes('collection')) nextOrder.splice(nextOrder.indexOf('calendar') + 1, 0, 'collection');
  if (!nextOrder.includes('favorites')) { nextOrder.push('favorites'); if (!nextHidden.includes('favorites')) nextHidden.push('favorites'); }
  return { order: nextOrder, hidden: nextHidden.filter(key => !isRequiredProfileBlock(key)) };
}
