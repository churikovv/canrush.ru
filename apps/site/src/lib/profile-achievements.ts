import { isShopTag, SHOP_TAGS } from '@/lib/shop-items';

export const ACHIEVEMENT_METRICS = [
  'listings', 'sales', 'reviews', 'detailedReviews', 'photoReviews', 'reviewLikes', 'brands', 'favorites', 'favoriteBrands',
  'tierLists', 'tierListLikes', 'friends', 'followers', 'whiteMonster', 'whiteMonsterFavorite', 'flash', 'flashDetailed',
  'burn', 'burnDetailed', 'burnFavorites', 'adrenaline', 'adrenalineDetailed', 'adrenalineFavorites',
  'admin', 'moderator', 'telegram', 'monthlyTop', 'drinkLogs', 'drinkStreak', 'contestWin', 'betaEngine', 'weekHero', 'weekBest', 'weekCharge',
  'monster', 'monsterDetailed', 'weeklyXp', 'publishedStores', 'swipes', 'swipeLikes', 'publishedDrinks',
  'classicBrands', 'accountDays', 'longReviews', 'comments', 'bestReviewLikes', 'profileLook', 'wallPosts',
  'redBull', 'redBullFavorites', 'volt', 'voltFavorites',
] as const;
export type AchievementMetric = typeof ACHIEVEMENT_METRICS[number];
export type AchievementProgress = Record<AchievementMetric, number>;

/** A review counts as detailed once its trimmed text reaches this length. */
export const DETAILED_REVIEW_CHARS = 150;
/** «Душнила»: a review this long is a wall of text. */
export const LONG_REVIEW_CHARS = 500;
/** «Фан»: XP within any 7 days in a row. Rewards for the monthly top and for tags themselves do not count. */
export const FAN_WEEKLY_XP = 300;
/** XP before this day came partly from bulk backfills stamped with one moment, so «Фан» only counts later awards. */
export const FAN_XP_SINCE = '2026-10-21';

export const ACHIEVEMENT_RARITIES = {
  common: 'Обычный',
  rare: 'Редкий',
  epic: 'Эпический',
  legendary: 'Легендарный',
  special: 'Особый',
} as const;
export type AchievementRarity = keyof typeof ACHIEVEMENT_RARITIES;

interface AchievementStep<M extends string = AchievementMetric> { metric: M; goal: number; label: string }
/** A tag (metrics of `getProfileCommunity`) or, with its own metrics, an achievement that is not a tag (`lib/badges.ts`). */
/**
 * `tiers`: goals of the higher tiers (II, III), one number per step in the same order — like divisions, the same
 * achievement again, harder. Tier I is `steps`. One-off achievements (a role, a channel, a brand's short line) have none.
 */
export interface ProfileAchievement<M extends string = AchievementMetric> { key: string; label: string; rarity: AchievementRarity; description: string; steps: readonly AchievementStep<M>[]; tiers?: readonly (readonly number[])[] }

