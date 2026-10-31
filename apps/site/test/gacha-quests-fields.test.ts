import { describe, expect, it } from 'vitest';
import { QUEST_BONUS, QUESTS, dailyQuests, isQuestClaim, questBoard, questReward, questSourceKey, questsReady, type QuestKey } from '../src/lib/gacha-quests-fields';

const none: Record<QuestKey, number> = { spin: 0, swipes: 0, comment: 0, favorite: 0, review: 0 };
const DAY = '2026-11-03';

describe('dailyQuests', () => {
  it('always starts with a pull and adds two other tasks, the same for everyone on a day', () => {
    for (let index = 0; index < 60; index++) {
      const day = new Date(Date.UTC(2026, 10, 1 + index)).toISOString().slice(0, 10);
      const quests = dailyQuests(day);
      expect(quests).toHaveLength(3);
      expect(quests[0]).toBe('spin');
      expect(new Set(quests).size).toBe(3);
      expect(dailyQuests(day)).toEqual(quests);
    }
  });

  it('brings every task round within a week and changes from day to day', () => {
    const week = Array.from({ length: 6 }, (_, index) => dailyQuests(new Date(Date.UTC(2026, 10, 1 + index)).toISOString().slice(0, 10)));
    expect(new Set(week.flat())).toEqual(new Set(Object.keys(QUESTS)));
    expect(new Set(week.map(quests => quests.join())).size).toBe(6);
  });
});

describe('questBoard', () => {
  const [, first, second] = dailyQuests(DAY) as [QuestKey, QuestKey, QuestKey];
  const done = { ...none, spin: 1, [first]: QUESTS[first].goal, [second]: QUESTS[second].goal };

  it('counts up to the goal and shows nothing as taken at the start of a day', () => {
    const board = questBoard(DAY, { ...none, spin: 4 }, new Set());
    expect(board.rows[0]).toMatchObject({ key: 'spin', count: 1, done: true, claimed: false });
    expect(board.rows[1]).toMatchObject({ key: first, count: 0, done: false });
    expect(board).toMatchObject({ claimed: 0, bonus: { reward: QUEST_BONUS, ready: false, claimed: false } });
  });

  it('pays a done task once and refuses what is not done or not on today', () => {
    const board = questBoard(DAY, { ...none, spin: 1 }, new Set());
    expect(questReward(board, 'spin')).toEqual({ reward: QUESTS.spin.reward });
    expect(questReward(board, first)).toEqual({ refuse: 'Задание ещё не выполнено.' });
    const off = (Object.keys(QUESTS) as QuestKey[]).find(key => key !== 'spin' && key !== first && key !== second)!;
    expect(questReward(board, off)).toEqual({ refuse: 'Сегодня такого задания нет.' });
    expect(questReward(questBoard(DAY, none, new Set([questSourceKey(DAY, 'spin')])), 'spin')).toEqual({ refuse: 'Награда за это задание уже получена.' });
  });

  it('opens the bonus only when every reward of the day is taken', () => {
    expect(questReward(questBoard(DAY, done, new Set()), 'all')).toEqual({ refuse: 'Сначала заберите награды всех заданий дня.' });
    const taken = new Set(['spin', first, second].map(key => questSourceKey(DAY, key as QuestKey)));
    expect(questReward(questBoard(DAY, done, taken), 'all')).toEqual({ reward: QUEST_BONUS });
    expect(questReward(questBoard(DAY, done, new Set([...taken, questSourceKey(DAY, 'all')])), 'all')).toEqual({ refuse: 'Бонус за сегодня уже получен.' });
  });

  it('counts the rewards that can be taken now, the bonus included', () => {
    expect(questsReady(questBoard(DAY, none, new Set()))).toBe(0);
    expect(questsReady(questBoard(DAY, done, new Set()))).toBe(3);
    const taken = new Set(['spin', first, second].map(key => questSourceKey(DAY, key as QuestKey)));
    expect(questsReady(questBoard(DAY, done, taken))).toBe(1);
    expect(questsReady(questBoard(DAY, done, new Set([...taken, questSourceKey(DAY, 'all')])))).toBe(0);
  });

  it('does not take yesterday\'s rewards for today\'s', () => {
    expect(questBoard(DAY, none, new Set([questSourceKey('2026-11-02', 'spin')])).rows[0]!.claimed).toBe(false);
  });
});

it('accepts only real claims', () => {
  expect(isQuestClaim('spin')).toBe(true);
  expect(isQuestClaim('all')).toBe(true);
  expect(isQuestClaim('drink')).toBe(false);
  expect(isQuestClaim(null)).toBe(false);
});
