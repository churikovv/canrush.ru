import type { CSSProperties } from 'react';
import { achievementStepsDone, type AchievementProgress, type ProfileAchievement } from '@/lib/profile-achievements';

/** Requirement list with per-step progress; shared by the tag picker and the achievements page. */
export function AchievementSteps({ item, progress, unlocked }: { item: ProfileAchievement; progress: AchievementProgress; unlocked: boolean }) {
  const done = achievementStepsDone(item, progress);
  return <span className="achievement-steps" role="list" aria-label={`Условия: ${unlocked ? 'выполнены' : `${done} из ${item.steps.length}`}`}>
    {item.steps.map(step => {
      const value = Math.min(progress[step.metric], step.goal);
      const complete = unlocked || value >= step.goal;
      return <span role="listitem" key={step.metric} className={complete ? 'is-done' : undefined} style={{ '--step-progress': complete ? 1 : value / step.goal } as CSSProperties}>
        <span className="achievement-step-mark" aria-hidden="true" />
        <span className="achievement-step-label">{step.label}</span>
        <span className="achievement-step-count">{complete ? 'Готово' : `${value} / ${step.goal}`}</span>
      </span>;
    })}
  </span>;
}