// Earned keys are stored in "profileAchievement" forever, so raising goals never revokes an old tag. The week tags are the
// exception: `settle_weekly_top` gives them for a week and takes them back at the next results.
export const PROFILE_ACHIEVEMENTS: readonly ProfileAchievement[] = [
  { key: 'engine', label: 'Двигатель', rarity: 'special', description: 'Двигатель беты: один из первых 500 участников Canrush', steps: [
    { metric: 'betaEngine', goal: 1, label: 'Зарегистрироваться среди первых 500 участников' }] },
  { key: 'energizer', label: 'Энерджайзер', rarity: 'special', description: 'Секретный тег победителя розыгрыша ящика энергетиков', steps: [
    { metric: 'contestWin', goal: 1, label: 'Выиграть розыгрыш ящика энергетиков' }] },
  { key: 'top', label: 'ТОП', rarity: 'legendary', description: 'Победитель гонки месяца. Больше не выдаётся и остаётся у победителей', steps: [
    { metric: 'monthlyTop', goal: 1, label: 'Попасть в топ-3 рейтинга месяца' }] },
  { key: 'week-hero', label: 'Герой недели', rarity: 'special', description: 'Первое место в гонке недели. Тег держится до следующих итогов', steps: [
    { metric: 'weekHero', goal: 1, label: 'Занять первое место за неделю' }] },
  { key: 'week-best', label: 'Лучшие недели', rarity: 'special', description: 'Места со 2 по 5 в гонке недели. Тег держится до следующих итогов', steps: [
    { metric: 'weekBest', goal: 1, label: 'Попасть в топ-5 за неделю' }] },
  { key: 'week-charge', label: 'Заряд недели', rarity: 'special', description: 'Места с 6 по 10 в гонке недели. Тег держится до следующих итогов', steps: [
    { metric: 'weekCharge', goal: 1, label: 'Попасть в топ-10 за неделю' }] },
  { key: 'streak-30', label: 'Серия 30', rarity: 'legendary', description: 'Месяц без единого пропуска', steps: [
    { metric: 'drinkStreak', goal: 30, label: 'Отмечать энергетик в трекере 30 дней подряд' }] },
  { key: 'six-seven', label: 'Six Seven', rarity: 'legendary', description: 'Путь настоящего дегустатора', steps: [
    { metric: 'reviews', goal: 67, label: 'Оценить 67 напитков' },
    { metric: 'detailedReviews', goal: 20, label: `Написать 20 развёрнутых отзывов (от ${DETAILED_REVIEW_CHARS} символов)` },
    { metric: 'brands', goal: 15, label: 'Попробовать 15 брендов' }], tiers: [[100, 35, 25], [150, 67, 35]] },
  { key: 'burner', label: 'Burner', rarity: 'epic', description: 'Прожечь линейку Burn насквозь', steps: [
    { metric: 'burn', goal: 5, label: 'Оценить 5 вкусов Burn' },
    { metric: 'burnDetailed', goal: 3, label: `Написать 3 развёрнутых отзыва на Burn (от ${DETAILED_REVIEW_CHARS} символов)` },
    { metric: 'burnFavorites', goal: 1, label: 'Добавить Burn в избранное' }] },
  { key: 'adrenaline', label: 'Adrenaline', rarity: 'epic', description: 'Разогнать пульс линейкой Adrenaline', steps: [
    { metric: 'adrenaline', goal: 5, label: 'Оценить 5 вкусов Adrenaline или Adrenaline Rush' },
    { metric: 'adrenalineDetailed', goal: 3, label: `Написать 3 развёрнутых отзыва на Adrenaline (от ${DETAILED_REVIEW_CHARS} символов)` },
    { metric: 'adrenalineFavorites', goal: 1, label: 'Добавить Adrenaline в избранное' }] },
  { key: 'monster', label: 'Монстр', rarity: 'epic', description: 'Выпустить зверя из линейки Monster Energy', steps: [
    { metric: 'monster', goal: 3, label: 'Оценить 3 вкуса Monster Energy' },
    { metric: 'monsterDetailed', goal: 3, label: `Написать 3 развёрнутых отзыва на Monster (от ${DETAILED_REVIEW_CHARS} символов)` }] },
  // Likes on reviews are scarce (November 2026: no review had more than 3), so one review with 3 is already a feat.
  { key: 'based', label: 'База', rarity: 'epic', description: 'Отзыв, с которым не поспоришь', steps: [
    { metric: 'bestReviewLikes', goal: 3, label: 'Собрать 3 лайка на одном отзыве' }], tiers: [[8], [15]] },
  { key: 'streak-14', label: 'Серия 14', rarity: 'epic', description: 'Две недели на заряде', steps: [
    { metric: 'drinkStreak', goal: 14, label: 'Отмечать энергетик в трекере 14 дней подряд' }] },
  { key: 'deadinside', label: 'Deadinside', rarity: 'epic', description: 'Тирлисты, о которых говорят', steps: [
    // Lowered from 5 tier lists and 10 likes (October 2026): there was too little activity to reach it.
    { metric: 'tierLists', goal: 1, label: 'Опубликовать тирлист' },
    { metric: 'tierListLikes', goal: 1, label: 'Получить лайк на тирлисте' }], tiers: [[3, 5], [5, 15]] },
  { key: 'streak-7', label: 'Серия 7', rarity: 'rare', description: 'Неделя, когда птица довольна', steps: [
    { metric: 'drinkStreak', goal: 7, label: 'Отмечать энергетик в трекере 7 дней подряд' }] },
  { key: 'fan', label: 'Фан', rarity: 'rare', description: 'Неделя, когда Canrush не отпускал', steps: [
    { metric: 'weeklyXp', goal: FAN_WEEKLY_XP, label: `Набрать ${FAN_WEEKLY_XP} XP за 7 дней подряд` }], tiers: [[750], [1500]] },
  { key: 'seller', label: 'Селлер', rarity: 'rare', description: 'Довести сделки до конца', steps: [
    { metric: 'listings', goal: 1, label: 'Опубликовать товар в маркете' },
    { metric: 'sales', goal: 3, label: 'Завершить 3 продажи' }] },
  { key: 'altushka', label: 'Альтушка', rarity: 'rare', description: 'Белый Monster — образ жизни', steps: [
    { metric: 'whiteMonster', goal: 1, label: 'Оценить Monster Ultra White' },
    { metric: 'whiteMonsterFavorite', goal: 1, label: 'Добавить Monster Ultra White в избранное' }] },
  { key: 'flash', label: 'Флэш', rarity: 'rare', description: 'Быстрее всех по линейке Flash Up', steps: [
    { metric: 'flash', goal: 3, label: 'Оценить 3 вкуса Flash Up' },
    { metric: 'flashDetailed', goal: 1, label: `Написать развёрнутый отзыв на Flash Up (от ${DETAILED_REVIEW_CHARS} символов)` }] },
  { key: 'dushnila', label: 'Душнила', rarity: 'rare', description: 'Вообще-то, тут есть нюанс', steps: [
    { metric: 'longReviews', goal: 3, label: `Написать 3 отзыва от ${LONG_REVIEW_CHARS} символов` },
    { metric: 'comments', goal: 5, label: 'Оставить 5 комментариев в обсуждениях' }], tiers: [[8, 13], [15, 25]] },
  { key: 'boomer', label: 'Бумер', rarity: 'rare', description: 'Классика лучше любых новинок', steps: [
    { metric: 'classicBrands', goal: 5, label: 'Оценить оригинальный вкус 5 брендов' },
    { metric: 'accountDays', goal: 30, label: 'Пробыть на CanRush 30 дней' }], tiers: [[10, 90], [15, 180]] },
  { key: 'winged', label: 'Окрылённый', rarity: 'rare', description: 'Пролететь по линейке Red Bull', steps: [
    { metric: 'redBull', goal: 5, label: 'Оценить 5 вкусов Red Bull' },
    { metric: 'redBullFavorites', goal: 1, label: 'Добавить Red Bull в избранное' }] },
  { key: 'voltage', label: 'Под напряжением', rarity: 'rare', description: 'Пропустить через себя линейку Volt', steps: [
    { metric: 'volt', goal: 5, label: 'Оценить 5 вкусов Volt' },
    { metric: 'voltFavorites', goal: 1, label: 'Добавить Volt в избранное' }] },
  { key: 'critic', label: 'Mad', rarity: 'rare', description: 'Отзывы, которые читают', steps: [
    { metric: 'reviews', goal: 15, label: 'Оценить 15 напитков' },
    { metric: 'detailedReviews', goal: 5, label: `Написать 5 развёрнутых отзывов (от ${DETAILED_REVIEW_CHARS} символов)` },
    { metric: 'reviewLikes', goal: 5, label: 'Получить 5 лайков на отзывах' }], tiers: [[38, 13, 13], [75, 25, 25]] },
  { key: 'explorer', label: 'Nya ^^', rarity: 'rare', description: 'Исследовать полку целиком', steps: [
    { metric: 'brands', goal: 8, label: 'Оценить напитки 8 брендов' },
    { metric: 'photoReviews', goal: 3, label: 'Приложить фото к 3 отзывам' }], tiers: [[15, 8], [25, 15]] },
  { key: 'collector', label: 'Коллекционер', rarity: 'rare', description: 'Собрать настоящую коллекцию', steps: [
    { metric: 'favorites', goal: 25, label: 'Добавить 25 напитков в избранное' },
    { metric: 'favoriteBrands', goal: 8, label: 'Собрать в избранном 8 брендов' }], tiers: [[60, 15], [120, 25]] },
  { key: 'three', label: ':3', rarity: 'common', description: 'Втянуться', steps: [
    { metric: 'reviews', goal: 3, label: 'Оценить 3 напитка' }], tiers: [[10], [30]] },
  { key: 'kitty', label: 'Котик', rarity: 'common', description: 'Начать собирать любимое', steps: [
    { metric: 'favorites', goal: 5, label: 'Добавить 5 напитков в избранное' }], tiers: [[13], [25]] },
  { key: 'pickme', label: 'Пикми', rarity: 'common', description: 'Не такая, как все, и пусть все это видят', steps: [
    { metric: 'profileLook', goal: 3, label: 'Оформить профиль: аватарка, баннер и пара слов о себе' },
    { metric: 'wallPosts', goal: 3, label: 'Опубликовать 3 записи в ленте или на стене' }], tiers: [[3, 8], [3, 15]] },
  { key: 'shopper', label: 'Шоппер', rarity: 'common', description: 'Показать всем, где купить энергетики', steps: [
    { metric: 'publishedStores', goal: 1, label: 'Поделиться магазином: после проверки он виден всем' }], tiers: [[3], [5]] },
  { key: 'sensei', label: 'Сэнсэй', rarity: 'rare', description: 'Исследователь: открывать сообществу новые напитки', steps: [
    { metric: 'publishedDrinks', goal: 3, label: 'Добавить в каталог 3 напитка, прошедших проверку' }], tiers: [[8], [15]] },
  { key: 'date', label: 'Люблю <3', rarity: 'common', description: 'Свидание: сходить на дейтинг напитков', steps: [
    { metric: 'swipes', goal: 20, label: 'Свайпнуть 20 напитков в дейтинге' },
    { metric: 'swipeLikes', goal: 5, label: 'Найти 5 мэтчей — свайпнуть вправо' }], tiers: [[50, 13], [100, 25]] },
  { key: 'telegram', label: 'Телега', rarity: 'common', description: 'Связь с автором', steps: [
    { metric: 'telegram', goal: 1, label: 'Указать Telegram в настройках профиля' }] },
  { key: 'admin', label: 'Админ', rarity: 'special', description: 'Только для действующих администраторов', steps: [
    { metric: 'admin', goal: 1, label: 'Быть администратором сайта' }] },
  { key: 'moderator', label: 'Модератор', rarity: 'special', description: 'Только для действующих модераторов', steps: [
    { metric: 'moderator', goal: 1, label: 'Быть модератором сайта' }] },
];

