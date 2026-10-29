export const PROFILE_BLOCKS = [
  { key: 'experience', label: 'Уровень', area: 'main' },
  { key: 'calendar', label: 'Трекер выпитого', area: 'main' },
  { key: 'collection', label: 'Коллекция вкусов', area: 'main' },
  { key: 'ratings', label: 'Статистика оценок', area: 'main' },
  { key: 'listings', label: 'Объявления', area: 'main' },
  { key: 'social', label: 'Друзья и подписки', area: 'side' },
  { key: 'favorites', label: 'Избранное', area: 'main' },
  { key: 'drinks', label: 'Добавленные напитки', area: 'main' },
  { key: 'cards', label: 'Карточки Банкомата', area: 'main' },
  { key: 'about', label: 'О профиле', area: 'side' },
  { key: 'wall', label: 'Стена', area: 'main' },
] as const;
export type ProfileBlockKey = typeof PROFILE_BLOCKS[number]['key'];
export function isRequiredProfileBlock(key: ProfileBlockKey): boolean { return key === 'experience' || key === 'social'; }
/** Rows inside a block that the owner can hide while the block itself stays visible. */
export const PROFILE_BLOCK_FIELDS = { about: [{ key: 'telegramUsername', label: 'Личный Telegram' }, { key: 'telegramChannel', label: 'Telegram-канал' }] } as const;
export type ProfileFieldKey = typeof PROFILE_BLOCK_FIELDS.about[number]['key'];
export type ProfileLayout = { order: ProfileBlockKey[]; hidden: ProfileBlockKey[]; hiddenFields?: ProfileFieldKey[] };
export const DEFAULT_PROFILE_LAYOUT: ProfileLayout = { order: PROFILE_BLOCKS.map(x => x.key), hidden: ['favorites', 'listings', 'drinks', 'cards'] };
/** Places `key` right before or after `target`; returns null when the order would not change. */
export function placeProfileBlock(order: readonly ProfileBlockKey[], key: ProfileBlockKey, target: ProfileBlockKey, after: boolean): ProfileBlockKey[] | null {
  if (key === target || !order.includes(key) || !order.includes(target)) return null;
  const next = order.filter(item => item !== key);
  next.splice(next.indexOf(target) + (after ? 1 : 0), 0, key);
  return next.every((item, index) => item === order[index]) ? null : next;
}
export function parseProfileLayout(value: unknown): ProfileLayout | null {
  if (!value || typeof value !== 'object') return null;
  const { order, hidden, hiddenFields = [] } = value as ProfileLayout;
  const valid = (keys: unknown): keys is ProfileBlockKey[] => Array.isArray(keys) && keys.every(key => PROFILE_BLOCKS.some(block => block.key === key)) && new Set(keys).size === keys.length;
  if (!valid(order) || !valid(hidden)) return null;
  if (!Array.isArray(hiddenFields) || !hiddenFields.every(key => PROFILE_BLOCK_FIELDS.about.some(field => field.key === key)) || new Set(hiddenFields).size !== hiddenFields.length) return null;
  // Layouts saved before a block existed only lack those later blocks: favorites joins hidden at the end,
  // the calendar right after the level, the collection right after the calendar, and the optional «Добавленные напитки»
  // and «Карточки Банкомата» join hidden before the wall.
  if (PROFILE_BLOCKS.some(block => !order.includes(block.key) && block.key !== 'favorites' && block.key !== 'calendar' && block.key !== 'collection' && block.key !== 'drinks' && block.key !== 'cards')) return null;
  const nextOrder = [...order], nextHidden = [...hidden];
  if (!nextOrder.includes('calendar')) nextOrder.splice(nextOrder.indexOf('experience') + 1, 0, 'calendar');
  if (!nextOrder.includes('collection')) nextOrder.splice(nextOrder.indexOf('calendar') + 1, 0, 'collection');
  if (!nextOrder.includes('favorites')) { nextOrder.push('favorites'); if (!nextHidden.includes('favorites')) nextHidden.push('favorites'); }
  if (!nextOrder.includes('drinks')) { const wall = nextOrder.indexOf('wall'); nextOrder.splice(wall >= 0 ? wall : nextOrder.length, 0, 'drinks'); if (!nextHidden.includes('drinks')) nextHidden.push('drinks'); }
  // «Карточки Банкомата» (gacha, stage 2) join hidden before the wall the same way.
  if (!nextOrder.includes('cards')) { const wall = nextOrder.indexOf('wall'); nextOrder.splice(wall >= 0 ? wall : nextOrder.length, 0, 'cards'); if (!nextHidden.includes('cards')) nextHidden.push('cards'); }
  return { order: nextOrder, hidden: nextHidden.filter(key => !isRequiredProfileBlock(key)), ...(hiddenFields.length ? { hiddenFields: [...hiddenFields] } : {}) };
}
