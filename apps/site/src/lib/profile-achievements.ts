export interface AchievementProgress {
  reviews: number;
  brands: number;
  favorites: number;
  tierLists: number;
  friends: number;
  burn: number;
  adrenaline: number;
  admin: number;
  telegram: number;
}

export const PROFILE_ACHIEVEMENTS = [
  { key: 'burner', label: 'Burner', description: 'Оценить 3 напитка Burn', metric: 'burn', goal: 3 },
  { key: 'adrenaline', label: 'Adrenaline', description: 'Оценить 3 напитка Adrenaline или Adrenaline Rush', metric: 'adrenaline', goal: 3 },
  { key: 'six-seven', label: 'Six Seven', description: 'Оценить 67 напитков', metric: 'reviews', goal: 67 },
  { key: 'collector', label: 'Коллекционер', description: 'Добавить 10 напитков в избранное', metric: 'favorites', goal: 10 },
  { key: 'first-review', label: 'Первое открытие', description: 'Оставить первый отзыв', metric: 'reviews', goal: 1 },
  { key: 'admin', label: 'Админ', description: 'Только для действующих администраторов', metric: 'admin', goal: 1 },
  { key: 'friend', label: 'Пепе', description: 'Найти первого взаимного подписчика', metric: 'friends', goal: 1 },
  { key: 'critic', label: 'Mad', description: 'Оценить 10 напитков', metric: 'reviews', goal: 10 },
  { key: 'deadinside', label: 'Deadinside', description: 'Опубликовать 3 тирлиста', metric: 'tierLists', goal: 3 },
  { key: 'explorer', label: 'Nya ^^', description: 'Оценить напитки 5 брендов', metric: 'brands', goal: 5 },
  { key: 'three', label: ':3', description: 'Оценить 3 напитка', metric: 'reviews', goal: 3 },
  { key: 'kitty', label: 'Котик', description: 'Добавить 5 напитков в избранное', metric: 'favorites', goal: 5 },
  { key: 'telegram', label: 'Телега', description: 'Указать Telegram в настройках профиля', metric: 'telegram', goal: 1 },
] as const satisfies ReadonlyArray<{ key: string; label: string; description: string; metric: keyof AchievementProgress; goal: number }>;

export function eligibleAchievements(progress: AchievementProgress): string[] {
  return PROFILE_ACHIEVEMENTS.filter(item => progress[item.metric] >= item.goal).map(item => item.key);
}

export function visibleProfileAchievements(viewerIsAdmin: boolean) {
  return PROFILE_ACHIEVEMENTS.filter(item => item.metric !== 'admin' || viewerIsAdmin);
}

export function validateProfileTags(value: unknown, earned: string[]): string[] | null {
  if (!Array.isArray(value) || value.length > 1 || value.some(tag => typeof tag !== 'string')) return null;
  return value.every(tag => earned.includes(tag) && PROFILE_ACHIEVEMENTS.some(item => item.key === tag)) ? value : null;
}

export function profileTagLabel(key: string | null | undefined): string | undefined {
  return PROFILE_ACHIEVEMENTS.find(item => item.key === key)?.label;
}

export function validateWallText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text.length >= 1 && text.length <= 1000 ? text : null;
}

export function profilePageNumber(value: unknown): number {
  const page = typeof value === 'string' ? Number(value) : value;
  return typeof page === 'number' && Number.isSafeInteger(page) && page > 0 && page <= 100000 ? page : 1;
}

const ACHIEVEMENT_ART = new Set(['admin', 'kitty', 'critic', 'burner', 'telegram', 'friend', 'three', 'first-review', 'explorer', 'adrenaline', 'deadinside', 'six-seven']);
export function achievementImage(key: string): string {
  return ACHIEVEMENT_ART.has(key) ? `/brand/achievements/${key}.png` : '/brand/icons/achievement.svg';
}
export function profileTagKey(value: string | null | undefined): string | undefined {
  return PROFILE_ACHIEVEMENTS.find(item => item.key === value || item.label === value)?.key;
}
