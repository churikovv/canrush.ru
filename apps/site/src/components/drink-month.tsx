'use client';
import { useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { deleteDrinkAction } from '@/app/profile/calendar-actions';
import type { DrinkEntry } from '@/lib/drink-calendar';
import { canEditDay, cans, dayDiff, dayTitle, days, streakOn, type DrinkStreak } from '@/lib/drink-calendar-fields';
import { formatPrice } from '@/lib/market-fields';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const WEEKDAY_NAMES = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const weekday = (day: string) => WEEKDAY_NAMES[new Date(`${day}T00:00:00Z`).getUTCDay()]!;
const local = (src: string) => src.startsWith('/');

/** An empty day: the outline of a can, faint, so the month reads as a shelf to fill. */
function CanSilhouette() {
  return <svg className="drink-month-empty" width="22" height="34" viewBox="0 0 22 34" aria-hidden="true">
    <path d="M5 1h12l1.5 3v1.5L20 8v20l-1.5 3.5v1.5h-15v-1.5L2 28V8l1.5-2.5V4Z" />
  </svg>;
}

/** Month grid of cans; a tap on a day opens that day in its own sheet. */
export function DrinkMonth({ weeks, entries, streaks, today, isOwn }: { weeks: (string | null)[][]; entries: Record<string, DrinkEntry[]>; streaks: DrinkStreak[]; today: string; isOwn: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [shown, setShown] = useState<string | null>(null);

  function open(day: string) { setShown(day); dialog.current?.showModal(); }

  return <div className="drink-month">
    <div className="drink-month-grid" role="group" aria-label="Дни месяца">
      <div className="drink-month-row drink-month-weekdays" aria-hidden="true">{WEEKDAYS.map(day => <span key={day}>{day}</span>)}</div>
      {weeks.map((week, index) => <div className="drink-month-row" key={index}>{week.map((day, column) => {
        if (!day) return <span key={column} className="drink-month-day is-outside" />;
        const items = entries[day] ?? [];
        const run = streakOn(streaks, day);
        const streakDay = run && run.length > 1 ? dayDiff(run.start, day) + 1 : 0;
        const cover = items.find(item => item.cover)?.cover;
        return <span key={day} className="drink-month-cell">
          <button type="button" className="drink-month-day" data-has={items.length ? '' : undefined} data-future={day > today || undefined} data-today={day === today || undefined}
            data-streak={streakDay ? '' : undefined} disabled={day > today} aria-haspopup="dialog"
            aria-label={`${dayTitle(day)}: ${items.length ? cans(items.length) : 'нет отметок'}${streakDay ? `, ${streakDay}-й день серии` : ''}`}
            onClick={() => open(day)}>
            <span className="drink-month-mark" aria-hidden="true">
              {items.length ? cover ? <Image src={cover} width={36} height={36} alt="" unoptimized={local(cover)} /> : <span className="drink-month-can">⚡</span> : <CanSilhouette />}
              {items.length > 1 && <small className="drink-month-count">{items.length}</small>}
              {streakDay > 0 && <span className="drink-month-streak">{streakDay}</span>}
            </span>
            <span className="drink-month-number">{Number(day.slice(8))}</span>
          </button>
        </span>;
      })}</div>)}
      <p className="drink-month-legend" aria-hidden="true"><span className="drink-month-streak">3</span> день серии подряд <small className="drink-month-count">2</small> банки за день</p>
    </div>

    <dialog ref={dialog} className="drink-day-sheet" aria-labelledby="drink-day-title" onClose={() => setShown(null)}
      onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      {shown && <DrinkDay key={shown} day={shown} list={entries[shown] ?? []} streaks={streaks} today={today} isOwn={isOwn} onClose={() => dialog.current?.close()} />}
    </dialog>
  </div>;
}

/**
 * One day, like a drink card in a tracker app: a tinted head with the cans, the date and the streak, three figures
 * (cans, day of the streak, spent) and the list of cans with their notes; the owner removes recent cans here.
 */
function DrinkDay({ day, list, streaks, today, isOwn, onClose }: { day: string; list: DrinkEntry[]; streaks: DrinkStreak[]; today: string; isOwn: boolean; onClose: () => void }) {
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const streak = streakOn(streaks, day);
  const priced = list.filter(entry => entry.price !== null);
  const spent = priced.reduce((sum, entry) => sum + entry.price!, 0);
  const covers = list.filter(entry => entry.cover).slice(0, 3);
  const editable = isOwn && canEditDay(day, today);
  const inRun = streak !== undefined && streak.length > 1;
  const locked = isOwn && list.length > 0 && !editable;
  const name = list.length === 1 ? list[0]!.name : list.length ? cans(list.length) : 'Без энергетиков';

  function remove(id: string) {
    setError('');
    startTransition(async () => { const result = await deleteDrinkAction(id); if (result.error) setError(result.error); });
  }

  return <>
    <div className="drink-day-hero" data-empty={list.length ? undefined : ''}>
      <button type="button" className="drink-day-back" onClick={onClose} aria-label="Закрыть">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>
      </button>
      <div className="drink-day-covers" aria-hidden="true">
        {covers.length ? covers.map(entry => <Image key={entry.id} src={entry.cover!} width={96} height={96} alt="" unoptimized={local(entry.cover!)} />)
          : list.length ? <span className="drink-day-bolt">⚡</span> : <CanSilhouette />}
      </div>
      <h2 id="drink-day-title">{name}</h2>
      <p>{dayTitle(day)}{day === today ? ' · сегодня' : `, ${weekday(day)}`}</p>
      <dl className="drink-day-figures">
        <div><dt>Банок</dt><dd>{list.length}</dd></div>
        <div><dt>Серия</dt><dd>{streak && streak.length > 1 ? `${dayDiff(streak.start, day) + 1} из ${streak.length}` : '—'}</dd></div>
        {isOwn ? <div><dt>Расходы</dt><dd>{priced.length ? formatPrice(spent) : '—'}</dd></div>
          : <div><dt>Разных</dt><dd>{new Set(list.map(entry => entry.name)).size}</dd></div>}
      </dl>
    </div>

    {list.length > 0 ? <ul className="drink-day-list">{list.map(entry => <li key={entry.id}>
      {entry.cover ? <Image src={entry.cover} width={48} height={48} alt="" unoptimized={local(entry.cover)} /> : <span className="drink-day-cover" aria-hidden="true">⚡</span>}
      <span className="drink-day-text">{entry.href ? <Link href={entry.href}>{entry.name}</Link> : <strong>{entry.name}</strong>}
        <small>{[entry.brand ? 'Из каталога' : 'Свой напиток', isOwn && entry.price !== null ? formatPrice(entry.price) : null, isOwn ? entry.store : null].filter(Boolean).join(' · ')}</small></span>
      {editable && <button type="button" className="drink-day-delete" disabled={pending} onClick={() => remove(entry.id)} aria-label={`Удалить ${entry.name}`}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
      </button>}
    </li>)}</ul>
      : <p className="drink-day-empty">{isOwn ? 'В этот день банок не было.' : 'В этот день отметок нет.'}</p>}

    {(inRun || locked) && <ul className="drink-day-info">
      {inRun && <li>
        <span className="drink-day-info-icon is-streak" aria-hidden="true" />
        <span className="drink-day-info-text"><strong>Серия {days(streak.length)}</strong><small>{dayTitle(streak.start)} — {dayTitle(streak.end)}</small></span>
        <span className="drink-day-info-chip">день {dayDiff(streak.start, day) + 1}</span>
      </li>}
      {locked && <li>
        <span className="drink-day-info-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
        </span>
        <span className="drink-day-info-text"><strong>Отметки закрыты</strong><small>Удалять можно только за сегодня и вчера</small></span>
      </li>}
    </ul>}
    {error && <p className="drink-log-error" role="alert">{error}</p>}
    {editable && <a className="drink-day-add" href="#add-drink" onClick={event => {
      // Same page: open the form without jumping to the anchor.
      event.preventDefault(); onClose();
      history.pushState(null, '', '#add-drink'); window.dispatchEvent(new HashChangeEvent('hashchange'));
    }}>{list.length ? 'Отметить ещё банку' : 'Отметить банку'}</a>}
  </>;
}
