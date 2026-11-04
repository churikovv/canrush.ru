import { moscowDay } from '@/lib/drink-calendar-fields';
import { achievementCompletion, ROLE_TAGS, type AchievementRarity, type ProfileAchievement } from '@/lib/profile-achievements';

/** Trophy points an achievement adds to the member's score, by rarity. */
export const TROPHY_POINTS: Record<AchievementRarity, number> = { common: 10, rare: 25, epic: 50, legendary: 100, special: 25 };
/** XP every achievement pays once (`award_profile_experience`, reason `achievement`). */
export const ACHIEVEMENT_XP = 20;
/**
 * Collector titles by trophy score. They are not the level's ranks (Бронза, Серебро…): a title only tells how much of
 * the achievements a member holds. The top one needs most of what can be worked towards. Names stay short (the road of
 * titles has six columns on a phone).
 */
export const ACHIEVEMENT_TITLES = [
  { score: 0, label: 'Стажёр' },
  { score: 50, label: 'Фанат' },
  { score: 150, label: 'Знаток' },
  { score: 300, label: 'Эксперт' },
  { score: 500, label: 'Мастер' },
  { score: 700, label: 'Чемпион' },
] as const;
export const RARITY_ORDER: readonly AchievementRarity[] = ['legendary', 'epic', 'rare', 'common', 'special'];

/** Role tags follow the admin panel and week tags change hands every week, so neither counts towards the score. */
export const isScored = (key: string) => !ROLE_TAGS.has(key) && !key.startsWith('week-');
const unscored = (key: string) => !isScored(key);
/** Nothing to work towards (the beta number, the contest prize, the month's top that is no longer run): never a goal. */
const UNREACHABLE = new Set(['engine', 'energizer', 'top']);

export interface AchievementSummary {
  score: number;
  title: { label: string; score: number; index: number };
  next: { label: string; score: number; left: number; share: number } | null;
  earned: number;
  total: number;
  rarities: { rarity: AchievementRarity; earned: number; total: number }[];
  goal: { item: ProfileAchievement<string>; completion: number } | null;
  recent: { item: ProfileAchievement<string>; at: Date }[];
}

/**
 * The owner's achievements at a glance. `visible` is what the member may see (secret tags only once held), `dates`
 * the earned rows newest first. Nothing here is stored: the score and title follow the earned tags.
 */
export function achievementSummary<M extends string>(visible: readonly ProfileAchievement<M>[], earned: readonly string[], progress: Record<M, number>, dates: readonly { key: string; earnedAt: Date | string }[]): AchievementSummary {
  const counted = visible.filter(item => !unscored(item.key));
  const held = counted.filter(item => earned.includes(item.key));
  const score = held.reduce((sum, item) => sum + TROPHY_POINTS[item.rarity], 0);
  let index = 0;
  ACHIEVEMENT_TITLES.forEach((title, at) => { if (score >= title.score) index = at; });
  const title = ACHIEVEMENT_TITLES[index]!;
  const following = ACHIEVEMENT_TITLES[index + 1];
  const goal = counted.filter(item => !earned.includes(item.key) && !UNREACHABLE.has(item.key))
    .map(item => ({ item, completion: achievementCompletion(item, progress) }))
    // The closest first; between equally close ones, the one that is quicker to finish.
    .sort((a, b) => b.completion - a.completion || TROPHY_POINTS[a.item.rarity] - TROPHY_POINTS[b.item.rarity])[0] ?? null;
  const recent = dates.flatMap(row => {
    const item = held.find(candidate => candidate.key === row.key);
    return item ? [{ item, at: new Date(row.earnedAt) }] : [];
  }).slice(0, 3);
  return {
    score,
    title: { label: title.label, score: title.score, index },
    next: following ? { label: following.label, score: following.score, left: following.score - score, share: (score - title.score) / (following.score - title.score) } : null,
    earned: held.length,
    total: counted.length,
    rarities: RARITY_ORDER.map(rarity => ({ rarity, earned: held.filter(item => item.rarity === rarity).length, total: counted.filter(item => item.rarity === rarity).length })).filter(row => row.total > 0),
    goal,
    recent,
  };
}

const longDate = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'long' });
const yearDate = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'long', year: 'numeric' });
/** «сегодня», «вчера» or the date, by the Moscow day like the rest of the site. */
export function earnedDayLabel(at: Date, now = new Date()): string {
  const day = moscowDay(at);
  if (day === moscowDay(now)) return 'сегодня';
  if (day === moscowDay(new Date(now.getTime() - 86_400_000))) return 'вчера';
  return (day.slice(0, 4) === moscowDay(now).slice(0, 4) ? longDate : yearDate).format(at);
}
