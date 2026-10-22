import { PROFILE_FRAMES, PROFILE_THEMES } from '@/lib/profile-appearance';
import { levelRank, RANK_UP_TIERS, type LevelTier, type RankUpTier } from '@/lib/level-tier';

export type LevelRewardKind = 'rank' | 'theme' | 'frame' | 'feed';
export interface LevelReward { kind: LevelRewardKind; title: string; note: string; tier?: LevelTier['key'] }

/** What reaching exactly `level` gives: a new rank or degree, profile themes and frames, a rank-up post in the feed. */
export function rewardsAtLevel(level: number): LevelReward[] {
  const rewards: LevelReward[] = [];
  const rank = levelRank(level);
  if (level > 1 && rank.min === level) {
    rewards.push({ kind: 'rank', title: rank.label, note: 'Новый ранг', tier: rank.tier.key });
    // Gold and Platinum are announced once (their first degree), Legend on every degree — as the rank_up trigger does.
    if ((RANK_UP_TIERS as readonly string[]).includes(rank.tier.key) && (rank.tier.key === 'legend' || rank.degree === 1)) {
      rewards.push({ kind: 'feed', title: 'Пост в ленте', note: `Сообщество увидит ваш ранг «${rank.label}»`, tier: rank.tier.key as RankUpTier });
    }
  }
  for (const theme of PROFILE_THEMES) if (theme.level === level && level > 1) rewards.push({ kind: 'theme', title: theme.label, note: 'Тема профиля' });
  for (const frame of PROFILE_FRAMES) if (frame.level === level && level > 1) rewards.push({ kind: 'frame', title: frame.label, note: 'Рамка аватара' });
  return rewards;
}

/** The nearest level above `level` that gives anything, with its rewards (Legend degrees keep it going forever). */
export function nextLevelRewards(level: number): { level: number; rewards: LevelReward[] } {
  for (let next = level + 1; ; next++) {
    const rewards = rewardsAtLevel(next);
    if (rewards.length) return { level: next, rewards };
  }
}
