'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';

type Icon = 'people' | 'reviews' | 'can' | 'city';
interface Figure { label: string; to: number; plus: boolean; decimals?: number; prefix?: string; suffix?: string }
type Visual =
  | { kind: 'bars'; values: number[]; caption: string }
  | { kind: 'split'; parts: { label: string; value: number }[]; caption: string }
  | { kind: 'chips'; items: string[]; more: number; caption: string };

/** One card of «CanRush сегодня»: the headline pair, a ring with a share, a small picture and two facts at the foot. */
export interface BusinessStory {
  key: string; icon: Icon; title: string; pill: string;
  ring: { value: number; label: string } | null;
  left: Figure; right: Figure; visual: Visual;
  foot: { label: string; value: string }[];
}

const ICONS: Record<Icon, ReactNode> = {
  people: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5" /></>,
  reviews: <path d="m12 2.5 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.3l6.5-.9z" />,
  can: <path d="M8 2h8l-1 4H9L8 2Zm1 4h6l1 3v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V9l1-3Zm-1 7h8" />,
  city: <><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></>,
};
const Glyph = ({ name, size = 20 }: { name: Icon; size?: number }) =>
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[name]}</svg>;

const DURATION = 1100;
const ROTATE_MS = 7000;
const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function format(figure: Figure, share: number) {
  const value = figure.to * share;
  const text = value.toLocaleString('ru-RU', { minimumFractionDigits: figure.decimals ?? 0, maximumFractionDigits: figure.decimals ?? 0 });
  return `${figure.prefix ?? ''}${text}${figure.plus && share >= 1 ? '+' : ''}${figure.suffix ?? ''}`;
}

/** 0 → 1 over the count each time `run` changes (a new card opened); 1 at once under reduced motion. */
function useCount(run: number) {
  const [share, setShare] = useState(1);
  useEffect(() => {
    if (!run || reduced()) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => { const next = ease(Math.min(1, (now - start) / DURATION)); setShare(next); if (next < 1) frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [run]);
  return share;
}

/**
 * «CanRush сегодня» on the business landing: one card open — two big live numbers, a ring with a share, a small chart
 * and two facts — and the other figures as pills stacked above (those before it) and below (those after), like a
 * travel itinerary. A pill or «Дальше» opens its card; the numbers count up and the ring fills each time. While the
 * strip is on screen it moves on by itself every 7 s until someone picks a card (never under reduced motion). The
 * server renders the first card complete, so it reads right without JavaScript.
 */
export function BusinessStats({ stories }: { stories: BusinessStory[] }) {
  const [active, setActive] = useState(0);
  const [run, setRun] = useState(0);
  const [touched, setTouched] = useState(false);
  const [visible, setVisible] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const share = useCount(run);
  const story = stories[active]!;

  // Count the first card once the strip scrolls into view; then watch whether it is on screen for the rotation.
  useEffect(() => {
    const node = box.current;
    if (!node || !('IntersectionObserver' in window)) return;
    let counted = false;
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(Boolean(entry?.isIntersecting));
      if (entry?.isIntersecting && !counted) { counted = true; setRun(value => value + 1); }
    }, { threshold: 0.35 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (touched || !visible || reduced()) return;
    const timer = window.setTimeout(() => { setActive(index => (index + 1) % stories.length); setRun(value => value + 1); }, ROTATE_MS);
    return () => clearTimeout(timer);
  }, [active, touched, visible, stories.length]);

  const open = (index: number) => { setTouched(true); setActive(index); setRun(value => value + 1); };
  const pill = (item: BusinessStory, index: number) => {
    const distance = Math.abs(index - active);
    return <button key={item.key} type="button" className="biz-stack-pill" data-distance={distance} onClick={() => open(index)} aria-label={`${item.title}: ${item.pill}. Показать подробнее`}>
      <Glyph name={item.icon} /><span>{item.title}</span><b>{item.pill}</b>
    </button>;
  };
  const ring = story.ring ? Math.max(0, Math.min(1, story.ring.value)) : 0;
  const circumference = 2 * Math.PI * 26;

  return <div className="biz-stack" ref={box} onMouseEnter={() => setTouched(true)} onFocus={() => setTouched(true)}>
    {stories.slice(0, active).map((item, index) => pill(item, index))}
    <article key={story.key} className="biz-story" aria-label={story.title}>
      <header className="biz-story-head">
        <span className="biz-story-title"><Glyph name={story.icon} size={22} />{story.title}</span>
        {story.ring && <span className="biz-story-ring" title={story.ring.label}>
          <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r="26" className="biz-story-ring-track" />
            <circle cx="32" cy="32" r="26" className="biz-story-ring-fill" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - ring * share)} />
          </svg>
          <b>{Math.round(ring * 100 * share)}%</b>
        </span>}
        <button type="button" className="biz-story-next" onClick={() => open((active + 1) % stories.length)}>Дальше<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg></button>
      </header>
      {story.ring && <p className="biz-story-ring-label">{Math.round(ring * 100)}% — {story.ring.label}</p>}
      <div className="biz-story-figures">
        <div><small>{story.left.label}</small><strong>{format(story.left, share)}</strong></div>
        <div><small>{story.right.label}</small><strong>{format(story.right, share)}</strong></div>
      </div>
      <Picture visual={story.visual} share={share} />
      <dl className="biz-story-foot">{story.foot.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
    </article>
    {stories.slice(active + 1).map((item, offset) => pill(item, active + 1 + offset))}
  </div>;
}

/** The card's small picture: weekly bars growing with the count, a split bar of where things are, or city chips. */
function Picture({ visual, share }: { visual: Visual; share: number }) {
  if (visual.kind === 'bars') {
    const max = Math.max(1, ...visual.values);
    return <figure className="biz-story-picture"><figcaption>{visual.caption}</figcaption>
      <div className="biz-story-bars">{visual.values.map((value, index) => <span key={index} style={{ height: `${Math.max(4, value / max * 100 * share)}%` }} />)}</div>
    </figure>;
  }
  if (visual.kind === 'split') {
    const total = Math.max(1, visual.parts.reduce((sum, part) => sum + part.value, 0));
    return <figure className="biz-story-picture"><figcaption>{visual.caption}</figcaption>
      <div className="biz-story-split">{visual.parts.map((part, index) => part.value > 0 && <span key={part.label} data-part={index} style={{ flexGrow: part.value * share + 0.0001 }} />)}</div>
      <ul className="biz-story-legend">{visual.parts.map((part, index) => <li key={part.label} data-part={index}><i />{part.label}<b>{part.value.toLocaleString('ru-RU')} · {Math.round(part.value / total * 100)}%</b></li>)}</ul>
    </figure>;
  }
  return <figure className="biz-story-picture"><figcaption>{visual.caption}</figcaption>
    <ul className="biz-story-chips">{visual.items.map(item => <li key={item}>{item}</li>)}{visual.more > 0 && <li className="is-more">ещё {visual.more}</li>}</ul>
  </figure>;
}
