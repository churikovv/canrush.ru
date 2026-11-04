import { achievementStepsDone, type ProfileAchievement } from '@/lib/profile-achievements';

/** What the achievements that are not tags count; `getBadges` (`badge-progress.ts`) reads each one with a cheap count. */
export const BADGE_METRICS = [
  'fullBrands', 'companyReplies', 'storeCount', 'publishedArticles', 'drinkAnswers', 'collectionPhotos',
  'gachaPulls', 'craftedCards', 'battlesPlayed', 'battleWins', 'questDays',
] as const;
export type BadgeMetric = typeof BADGE_METRICS[number];
export type BadgeProgress = Record<BadgeMetric, number>;

/**
 * Achievements that are only achievements: they can never be worn as a tag next to the name and pay no XP, only trophy
 * points (`TROPHY_POINTS`). Brands, the site and its newer mechanics. The site is 18+, so none of them counts cans in the
 * tracker. Keys are stored in "profileBadge" and name the art in `public/brand/medals/<key>.png`: never rename them.
 */
export const BADGE_ACHIEVEMENTS: readonly ProfileAchievement<BadgeMetric>[] = [
  { key: 'full-shelf', label: 'Полная полка', rarity: 'legendary', description: 'Собрать в коллекции все вкусы одного бренда', steps: [
    { metric: 'fullBrands', goal: 1, label: 'Собрать все вкусы одного бренда' }] },
  { key: 'brand-reply', label: 'Ответ бренда', rarity: 'rare', description: 'Отзыв, который заметил сам бренд', steps: [
    { metric: 'companyReplies', goal: 1, label: 'Получить ответ компании на свой отзыв' }] },
  { key: 'cartographer', label: 'Картограф', rarity: 'epic', description: 'Нанести на карту пять магазинов', steps: [
    { metric: 'storeCount', goal: 5, label: 'Добавить 5 магазинов, которые прошли проверку' }] },
  { key: 'columnist', label: 'Колумнист', rarity: 'rare', description: 'Своя колонка в «Новостях»', steps: [
    { metric: 'publishedArticles', goal: 1, label: 'Опубликовать статью в «Новостях»' }] },
  { key: 'help-desk', label: 'Справочное бюро', rarity: 'rare', description: 'Отвечать на вопросы о напитках', steps: [
    { metric: 'drinkAnswers', goal: 5, label: 'Ответить на 5 вопросов о напитках' }] },
  { key: 'shelf-photos', label: 'Полка напоказ', rarity: 'common', description: 'Показать свою коллекцию банок', steps: [
    { metric: 'collectionPhotos', goal: 3, label: 'Добавить 3 фото коллекции в профиль' }] },
  { key: 'first-pull', label: 'Первая крутка', rarity: 'common', description: 'Первая банка из Банкомата', steps: [
    { metric: 'gachaPulls', goal: 1, label: 'Покрутить Банкомат' }] },
  { key: 'crafter', label: 'Из осколков', rarity: 'rare', description: 'Собрать карточку своими руками', steps: [
    { metric: 'craftedCards', goal: 1, label: 'Собрать карточку из осколков' }] },
  { key: 'battle-win', label: 'Победа над Совой', rarity: 'common', description: 'Обыграть Сову в «Битве банок»', steps: [
    { metric: 'battleWins', goal: 1, label: 'Выиграть бой у Совы' }] },
  { key: 'battle', label: 'Битва банок', rarity: 'rare', description: 'Десять боёв до конца', steps: [
    { metric: 'battlesPlayed', goal: 10, label: 'Сыграть 10 боёв с Совой' }] },
  { key: 'quest-week', label: 'Неделя заданий', rarity: 'rare', description: 'Семь дней со всеми заданиями Банкомата', steps: [
    { metric: 'questDays', goal: 7, label: '7 раз забрать бонус за все задания дня' }] },
];
export const BADGE_KEYS: ReadonlySet<string> = new Set(BADGE_ACHIEVEMENTS.map(item => item.key));

/** Keys whose every step is done. */
export function earnedBadges(progress: BadgeProgress): string[] {
  return BADGE_ACHIEVEMENTS.filter(item => achievementStepsDone(item, progress) === item.steps.length).map(item => item.key);
}
