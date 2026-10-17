'use client';
import { useEffect, useRef, useState } from 'react';
import { cans, dayTitle, heatLevel } from '@/lib/drink-calendar-fields';

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

/**
 * GitHub-style year of cans. One floating hint follows the pointer, so cells stay plain spans
 * and the horizontal scroller never clips it. The summary for assistive tech is the grid's label.
 */
export function DrinkHeatmap({ weeks, counts, drinks, label }: { weeks: (string | null)[][]; counts: Record<string, number>; drinks: Record<string, string[]>; label: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [hint, setHint] = useState<{ day: string; x: number; y: number } | null>(null);
  useEffect(() => { const element = scroller.current; if (element) element.scrollLeft = element.scrollWidth; }, []);
  const monthLabels = weeks.map((week, index) => {
    const first = week.find(day => day?.endsWith('-01') || false) ?? (index === 0 ? week.find(Boolean) : undefined);
    return first ? MONTHS[Number(first.slice(5, 7)) - 1] : '';
  });
  function show(target: EventTarget | null) {
    const cell = target instanceof HTMLElement ? target.closest<HTMLElement>('[data-day]') : null;
    if (!cell?.dataset.day) { setHint(null); return; }
    const rect = cell.getBoundingClientRect();
    setHint({ day: cell.dataset.day, x: rect.left + rect.width / 2, y: rect.top });
  }
  const names = hint ? drinks[hint.day] ?? [] : [];
  return <div className="drink-heatmap">
    <div className="drink-heatmap-body">
    <div className="drink-heatmap-days" aria-hidden="true"><span /><span>Пн</span><span /><span>Ср</span><span /><span>Пт</span><span /><span /></div>
    <div className="drink-heatmap-scroll" ref={scroller} onScroll={() => setHint(null)}>
      <div className="drink-heatmap-grid" role="img" aria-label={label} style={{ gridTemplateColumns: `repeat(${weeks.length}, var(--heat-cell))` }}
        onPointerOver={event => show(event.target)} onPointerLeave={() => setHint(null)} onClick={event => show(event.target)}>
        {monthLabels.map((month, index) => <span key={`m${index}`} className="drink-heatmap-month" style={{ gridColumn: index + 1 }} aria-hidden="true">{month}</span>)}
        {weeks.map((week, column) => week.map((day, row) => day
          ? <span key={day} data-day={day} data-level={heatLevel(counts[day] ?? 0)} className="drink-heat-cell" style={{ gridColumn: column + 1, gridRow: row + 2 }} />
          : <span key={`e${column}-${row}`} className="drink-heat-cell is-empty" style={{ gridColumn: column + 1, gridRow: row + 2 }} />))}
      </div>
    </div>
    </div>
    <div className="drink-heatmap-legend" aria-hidden="true">Меньше{[0, 1, 2, 3, 4].map(level => <span key={level} className="drink-heat-cell" data-level={level} />)}Больше</div>
    {hint && <div className="drink-heatmap-hint" role="tooltip" style={{ left: hint.x, top: hint.y }}>
      <strong>{dayTitle(hint.day)}</strong>
      <span>{counts[hint.day] ? cans(counts[hint.day]!) : 'Без энергетиков'}</span>
      {names.length > 0 && <ul>{names.slice(0, 5).map((name, index) => <li key={index}>{name}</li>)}{names.length > 5 && <li>и ещё {names.length - 5}</li>}</ul>}
    </div>}
  </div>;
}
