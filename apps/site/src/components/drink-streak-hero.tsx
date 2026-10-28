'use client';
import { useRef, type ReactNode } from 'react';
import { StreakFire } from '@/components/streak-fire';
import { StreakFlame } from '@/components/streak-flame';
import { days as daysLabel, flameTier, pluralRu } from '@/lib/drink-calendar-fields';

export interface DrinkMonthStats {
  title: string; cans: number; days: number; daysInMonth: number;
  /** The owner sees the money spent; a visitor sees how many different drinks. */
  spent: string | null; unique: number;
}

/**
 * The month panel's head: the big streak fire (`StreakFire`, the number in its chip), the state in one line and the
 * progress to the next streak bonus, in the tier's colours.
 */
export function DrinkStreakHero({ streak, alive, goal, isOwn }: { streak: number; alive: boolean; goal: number; isOwn: boolean }) {
  const state = !streak ? 'out' : alive ? 'alive' : 'waiting';
  const line = !streak ? (isOwn ? 'Отметьте банку сегодня — огонёк загорится' : 'Огонёк пока не горит')
    : alive ? (isOwn ? 'Огонёк горит — сегодня отмечено' : 'Огонёк горит')
    : isOwn ? 'Отметьте сегодня, чтобы огонёк не погас' : 'Огонёк ждёт сегодняшней банки';
  return <div className="drink-streak-hero" data-flame={flameTier(Math.max(streak, 1))} data-state={state}>
    <StreakFire length={streak} state={state} />
    <div className="drink-streak-hero-text">
      <strong>{line}</strong>
      <div className="drink-streak-hero-goal">
        <span>{streak ? <>Бонус за {daysLabel(goal)} — ещё <b>{daysLabel(goal - streak)}</b></> : 'Два дня подряд — и начнётся серия'}</span>
        <span className="drink-streak-hero-bar" aria-hidden="true"><span style={{ width: `${streak ? Math.round(streak / goal * 100) : 0}%` }} /></span>
      </div>
    </div>
  </div>;
}

/**
 * «Статистика» in the bird banner: the month's figures, the month's summary (`children`: the favourite drink, chips,
 * «Поделиться» and «Скриншот», rendered by the page) and the all-time figures, in a bottom sheet built like a day's
 * sheet (`drink-day-*`).
 */
export function DrinkStatsButton({ streak, alive, best, total, stats, isOwn, children }: {
  streak: number; alive: boolean; best: number; total: number; stats: DrinkMonthStats; isOwn: boolean; children?: ReactNode;
}) {
  const sheet = useRef<HTMLDialogElement>(null);
  const state = !streak ? 'out' : alive ? 'alive' : 'waiting';
  return <>
    <button type="button" className="drink-stats-button" aria-haspopup="dialog" onClick={() => sheet.current?.showModal()}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
      Статистика
    </button>

    <dialog ref={sheet} className="drink-day-sheet drink-stats-sheet" aria-labelledby="drink-stats-title"
      onClick={event => { if (event.target === event.currentTarget) sheet.current?.close(); }}>
      <div className="drink-day-hero drink-stats-hero" data-flame={flameTier(Math.max(streak, 1))}>
        <button type="button" className="drink-day-back" onClick={() => sheet.current?.close()} aria-label="Закрыть">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>
        </button>
        <span className="drink-stats-flame"><StreakFlame length={Math.max(streak, 1)} size={72} state={state} /></span>
        <h2 id="drink-stats-title">{stats.title}</h2>
        <p>{streak ? `Серия ${daysLabel(streak)}` : 'Серии нет'}</p>
        <dl className="drink-day-figures">
          <div><dt>Банок</dt><dd>{stats.cans}</dd></div>
          <div><dt>Дней</dt><dd>{stats.days} из {stats.daysInMonth}</dd></div>
          {isOwn ? <div><dt>Расходы</dt><dd>{stats.spent ?? '—'}</dd></div> : <div><dt>Разных</dt><dd>{stats.unique}</dd></div>}
        </dl>
      </div>
      {children}
      <ul className="drink-day-info">
        <li><span className="drink-day-info-icon is-streak" aria-hidden="true"><StreakFlame length={Math.max(best, 1)} size={16} /></span>
          <span className="drink-day-info-text"><strong>{daysLabel(best)}</strong><small>Рекордная серия</small></span></li>
        <li><span className="drink-day-info-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2h8l-1 4H9L8 2Zm1 4h6l1 3v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V9l1-3Z" /></svg></span>
          <span className="drink-day-info-text"><strong>{total} {pluralRu(total, 'банка', 'банки', 'банок')}</strong><small>Всего в календаре</small></span></li>
      </ul>
    </dialog>
  </>;
}
