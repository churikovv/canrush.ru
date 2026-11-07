'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { IndexSeries } from '@/lib/price-index-fields';

const money = (value: number) => `${value.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`;
const dateLabel = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const signed = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%`;
type Loaded = { series: (IndexSeries & { month: string }) | null } | { error: true };

/**
 * The index card's two views: «Сейчас» — the month's numbers (`now`), «90 дней» — the typical can day by day, loaded
 * when first opened (`/api/price-index/series` for the same city and brand).
 */
export function PriceIndexViews({ now, query, label }: { now: ReactNode; query: string; label: string }) {
  const [view, setView] = useState<'now' | 'days'>('now');
  const [loaded, setLoaded] = useState<{ query: string; result: Loaded } | null>(null);
  useEffect(() => {
    if (view !== 'days' || loaded?.query === query) return;
    let current = true;
    fetch(`/api/price-index/series?${query}`).then(response => response.json() as Promise<Loaded>).then(
      result => { if (current) setLoaded({ query, result }); },
      () => { if (current) setLoaded({ query, result: { error: true } }); });
    return () => { current = false; };
  }, [view, query, loaded]);
  const result = loaded?.query === query ? loaded.result : null;
  return <>
    <div className="price-index-views" role="tablist" aria-label="Вид индекса">
      <button type="button" role="tab" aria-selected={view === 'now'} onClick={() => setView('now')}>Сейчас</button>
      <button type="button" role="tab" aria-selected={view === 'days'} onClick={() => setView('days')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 17l5-5 4 3 8-8M15 7h5v5" /></svg>90 дней
      </button>
    </div>
    <div role="tabpanel">
      {view === 'now' ? now
        : !result ? <p className="price-index-chart-empty" role="status">Загружаем график…</p>
        : 'error' in result ? <p className="price-index-chart-empty" role="alert">Не удалось загрузить график. Проверьте интернет и обновите страницу.</p>
        : result.series ? <PriceIndexChart series={result.series} label={label} />
        : <p className="price-index-chart-empty">Для графика пока мало цен — выберите город или бренд пошире.</p>}
    </div>
  </>;
}

/** Two lines — on the shelf and with a promo; a hover, a tap or the arrows pick a day. */
function PriceIndexChart({ series, label }: { series: IndexSeries; label: string }) {
  const plot = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const points = series.points;
  const [active, setActive] = useState(points.length - 1);
  useEffect(() => {
    const element = plot.current;
    if (!element) return;
    const observer = new ResizeObserver(entries => { const entry = entries[0]; if (entry) setWidth(Math.max(240, entry.contentRect.width)); });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const values = points.flatMap(([, shelf, paid]) => [shelf, paid].filter((value): value is number => value !== null));
  const min = Math.min(...values), max = Math.max(...values);
  const padding = Math.max((max - min) * 0.15, max * 0.02, 1);
  const height = 190, top = 12, bottom = 150;
  const x = (index: number) => points.length === 1 ? width / 2 : 16 + index / (points.length - 1) * (width - 32);
  const y = (value: number) => bottom - (value - min + padding) / (max - min + padding * 2) * (bottom - top);
  const line = (pick: 1 | 2) => points.flatMap((point, index) => point[pick] === null ? [] : [`${x(index)} ${y(point[pick]!)}`]).map((part, index) => `${index ? 'L' : 'M'} ${part}`).join(' ');
  const selected = points[active] ?? points.at(-1)!;
  const first = (pick: 1 | 2) => points.find(point => point[pick] !== null)?.[pick] ?? null;
  const moved = (pick: 1 | 2) => { const start = first(pick), end = points.at(-1)![pick]; return start && end ? signed((end / start - 1) * 100) : null; };
  const choose = (clientX: number, rect: DOMRect) => {
    const target = (clientX - rect.left) / rect.width * width;
    let nearest = 0;
    points.forEach((_, index) => { if (Math.abs(x(index) - target) < Math.abs(x(nearest) - target)) nearest = index; });
    setActive(nearest);
  };
  const ticks: number[] = [];
  points.forEach((_, index) => { if (!ticks.length || x(index) - x(ticks.at(-1)!) >= 90) ticks.push(index); });
  if (ticks.at(-1) !== points.length - 1) { if (ticks.length > 1 && x(points.length - 1) - x(ticks.at(-1)!) < 90) ticks.pop(); ticks.push(points.length - 1); }
  return <div className="price-index-chart">
    <div className="price-index-chart-summary" aria-live="polite">
      <span>{dateLabel(selected[0])} · {label}</span>
      <div>
        {selected[1] !== null && <b className="is-shelf"><i aria-hidden="true" />{money(selected[1])}<small>на полке</small></b>}
        {selected[2] !== null && <b className="is-paid"><i aria-hidden="true" />{money(selected[2])}<small>с акцией</small></b>}
      </div>
    </div>
    <div ref={plot}>
      <svg viewBox={`0 0 ${width} ${height}`} role="slider" tabIndex={0} aria-label={`Цена за ${dateLabel(selected[0])}`} aria-valuemin={0} aria-valuemax={points.length - 1} aria-valuenow={active}
        aria-valuetext={`${dateLabel(selected[0])}: на полке ${selected[1] !== null ? money(selected[1]) : 'нет данных'}, с акцией ${selected[2] !== null ? money(selected[2]) : 'нет данных'}`}
        onPointerMove={event => { if (event.pointerType === 'mouse') choose(event.clientX, event.currentTarget.getBoundingClientRect()); }}
        onClick={event => choose(event.clientX, event.currentTarget.getBoundingClientRect())}
        onKeyDown={event => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          setActive(event.key === 'Home' ? 0 : event.key === 'End' ? points.length - 1 : Math.min(points.length - 1, Math.max(0, active + (event.key === 'ArrowLeft' ? -1 : 1))));
        }}>
        <line className="price-index-chart-cursor" x1={x(active)} x2={x(active)} y1={top} y2={bottom} />
        <path className="price-index-chart-paid" d={line(2)} />
        <path className="price-index-chart-shelf" d={line(1)} />
        {selected[1] !== null && <circle className="price-index-chart-dot is-shelf" cx={x(active)} cy={y(selected[1])} r="5" />}
        {selected[2] !== null && <circle className="price-index-chart-dot is-paid" cx={x(active)} cy={y(selected[2])} r="4.5" />}
        {ticks.map((index, order) => <text key={points[index]![0]} x={x(index)} y={height - 14} textAnchor={points.length === 1 ? 'middle' : order === 0 ? 'start' : order === ticks.length - 1 ? 'end' : 'middle'}>{dateLabel(points[index]![0])}</text>)}
      </svg>
    </div>
    <p className="price-index-chart-note">
      За {points.length} {points.length % 10 === 1 && points.length % 100 !== 11 ? 'день' : points.length % 10 >= 2 && points.length % 10 <= 4 && (points.length % 100 < 12 || points.length % 100 > 14) ? 'дня' : 'дней'}
      {moved(1) && <> на полке <b>{moved(1)}</b></>}{moved(1) && moved(2) && ','}{moved(2) && <> с акцией <b>{moved(2)}</b></>}.
      {' '}Линия — изменение цен одних и тех же позиций день к дню, на уровне цены месяца.
    </p>
  </div>;
}
