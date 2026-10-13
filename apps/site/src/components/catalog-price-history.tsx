'use client';
import { useEffect, useRef, useId, useState, type ReactNode } from 'react';
import { CatalogVolumeTabs } from '@/components/catalog-volume-tabs';
import type { PriceSeries, StorePriceSeries } from '@/lib/price-history';
const money = (price: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(price) + ' ₽';
const dateLabel = (date: string) => new Date(date + 'T12:00:00Z').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export function CatalogPriceHistory({ series, today, icons }: { series: PriceSeries[]; today: string; icons: Record<string, ReactNode> }) {
  const cutoff = new Date(Date.parse(today + 'T12:00:00Z') - 89 * 86400000).toISOString().slice(0, 10);
  return <section className="catalog-price-history price-history-compact" aria-label="История цены"><header><h2>История цены</h2></header>
    {series.length ? <CatalogVolumeTabs labels={series.map(s => s.volume ? `${s.volume} мл` : 'Объём не указан')}>
      {series.map(s => {
        const stores = s.stores.map(store => ({ ...store, points: store.points.filter(p => p.date >= cutoff && p.date <= today) })).filter(store => store.points.length);
        return <div key={s.volume ?? 'unknown'}>{stores.length ? <PricePlot stores={stores} icons={icons} /> : <p className="price-history-empty">За последние 90 дней истории цен пока нет.</p>}</div>;
      })}
    </CatalogVolumeTabs> : <p className="price-history-empty">За последние 90 дней истории цен пока нет.</p>}
  </section>;
}

function PricePlot({ stores, icons }: { stores: StorePriceSeries[]; icons: Record<string, ReactNode> }) {
  const gradient = useId();
  const plot = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    const element = plot.current;
    if (!element) return;
    const observer = new ResizeObserver(entries => { const entry = entries[0]; if (entry) setWidth(Math.max(240, entry.contentRect.width)); });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const dates = [...new Set(stores.flatMap(s => s.points.map(p => p.date)))].sort();
  const days = dates.map(date => {
    const offers = stores.flatMap(s => { const point = s.points.find(p => p.date === date); return point ? [{ name: s.name, price: point.price }] : []; }).sort((a, b) => a.price - b.price);
    const mid = Math.floor(offers.length / 2);
    const median = offers.length % 2 ? offers[mid]!.price : (offers[mid - 1]!.price + offers[mid]!.price) / 2;
    return { date, offers, median };
  });
  const [active, setActive] = useState(days.length - 1);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!expanded) return;
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !plot.current?.contains(event.target)) setExpanded(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpanded(false); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [expanded]);
  const selected = days[active] ?? days[days.length - 1]!;
  const min = Math.min(...days.map(d => d.median)), max = Math.max(...days.map(d => d.median));
  const padding = Math.max((max - min) * .2, max * .05, 1);
  const start = Date.parse(dates[0]!), end = Date.parse(dates[dates.length - 1]!);
  const x = (date: string) => start === end ? width / 2 : 20 + (Date.parse(date) - start) / (end - start) * (width - 40);
  const y = (price: number) => 120 - (price - min + padding) / (max - min + padding * 2) * 90;
  const line = days.map((day, index) => `${index ? 'L' : 'M'} ${x(day.date)} ${y(day.median)}`).join(' ');
  const choose = (clientX: number, rect: DOMRect) => {
    const target = (clientX - rect.left) / rect.width * width;
    let nearest = 0;
    days.forEach((day, index) => { if (Math.abs(x(day.date) - target) < Math.abs(x(days[nearest]!.date) - target)) nearest = index; });
    setActive(nearest); setExpanded(true);
  };
  const tickDates: string[] = [];
  for (const date of dates) {
    if (!tickDates.length || x(date) - x(tickDates[tickDates.length - 1]!) >= 90) tickDates.push(date);
  }
  const lastDate = dates[dates.length - 1]!;
  if (tickDates[tickDates.length - 1] !== lastDate) {
    if (tickDates.length > 1 && x(lastDate) - x(tickDates[tickDates.length - 1]!) < 90) tickDates.pop();
    tickDates.push(lastDate);
  }
  return <>
    <div className="price-history-summary" aria-live="polite"><strong>{money(selected.median)}</strong><span>{dateLabel(selected.date)} · медианная цена</span></div>
    <div className="price-history-plot-wrap" ref={plot} onPointerLeave={event => { if (event.pointerType === 'mouse') setExpanded(false); }}>
    <svg className="price-history-mini" viewBox={`0 0 ${width} 160`} role="button" tabIndex={0} aria-label={`Медианная цена ${money(selected.median)} за ${dateLabel(selected.date)}. Нажмите для цен магазинов. Стрелки меняют дату.`} aria-expanded={expanded} onPointerMove={event => {
      if (event.pointerType === 'mouse' && window.matchMedia('(hover: hover) and (pointer: fine)').matches) choose(event.clientX, event.currentTarget.getBoundingClientRect());
    }} onClick={e => choose(e.clientX, e.currentTarget.getBoundingClientRect())} onKeyDown={event => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', ' '].includes(event.key)) {
        event.preventDefault(); setExpanded(true);
        if (event.key === 'ArrowLeft') setActive(Math.max(0, active - 1));
        if (event.key === 'ArrowRight') setActive(Math.min(days.length - 1, active + 1));
        if (event.key === 'Home') setActive(0);
        if (event.key === 'End') setActive(days.length - 1);
      }
    }}>
      <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop stopColor="currentColor" stopOpacity=".2"/><stop offset="1" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs>
      {days.length > 1 && <><path d={`${line} L ${width - 20} 132 L 20 132 Z`} fill={`url(#${gradient})`}/><path d={line} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/></>}
      <circle cx={x(selected.date)} cy={y(selected.median)} r="5" fill="var(--theme-bg,white)" stroke="currentColor" strokeWidth="3"/>
      {tickDates.map((date, index) => <text key={date} x={x(date)} y="155" textAnchor={days.length === 1 ? 'middle' : index === 0 ? 'start' : index === tickDates.length - 1 ? 'end' : 'middle'}>{dateLabel(date)}</text>)}
    </svg>
    {expanded && <div className="price-history-popover" role="region" aria-label={`Цены за ${dateLabel(selected.date)}`} style={{ left: Math.min(Math.max(x(selected.date) - 130, 0), Math.max(0, width - 260)) }}>
      <header><span>{dateLabel(selected.date)}</span><button type="button" aria-label="Закрыть цены" onClick={() => setExpanded(false)}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></button></header>
      <strong>{money(selected.median)}</strong>
      <ul>{selected.offers.map(offer => <li key={offer.name}>{icons[offer.name]}<span>{offer.name}</span><b>{money(offer.price)}</b></li>)}</ul>
    </div>}
    </div>
    <p className="price-history-hint">Наведите курсор или нажмите на график, чтобы увидеть цены магазинов</p>


  </>;
}
