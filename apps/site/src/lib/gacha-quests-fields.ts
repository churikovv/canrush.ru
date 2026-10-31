/**
 * Задания дня Банкомата: правила без базы данных. Каждый день — крутка и ещё два задания по кругу, одни на всех, за все
 * вместе бонус. Банки в трекере здесь нет намеренно: сайт 18+, и награда за ежедневную банку подталкивала бы пить.
 */
export const QUEST_KEYS = ['spin', 'swipes', 'comment', 'favorite', 'review'] as const;
export type QuestKey = (typeof QUEST_KEYS)[number];
/** Что можно забрать: задание или бонус за все задания дня. */
export type QuestClaim = QuestKey | 'all';
export const isQuestClaim = (value: unknown): value is QuestClaim => value === 'all' || QUEST_KEYS.includes(value as QuestKey);

export interface QuestRule { title: string; hint: string; goal: number; reward: number; href: string | null }
export const QUESTS: Record<QuestKey, QuestRule> = {
  spin: { title: 'Крутить Банкомат', hint: 'Подойдёт и бесплатная крутка', goal: 1, reward: 5, href: null },
  swipes: { title: 'Полистать дейтинг', hint: '5 напитков вправо или влево', goal: 5, reward: 10, href: '/community?type=dating' },
  comment: { title: 'Написать комментарий', hint: 'К отзыву, тирлисту или записи', goal: 1, reward: 10, href: '/feed' },
  favorite: { title: 'Добавить напиток в избранное', hint: 'Сердце на странице напитка', goal: 1, reward: 10, href: '/catalog' },
  review: { title: 'Написать отзыв', hint: 'О напитке, который вы пробовали', goal: 1, reward: 15, href: '/catalog' },
};
export const QUEST_BONUS = 10;

const ROTATION: readonly (readonly [QuestKey, QuestKey])[] = [
  ['swipes', 'comment'], ['favorite', 'review'], ['swipes', 'favorite'], ['comment', 'review'], ['swipes', 'review'], ['comment', 'favorite'],
];

/** Задания дня по Москве (`YYYY-MM-DD`): крутка и пара из круга, у всех участников одни. */
export function dailyQuests(day: string): QuestKey[] {
  const number = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
  return ['spin', ...ROTATION[number % ROTATION.length]!];
}

export const questSourceKey = (day: string, claim: QuestClaim) => `${day}:${claim}`;

export interface QuestRow extends QuestRule { key: QuestKey; count: number; done: boolean; claimed: boolean }
export interface QuestBoard {
  rows: QuestRow[];
  /** Бонус открывается, когда забраны награды всех заданий дня */ bonus: { reward: number; ready: boolean; claimed: boolean };
  /** Сколько заданий закрыто наградой */ claimed: number;
}

/** Доска дня: `counts` — действия за сегодня, `claimed` — ключи журнала крышек за сегодня. */
export function questBoard(day: string, counts: Record<QuestKey, number>, claimed: ReadonlySet<string>): QuestBoard {
  const rows = dailyQuests(day).map(key => ({
    ...QUESTS[key], key, count: Math.min(counts[key], QUESTS[key].goal), done: counts[key] >= QUESTS[key].goal, claimed: claimed.has(questSourceKey(day, key)),
  }));
  const taken = rows.filter(row => row.claimed).length;
  return { rows, claimed: taken, bonus: { reward: QUEST_BONUS, ready: taken === rows.length, claimed: claimed.has(questSourceKey(day, 'all')) } };
}

/** Что сейчас стоит награды, или текст отказа: сервер проверяет это перед записью в журнал. */
/** Сколько наград можно забрать прямо сейчас: столько показывает кнопка заданий. */
export function questsReady({ rows, bonus }: QuestBoard): number {
  return rows.filter(row => row.done && !row.claimed).length + (bonus.ready && !bonus.claimed ? 1 : 0);
}

export function questReward(board: QuestBoard, claim: QuestClaim): { reward: number } | { refuse: string } {
  if (claim === 'all') {
    if (board.bonus.claimed) return { refuse: 'Бонус за сегодня уже получен.' };
    return board.bonus.ready ? { reward: board.bonus.reward } : { refuse: 'Сначала заберите награды всех заданий дня.' };
  }
  const row = board.rows.find(item => item.key === claim);
  if (!row) return { refuse: 'Сегодня такого задания нет.' };
  if (row.claimed) return { refuse: 'Награда за это задание уже получена.' };
  return row.done ? { reward: row.reward } : { refuse: 'Задание ещё не выполнено.' };
}
