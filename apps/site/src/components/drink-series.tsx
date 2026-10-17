import { STREAK_MILESTONES, dayDiff, dayTitle, days, nextMilestone, streakTier, type DrinkStreak } from '@/lib/drink-calendar-fields';

const MILESTONE_NAMES: Record<number, string> = { 3: 'Разгон', 7: 'Неделя', 14: 'Две недели', 30: 'Месяц' };
const range = (item: DrinkStreak) => `${dayTitle(item.start)} — ${dayTitle(item.end)}${item.end.slice(0, 4) !== item.start.slice(0, 4) ? ` ${item.end.slice(0, 4)}` : ''}`;

/** Current streak with its milestone road, then past streaks scaled against the record. */
export function DrinkSeries({ streaks, current, today, isOwn }: { streaks: DrinkStreak[]; current: DrinkStreak | null; today: string; isOwn: boolean }) {
  const best = streaks.reduce((max, item) => Math.max(max, item.length), 0);
  const past = streaks.filter(item => item.length > 1 && item !== current).slice(-8).reverse();
  const next = current ? nextMilestone(current.length) : STREAK_MILESTONES[0];
  return <>
    {current ? <div className="drink-series-current" data-tier={streakTier(current.length)}>
      <div className="drink-series-current-head">
        <span className="drink-series-flame is-large" aria-hidden="true" />
        <div><small>Текущая серия{current.end === today ? '' : ' · ждёт отметки сегодня'}</small><strong>{days(current.length)}</strong><span>{range(current)}</span></div>
        {current.length === best && current.length > 1 && <em className="drink-series-record">Рекорд</em>}
      </div>
      <ol className="drink-series-road" aria-label="Награды за длину серии">
        {STREAK_MILESTONES.map(goal => <li key={goal} data-done={current.length >= goal || undefined}>
          <span aria-hidden="true">{current.length >= goal ? '✓' : goal}</span><small>{MILESTONE_NAMES[goal]}</small>
        </li>)}
      </ol>
      <p className="drink-series-next">Ещё <b>{days(next - current.length)}</b> подряд — и серия в {days(next)} принесёт бонус опыта.</p>
    </div> : <div className="drink-series-current is-empty">
      <span className="drink-series-flame is-large" aria-hidden="true" />
      <div><strong>Серии сейчас нет</strong><span>{isOwn ? 'Отметьте энергетик сегодня и завтра — начнётся новая серия.' : 'Птица ждёт новую серию.'}</span></div>
    </div>}
    {past.length > 0 && <>
      <h3 className="drink-series-subtitle">Прошлые серии</h3>
      <ol className="drink-series-list">{past.map(item => <li key={item.start} data-tier={streakTier(item.length)}>
        <span className="drink-series-flame" aria-hidden="true" />
        <div className="drink-series-meta">
          <div><strong>{days(item.length)}</strong>{item.length === best && <em className="drink-series-record">Рекорд</em>}
            {STREAK_MILESTONES.filter(goal => item.length >= goal).slice(-1).map(goal => <em key={goal} className="drink-series-milestone">{MILESTONE_NAMES[goal]}</em>)}</div>
          <span>{range(item)} · {dayDiff(item.end, today) === 1 ? 'вчера' : `${days(dayDiff(item.end, today))} назад`}</span>
          <span className="drink-series-bar" aria-hidden="true"><span style={{ width: `${Math.max(6, Math.round(item.length / best * 100))}%` }} /></span>
        </div>
      </li>)}</ol>
    </>}
  </>;
}
