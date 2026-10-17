'use client';
import { useState, useTransition } from 'react';
import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { deleteDrinkAction } from '@/app/profile/calendar-actions';
import type { DrinkEntry } from '@/lib/drink-calendar';
import { canEditDay, cans, dayDiff, dayTitle, days, heatLevel, streakOn, type DrinkStreak } from '@/lib/drink-calendar-fields';
import { formatPrice } from '@/lib/market-fields';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/** Month grid: hovering a day previews it in the side panel, a click or tap pins it. */
export function DrinkMonth({ weeks, entries, streaks, today, isOwn }: { weeks: (string | null)[][]; entries: Record<string, DrinkEntry[]>; streaks: DrinkStreak[]; today: string; isOwn: boolean }) {
  const monthDays = weeks.flat().filter((day): day is string => day !== null);
  const initial = monthDays.includes(today) ? today : [...monthDays].reverse().find(day => entries[day]?.length) ?? monthDays[0]!;
  const [selected, setSelected] = useState(initial);
  const [hovered, setHovered] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const shown = hovered ?? selected;
  const list = entries[shown] ?? [];
  const streak = streakOn(streaks, shown);
  const spent = list.reduce((sum, entry) => sum + (entry.price ?? 0), 0);

  function remove(id: string) {
    setError('');
    startTransition(async () => { const result = await deleteDrinkAction(id); if (result.error) setError(result.error); });
  }

  return <div className="drink-month">
    <div className="drink-month-grid" role="group" aria-label="Дни месяца" onPointerLeave={() => setHovered(null)}>
      <div className="drink-month-row drink-month-weekdays" aria-hidden="true">{WEEKDAYS.map(day => <span key={day}>{day}</span>)}</div>
      {weeks.map((week, index) => <div className="drink-month-row" key={index}>{week.map((day, column) => {
        if (!day) return <span key={column} className="drink-month-day is-outside" />;
        const items = entries[day] ?? [];
        const run = streakOn(streaks, day);
        const covers = items.filter(item => item.cover).slice(0, 3);
        const price = items.reduce((sum, item) => sum + (item.price ?? 0), 0);
        return <span key={day} className="drink-month-cell">
          <button type="button" className="drink-month-day" data-level={heatLevel(items.length)} data-future={day > today || undefined} data-today={day === today || undefined}
            data-streak={run && run.length > 1 ? (day === run.start ? 'start' : day === run.end ? 'end' : 'middle') : undefined}
            aria-label={`${dayTitle(day)}: ${items.length ? cans(items.length) : 'нет отметок'}`} aria-pressed={day === selected}
            onPointerEnter={event => { if (event.pointerType === 'mouse') setHovered(day); }} onFocus={() => setHovered(null)} onClick={() => setSelected(day)}>
            <span className="drink-month-number">{Number(day.slice(8))}</span>
            {items.length > 0 && <span className="drink-month-covers" aria-hidden="true">{covers.length
              ? covers.map((item, position) => <Image key={item.id} src={item.cover!} width={22} height={22} alt="" style={{ zIndex: 3 - position }} />)
              : <span className="drink-month-can">⚡</span>}{items.length > covers.length && covers.length > 0 && <small>+{items.length - covers.length}</small>}</span>}
            {isOwn && price > 0 && <span className="drink-month-price">{formatPrice(price)}</span>}
          </button>
        </span>;
      })}</div>)}
    </div>

    <aside className="drink-day-panel" aria-live="polite">
      <h3>{dayTitle(shown)}{shown === today ? ' · сегодня' : ''}</h3>
      <p className="drink-day-streak">{streak
        ? streak.length > 1 ? <>День <b>{dayDiff(streak.start, shown) + 1}</b> из {days(streak.length)} серии · {dayTitle(streak.start)} — {dayTitle(streak.end)}</> : 'Одиночный день, без серии'
        : shown > today ? 'Этот день ещё впереди' : 'Без энергетиков'}</p>
      {list.length > 0 && <ul className="drink-day-list">{list.map(entry => <li key={entry.id}>
        {entry.cover ? <Image src={entry.cover} width={44} height={44} alt="" /> : <span className="drink-day-cover" aria-hidden="true">⚡</span>}
        <span className="drink-day-text">{entry.href ? <Link href={entry.href}>{entry.name}</Link> : <strong>{entry.name}</strong>}
          {isOwn && (entry.price !== null || entry.store) && <small>{[entry.price !== null ? formatPrice(entry.price) : null, entry.store].filter(Boolean).join(' · ')}</small>}</span>
        {isOwn && canEditDay(entry.day, today) && <button type="button" className="community-button community-button-text drink-day-delete" disabled={pending} onClick={() => remove(entry.id)} aria-label={`Удалить ${entry.name}`}>Удалить</button>}
      </li>)}</ul>}
      {isOwn && spent > 0 && <p className="drink-day-total">За день: <b>{formatPrice(spent)}</b></p>}
      {error && <p className="drink-log-error" role="alert">{error}</p>}
    </aside>
  </div>;
}