/**
 * Tags that follow a role in the admin panel instead of being earned once: they are not stored in profileAchievement,
 * appear while the member holds the role (siteAdmin.role) and go away with it.
 */
export const ROLE_TAGS: ReadonlySet<string> = new Set(['admin', 'moderator']);

export const TIER_NUMERALS = ['I', 'II', 'III'] as const;
/** Nouns that follow a number in step labels, as one, two and five of them. */
const NOUN_FORMS = [['лайк', 'лайка', 'лайков'], ['отзыв', 'отзыва', 'отзывов'], ['напиток', 'напитка', 'напитков'], ['запись', 'записи', 'записей']] as const;
function agree(noun: string, count: number): string {
  const forms = NOUN_FORMS.find(item => (item as readonly string[]).includes(noun));
  if (!forms) return noun;
  const tens = count % 100, units = count % 10;
  return tens >= 11 && tens <= 14 ? forms[2] : units === 1 ? forms[0] : units >= 2 && units <= 4 ? forms[1] : forms[2];
}
/** How many tiers an achievement has: 1 for a one-off. */
export const tierCount = (item: { tiers?: readonly (readonly number[])[] }) => 1 + (item.tiers?.length ?? 0);
/** The steps of a tier (1-based): the same steps with that tier's goals; the number in each label follows the goal. */
export function tierSteps<M extends string>(item: ProfileAchievement<M>, tier: number): readonly AchievementStep<M>[] {
  const goals = tier > 1 ? item.tiers?.[tier - 2] : undefined;
  if (!goals) return item.steps;
  return item.steps.map((step, index) => {
    const goal = goals[index] ?? step.goal;
    if (goal === step.goal) return step;
    const number = new RegExp(`(^|\\D)${step.goal}(?=\\D|$)`);
    // A label without its number («Опубликовать тирлист») gets the tier's goal after a dot.
    if (!number.test(step.label)) return { ...step, goal, label: `${step.label} · ${goal}` };
    // «3 лайка» → «8 лайков»: the noun after the number agrees with the new one.
    return { ...step, goal, label: step.label.replace(new RegExp(`(^|\\D)${step.goal}( ([а-яё]+))?`), (_, before: string, __, noun?: string) => `${before}${goal}${noun ? ` ${agree(noun, goal)}` : ''}`) };
  });
}
/** The highest tier whose every step is done; 0 while tier I is not. */
export function achievementTier<M extends string>(item: ProfileAchievement<M>, progress: Record<M, number>): number {
  let reached = 0;
  for (let tier = 1; tier <= tierCount(item); tier++) {
    if (tierSteps(item, tier).every(step => progress[step.metric] >= step.goal)) reached = tier; else break;
  }
  return reached;
}

