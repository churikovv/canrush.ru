/**
 * Rules of the admin «Удержание» and «Чем пользуются» blocks, without the database: what counts as coming back, and
 * which features are counted. The SQL in `admin-growth.ts` is built from these lists, so the table headers and the
 * numbers cannot drift apart.
 */

/**
 * Return windows, in days after the day of sign-up (Moscow). Bracketed, not rolling: «7 дней» is a visit on any of days
 * 7–13, so one late visit does not count as a member who stayed. The month window is the fifth week, not «day 30 and
 * later», for the same reason. A member counts only when the whole window is over — today is never complete.
 */
export const RETENTION_WINDOWS = [
  { key: 'd1', label: '1 день', from: 1, to: 1, note: 'на следующий день' },
  { key: 'd7', label: '7 дней', from: 7, to: 13, note: 'хоть раз на 7–13-й день' },
  { key: 'd30', label: '30 дней', from: 28, to: 34, note: 'хоть раз на 28–34-й день' },
] as const;
export type RetentionWindowKey = (typeof RETENTION_WINDOWS)[number]['key'];

/** Weekly cohorts shown, newest first. */
export const RETENTION_WEEKS = 8;

/** Who came back out of who could have: `eligible` are members whose window is already over. */
export interface CohortCell { returned: number; eligible: number }

/** A share in whole percent, or null while nobody could have come back yet. */
export function cohortShare(cell: CohortCell): number | null {
  return cell.eligible > 0 ? Math.round(cell.returned / cell.eligible * 100) : null;
}

/**
 * Features counted in «Чем пользуются»: members who did it that Moscow day. Only actions that leave a row with a time
 * count; stories are left out on purpose — their rows are deleted a week after publishing, so older days would read as
 * nobody posting. The tracker is counted as usage only: it is not a goal to push (the site is 18+).
 */
export const USAGE_FEATURES = [
  { key: 'gacha', label: 'Банкомат', note: 'крутили' },
  { key: 'battle', label: 'Битва банок', note: 'начинали бой с Совой или с другом' },
  { key: 'daily', label: 'Лунный цикл', note: 'забирали награду дня' },
  { key: 'chat', label: 'Чат сообщества', note: 'писали в чат' },
  { key: 'dating', label: 'Дейтинг', note: 'свайпали напитки' },
  { key: 'trades', label: 'Обмен карточками', note: 'предлагали или принимали обмен' },
  { key: 'reviews', label: 'Отзывы', note: 'писали отзывы' },
  { key: 'feed', label: 'Лента и стены', note: 'публиковали записи' },
  { key: 'tracker', label: 'Трекер', note: 'отмечали банки' },
] as const;
export type UsageFeatureKey = (typeof USAGE_FEATURES)[number]['key'];

/** Days in the usage sparkline, today included. */
export const USAGE_DAYS = 14;

/** Steps of «Лунный цикл» worth counting how many current runs reached. */
export const DAILY_MILESTONES = [5, 10, 20, 30] as const;
