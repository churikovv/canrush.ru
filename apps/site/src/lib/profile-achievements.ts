export const ACHIEVEMENT_METRICS = [
  'listings', 'sales', 'reviews', 'detailedReviews', 'photoReviews', 'reviewLikes', 'brands', 'favorites', 'favoriteBrands',
  'tierLists', 'tierListLikes', 'friends', 'followers', 'whiteMonster', 'whiteMonsterFavorite', 'flash', 'flashDetailed',
  'burn', 'burnDetailed', 'burnFavorites', 'adrenaline', 'adrenalineDetailed', 'adrenalineFavorites',
  'admin', 'telegram', 'monthlyTop', 'drinkLogs', 'drinkStreak', 'contestWin', 'betaEngine',
] as const;
export type AchievementMetric = typeof ACHIEVEMENT_METRICS[number];
export type AchievementProgress = Record<AchievementMetric, number>;

/** A review counts as detailed once its trimmed text reaches this length. */
export const DETAILED_REVIEW_CHARS = 150;

export const ACHIEVEMENT_RARITIES = {
  common: 'Обычный',
  rare: 'Редкий',
  epic: 'Эпический',
  legendary: 'Легендарный',
  special: 'Особый',
} as const;
export type AchievementRarity = keyof typeof ACHIEVEMENT_RARITIES;

interface AchievementStep { metric: AchievementMetric; goal: number; label: string }
export interface ProfileAchievement { key: string; label: string; rarity: AchievementRarity; description: string; steps: readonly AchievementStep[] }

// Earned keys are stored in "profileAchievement" forever, so raising goals never revokes an old tag.
export const PROFILE_ACHIEVEMENTS: readonly ProfileAchievement[] = [
  { key: 'engine', label: 'Двигатель', rarity: 'special', description: 'Двигатель беты: один из первых 500 участников Canrush', steps: [
    { metric: 'betaEngine', goal: 1, label: 'Зарегистрироваться среди первых 500 участников' }] },
  { key: 'energizer', label: 'Энерджайзер', rarity: 'special', description: 'Секретный тег победителя розыгрыша ящика энергетиков', steps: [
    { metric: 'contestWin', goal: 1, label: 'Выиграть розыгрыш ящика энергетиков' }] },
  { key: 'top', label: 'ТОП', rarity: 'legendary', description: 'Победить в гонке месяца', steps: [
    { metric: 'monthlyTop', goal: 1, label: 'Попасть в топ-3 рейтинга месяца' }] },
  { key: 'streak-30', label: 'Серия 30', rarity: 'legendary', description: 'Месяц без единого пропуска', steps: [
    { metric: 'drinkStreak', goal: 30, label: 'Отмечать энергетик в календаре 30 дней подряд' }] },
  { key: 'six-seven', label: 'Six Seven', rarity: 'legendary', description: 'Путь настоящего дегустатора', steps: [
    { metric: 'reviews', goal: 67, label: 'Оценить 67 напитков' },
    { metric: 'detailedReviews', goal: 20, label: `Написать 20 развёрнутых отзывов (от ${DETAILED_REVIEW_CHARS} символов)` },
    { metric: 'brands', goal: 15, label: 'Попробовать 15 брендов' }] },
  { key: 'burner', label: 'Burner', rarity: 'epic', description: 'Прожечь линейку Burn насквозь', steps: [
    { metric: 'burn', goal: 5, label: 'Оценить 5 вкусов Burn' },
    { metric: 'burnDetailed', goal: 3, label: `Написать 3 развёрнутых отзыва на Burn (от ${DETAILED_REVIEW_CHARS} символов)` },
    { metric: 'burnFavorites', goal: 1, label: 'Добавить Burn в избранное' }] },
  { key: 'adrenaline', label: 'Adrenaline', rarity: 'epic', description: 'Разогнать пульс линейкой Adrenaline', steps: [
    { metric: 'adrenaline', goal: 5, label: 'Оценить 5 вкусов Adrenaline или Adrenaline Rush' },
    { metric: 'adrenalineDetailed', goal: 3, label: `Написать 3 развёрнутых отзыва на Adrenaline (от ${DETAILED_REVIEW_CHARS} символов)` },
    { metric: 'adrenalineFavorites', goal: 1, label: 'Добавить Adrenaline в избранное' }] },
  { key: 'streak-14', label: 'Серия 14', rarity: 'epic', description: 'Две недели на заряде', steps: [
    { metric: 'drinkStreak', goal: 14, label: 'Отмечать энергетик в календаре 14 дней подряд' }] },
  { key: 'deadinside', label: 'Deadinside', rarity: 'epic', description: 'Тирлисты, о которых говорят', steps: [
    { metric: 'tierLists', goal: 5, label: 'Опубликовать 5 тирлистов' },
    { metric: 'tierListLikes', goal: 10, label: 'Собрать 10 лайков на тирлистах' }] },
  { key: 'streak-7', label: 'Серия 7', rarity: 'rare', description: 'Неделя, когда птица довольна', steps: [
    { metric: 'drinkStreak', goal: 7, label: 'Отмечать энергетик в календаре 7 дней подряд' }] },
  { key: 'seller', label: 'Селлер', rarity: 'rare', description: 'Довести сделки до конца', steps: [
    { metric: 'listings', goal: 1, label: 'Опубликовать товар в маркете' },
    { metric: 'sales', goal: 3, label: 'Завершить 3 продажи' }] },
  { key: 'altushka', label: 'Альтушка', rarity: 'rare', description: 'Белый Monster — образ жизни', steps: [
    { metric: 'whiteMonster', goal: 1, label: 'Оценить Monster Ultra White' },
    { metric: 'whiteMonsterFavorite', goal: 1, label: 'Добавить Monster Ultra White в избранное' }] },
  { key: 'flash', label: 'Флэш', rarity: 'rare', description: 'Быстрее всех по линейке Flash Up', steps: [
    { metric: 'flash', goal: 3, label: 'Оценить 3 вкуса Flash Up' },
    { metric: 'flashDetailed', goal: 1, label: `Написать развёрнутый отзыв на Flash Up (от ${DETAILED_REVIEW_CHARS} символов)` }] },
  { key: 'critic', label: 'Mad', rarity: 'rare', description: 'Отзывы, которые читают', steps: [
    { metric: 'reviews', goal: 15, label: 'Оценить 15 напитков' },
    { metric: 'detailedReviews', goal: 5, label: `Написать 5 развёрнутых отзывов (от ${DETAILED_REVIEW_CHARS} символов)` },
    { metric: 'reviewLikes', goal: 5, label: 'Получить 5 лайков на отзывах' }] },
  { key: 'explorer', label: 'Nya ^^', rarity: 'rare', description: 'Исследовать полку целиком', steps: [
    { metric: 'brands', goal: 8, label: 'Оценить напитки 8 брендов' },
    { metric: 'photoReviews', goal: 3, label: 'Приложить фото к 3 отзывам' }] },
  { key: 'collector', label: 'Коллекционер', rarity: 'rare', description: 'Собрать настоящую коллекцию', steps: [
    { metric: 'favorites', goal: 25, label: 'Добавить 25 напитков в избранное' },
    { metric: 'favoriteBrands', goal: 8, label: 'Собрать в избранном 8 брендов' }] },
  { key: 'friend', label: 'Пепе', rarity: 'rare', description: 'Обрасти своей тусовкой', steps: [
    { metric: 'friends', goal: 3, label: 'Найти 3 взаимных подписчика' },
    { metric: 'followers', goal: 5, label: 'Набрать 5 подписчиков' }] },
  { key: 'first-review', label: 'Первое открытие', rarity: 'common', description: 'Первый шаг', steps: [
    { metric: 'reviews', goal: 1, label: 'Оставить первый отзыв' }] },
  { key: 'three', label: ':3', rarity: 'common', description: 'Втянуться', steps: [
    { metric: 'reviews', goal: 3, label: 'Оценить 3 напитка' }] },
  { key: 'drink-start', label: 'Первый глоток', rarity: 'common', description: 'Завести календарь выпитого', steps: [
    { metric: 'drinkLogs', goal: 1, label: 'Отметить первый энергетик в календаре' }] },
  { key: 'kitty', label: 'Котик', rarity: 'common', description: 'Начать собирать любимое', steps: [
    { metric: 'favorites', goal: 5, label: 'Добавить 5 напитков в избранное' }] },
  { key: 'telegram', label: 'Телега', rarity: 'common', description: 'Связь с автором', steps: [
    { metric: 'telegram', goal: 1, label: 'Указать Telegram в настройках профиля' }] },
  { key: 'admin', label: 'Админ', rarity: 'special', description: 'Только для действующих администраторов', steps: [
    { metric: 'admin', goal: 1, label: 'Быть администратором сайта' }] },
];