export function achievementStepsDone<M extends string>(item: ProfileAchievement<M>, progress: Record<M, number>): number {
  return item.steps.filter(step => progress[step.metric] >= step.goal).length;
}

/** Share of the combined goal reached, capped per step so one grind cannot carry the rest. */
export function achievementCompletion<M extends string>(item: ProfileAchievement<M>, progress: Record<M, number>): number {
  const total = item.steps.reduce((sum, step) => sum + step.goal, 0);
  return item.steps.reduce((sum, step) => sum + Math.min(progress[step.metric], step.goal), 0) / total;
}

export function eligibleAchievements(progress: AchievementProgress): string[] {
  return PROFILE_ACHIEVEMENTS.filter(item => achievementStepsDone(item, progress) === item.steps.length).map(item => item.key);
}

/** Tags hidden from everyone but admins and those who already have them. */
const SECRET_ACHIEVEMENTS = new Set(['energizer', 'top', 'week-hero', 'week-best', 'week-charge']);
/** The moderator tag is listed for administrators and for the moderator who holds it, like a secret one. */
export function visibleProfileAchievements(viewerIsAdmin: boolean, earned: readonly string[] = []) {
  return PROFILE_ACHIEVEMENTS.filter(item => item.key === 'admin' ? viewerIsAdmin
    : item.key === 'moderator' ? viewerIsAdmin || earned.includes(item.key)
    : !SECRET_ACHIEVEMENTS.has(item.key) || viewerIsAdmin || earned.includes(item.key));
}

/** A tag a member may wear: an achievement's or one bought in the look shop (`shop-items.ts`). */
export const isProfileTag = (key: string) => PROFILE_ACHIEVEMENTS.some(item => item.key === key) || isShopTag(key);

/** `earned`: the member's achievement tags and the shop tags they bought. */
export function validateProfileTags(value: unknown, earned: string[]): string[] | null {
  if (!Array.isArray(value) || value.length > 1 || value.some(tag => typeof tag !== 'string')) return null;
  return value.every(tag => earned.includes(tag) && isProfileTag(tag)) ? value : null;
}

export function profileTagLabel(key: string | null | undefined): string | undefined {
  return PROFILE_ACHIEVEMENTS.find(item => item.key === key)?.label ?? SHOP_TAGS.find(item => item.key === key)?.label;
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

export function profileTagKey(value: string | null | undefined): string | undefined {
  return [...PROFILE_ACHIEVEMENTS, ...SHOP_TAGS].find(item => item.key === value || item.label === value)?.key;
}