export function achievementStepsDone(item: ProfileAchievement, progress: AchievementProgress): number {
  return item.steps.filter(step => progress[step.metric] >= step.goal).length;
}

/** Share of the combined goal reached, capped per step so one grind cannot carry the rest. */
export function achievementCompletion(item: ProfileAchievement, progress: AchievementProgress): number {
  const total = item.steps.reduce((sum, step) => sum + step.goal, 0);
  return item.steps.reduce((sum, step) => sum + Math.min(progress[step.metric], step.goal), 0) / total;
}

export function eligibleAchievements(progress: AchievementProgress): string[] {
  return PROFILE_ACHIEVEMENTS.filter(item => achievementStepsDone(item, progress) === item.steps.length).map(item => item.key);
}

/** Tags hidden from everyone but admins and those who already have them. */
const SECRET_ACHIEVEMENTS = new Set(['energizer']);
export function visibleProfileAchievements(viewerIsAdmin: boolean, earned: readonly string[] = []) {
  return PROFILE_ACHIEVEMENTS.filter(item => item.key === 'admin' ? viewerIsAdmin : !SECRET_ACHIEVEMENTS.has(item.key) || viewerIsAdmin || earned.includes(item.key));
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

const ACHIEVEMENT_ART = new Set(['engine', 'energizer', 'top', 'seller', 'altushka', 'flash', 'collector', 'admin', 'kitty', 'critic', 'burner', 'telegram', 'friend', 'three', 'first-review', 'explorer', 'adrenaline', 'deadinside', 'six-seven', 'drink-start', 'streak-7', 'streak-14', 'streak-30']);
export function achievementImage(key: string): string {
  return ACHIEVEMENT_ART.has(key) ? `/brand/achievements/${key}.png` : '/brand/icons/achievement.svg';
}
export function profileTagKey(value: string | null | undefined): string | undefined {
  return PROFILE_ACHIEVEMENTS.find(item => item.key === value || item.label === value)?.key;
}
