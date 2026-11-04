'use client';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition, type CSSProperties } from 'react';
import { updateCommunityAction } from '@/app/profile/community-actions';
import Link from '@/components/navigation-progress';
import { pluralRu } from '@/lib/drink-calendar-fields';
import { RARITY_ORDER } from '@/lib/achievement-summary';
import { ACHIEVEMENT_RARITIES, type AchievementRarity } from '@/lib/profile-achievements';

/** One medal of the screen, built on the server: a tag (can be worn) or an achievement that is only an achievement. */
export interface TrophyCard {
  key: string; label: string; rarity: AchievementRarity; description: string; art: string;
  earned: boolean; earnedAt: string | null; tag: boolean; points: number; xp: number; completion: number;
  steps: { label: string; value: number; goal: number }[];
}
export interface TrophyTitle { label: string; index: number; score: number; next: { label: string; score: number; left: number; share: number } | null; titles: number }
type Filter = 'all' | 'earned' | 'locked' | AchievementRarity;
const RARITY_PLURAL: Record<AchievementRarity, string> = { legendary: 'Легендарные', epic: 'Эпические', rare: 'Редкие', common: 'Обычные', special: 'Особые' };
const SETTLE_MS = 120;
const SEEN_KEY = 'canrush-trophies-seen';
/** On the very first visit only what was earned this recently gets the big reveal: not the whole collection at once. */
const FRESH_MS = 24 * 3600_000;
const day = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'long', year: 'numeric' });
const ARROW = (turn: number) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ rotate: `${turn}deg` }}><path d="m15 5-7 7 7 7" /></svg>;
const CUP = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0V4ZM8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M8.5 20h7M10 17h4v3h-4z" /></svg>;
const LOCK = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>;
const points = (value: number) => `${value} ${pluralRu(value, 'очко', 'очка', 'очков')}`;

function readSeen(): Set<string> | null {
  try { const raw = window.localStorage.getItem(SEEN_KEY); return raw ? new Set(JSON.parse(raw) as string[]) : null; } catch { return null; }
}
function writeSeen(keys: Iterable<string>) {
  try { window.localStorage.setItem(SEEN_KEY, JSON.stringify([...keys])); } catch { /* private mode: the reveal just shows again */ }
}

/** The medal: the art, lit and floating when earned; dark with its progress ring while locked. Its rays live on the stage. */
function Medal({ card, live, size }: { card: TrophyCard; live?: boolean; size: number }) {
  const ring = 2 * Math.PI * 47;
  return <span className="trophy-medal" data-rarity={card.rarity} data-earned={card.earned || undefined} data-live={live || undefined}>
    <Image className="trophy-art" src={card.art} width={size} height={size} sizes={`${size}px`} alt="" draggable={false} />
    {!card.earned && <>
      <svg className="trophy-ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="47" /><circle cx="50" cy="50" r="47" style={{ strokeDasharray: `${ring * card.completion} ${ring}` }} /></svg>
      <span className="trophy-lock" aria-hidden="true">{LOCK}</span>
    </>}
  </span>;
}

/**
 * Achievements as a game screen, like the season pass and the card inventory: dark in every site theme, no site header,
 * the way out is a button. On top the collector title and trophy score; in the middle a big medal that swipes to the
 * next (earned ones lit and floating, locked ones dark with a progress ring); below what it is, how to get it and what
 * it gives; at the bottom a strip of small medals. The owner wears an earned tag right here, and a medal earned since
 * the last visit opens with its own reveal.
 */
export function TrophyRoom({ cards, title, score, isOwn, owner, backHref, worn }: {
  cards: TrophyCard[]; title: TrophyTitle; score: number; isOwn: boolean; owner: string; backHref: string; worn: string | null;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [active, setActive] = useState(0);
  const [wearing, startWear] = useTransition();
  const [wornTag, setWornTag] = useState(worn);
  const [notice, setNotice] = useState('');
  const [reveal, setReveal] = useState<TrophyCard[]>([]);
  const track = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLOListElement>(null);
  const settle = useRef(0);
  const aim = useRef<number | null>(null);

  const earned = useMemo(() => cards.filter(card => card.earned), [cards]);
  const list = useMemo(() => cards.filter(card => filter === 'all' || (filter === 'earned' ? card.earned : filter === 'locked' ? !card.earned : card.rarity === filter)), [cards, filter]);
  const index = Math.min(active, Math.max(0, list.length - 1));
  const current = list[index];

  // A medal earned since the last visit gets its reveal; the first visit only celebrates the freshest.
  useEffect(() => {
    if (!isOwn) return;
    const seen = readSeen();
    const fresh = earned.filter(card => (seen ? !seen.has(card.key) : Boolean(card.earnedAt) && Date.now() - Date.parse(card.earnedAt!) < FRESH_MS));
    if (!fresh.length) { writeSeen(earned.map(card => card.key)); return; }
    // Marked as seen only when the reveal starts: React runs effects twice in development, and marking them here would
    // have spent the reveal on the first, discarded run.
    const frame = window.setTimeout(() => { writeSeen(earned.map(card => card.key)); setReveal(fresh); }, 350);
    return () => window.clearTimeout(frame);
  }, [isOwn, earned]);

  const step = () => {
    const first = track.current?.querySelector<HTMLElement>('.trophy-slide');
    const gap = track.current ? parseFloat(getComputedStyle(track.current).columnGap) || 0 : 0;
    return first ? first.offsetWidth + gap : 1;
  };
  function go(target: number) {
    const next = Math.max(0, Math.min(list.length - 1, target));
    aim.current = next;
    track.current?.scrollTo({ left: next * step(), behavior: 'smooth' });
  }
  const goBy = (shift: number) => go((aim.current ?? index) + shift);
  // The medal in focus changes only once the strip rests: changing it mid-fling made phones snap back (as in the inventory).
  function scrolled() { window.clearTimeout(settle.current); settle.current = window.setTimeout(rested, SETTLE_MS); }
  function rested() {
    window.clearTimeout(settle.current);
    if (!track.current) return;
    aim.current = null;
    setActive(Math.round(track.current.scrollLeft / step()));
  }
  useEffect(() => () => window.clearTimeout(settle.current), []);
  useEffect(() => {
    const thumb = rail.current?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    const box = rail.current;
    if (thumb && box) box.scrollTo({ left: thumb.offsetLeft - (box.clientWidth - thumb.offsetWidth) / 2, behavior: 'smooth' });
  }, [index, list]);
  function choose(next: Filter) { setFilter(next); setActive(0); setNotice(''); track.current?.scrollTo({ left: 0 }); }
  /** Jump to a medal by key, under any filter (from the reveal). */
  function show(key: string) {
    const at = cards.findIndex(card => card.key === key);
    setFilter('all');
    setActive(at);
    window.requestAnimationFrame(() => track.current?.scrollTo({ left: at * step() }));
  }

  function wear(card: TrophyCard) {
    setNotice('');
    startWear(async () => {
      const form = new FormData();
      form.set('operation', 'tags');
      form.set('tags', card.key);
      const result = await updateCommunityAction({}, form);
      if (result.error) { setNotice(result.error); return; }
      setWornTag(card.key);
      setNotice(`Тег «${card.label}» стоит рядом с вашим именем`);
      router.refresh();
    });
  }

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: 'Все', count: cards.length },
    { key: 'earned', label: 'Получены', count: earned.length },
    { key: 'locked', label: 'Впереди', count: cards.length - earned.length },
    ...RARITY_ORDER.map(rarity => ({ key: rarity, label: RARITY_PLURAL[rarity], count: cards.filter(card => card.rarity === rarity).length })).filter(item => item.count > 0),
  ];
  const next = title.next;

  return <main className="trophy-screen" data-rarity={current?.rarity} data-earned={current?.earned || undefined} data-title-tier={title.index} data-no-pull>
    <header className="trophy-top">
      <Link className="can-plate trophy-icon-btn" href={backHref} aria-label="Назад"><span aria-hidden="true">‹</span></Link>
      <div className="trophy-heading">
        <h1>Достижения</h1>
        <p>{isOwn ? 'Ваши трофеи' : owner} · {earned.length} из {cards.length}</p>
      </div>
      <span className="can-plate trophy-score" title="Трофейный счёт: очки за полученные достижения">{CUP}{score.toLocaleString('ru-RU')}<span className="sr-only"> очков</span></span>
    </header>

    <section className="trophy-rank" aria-label={`Звание «${title.label}»`}>
      <span className="trophy-rank-badge" aria-hidden="true">{CUP}</span>
      <div className="trophy-rank-copy">
        <p><small>{isOwn ? 'Твоё звание' : 'Звание'}</small><b>{title.label}</b><span>{title.index + 1} / {title.titles}</span></p>
        <span className="can-meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((next ? next.share : 1) * 100)} aria-label={next ? `Очки до звания «${next.label}»` : 'Высшее звание'}>
          <i style={{ '--share': next ? next.share : 1 } as CSSProperties} />
        </span>
        <small className="trophy-rank-next">{next ? <>Ещё {points(next.left)} до «{next.label}»</> : 'Высшее звание. Новые достижения всё равно добавят очков'}</small>
      </div>
    </section>

    <div className="trophy-filters" role="toolbar" aria-label="Какие достижения показать">
      {filters.map(item => <button key={item.key} type="button" className="trophy-chip" data-rarity={RARITY_ORDER.includes(item.key as AchievementRarity) ? item.key : undefined} aria-pressed={filter === item.key} onClick={() => choose(item.key)}>{item.label}<b>{item.count}</b></button>)}
    </div>

    {list.length ? <>
      <div className="trophy-stage">
        {/* Behind the medal in focus, on the stage rather than in the strip: the strip clips what leaves it vertically. */}
        <span className="trophy-rays trophy-stage-rays" aria-hidden="true" />
        <button type="button" className="can-plate trophy-icon-btn trophy-arrow" onClick={() => goBy(-1)} disabled={index === 0} aria-label="Предыдущее достижение">{ARROW(0)}</button>
        <div className="trophy-track" ref={track} onScroll={scrolled} onScrollEnd={rested} tabIndex={0} aria-label="Достижения"
          onKeyDown={event => { if (event.key === 'ArrowRight') { event.preventDefault(); goBy(1); } if (event.key === 'ArrowLeft') { event.preventDefault(); goBy(-1); } }}>
          {list.map((card, at) => {
            const near = Math.abs(at - index);
            return <button key={card.key} type="button" className="trophy-slide motion-local" data-pos={near === 0 ? 'active' : near === 1 ? 'near' : undefined} tabIndex={near === 0 ? 0 : -1}
              aria-label={`${card.label}${card.earned ? ', получено' : `, выполнено ${Math.round(card.completion * 100)}%`}`} onClick={() => go(at)}>
              <Medal card={card} live={near === 0} size={360} />
            </button>;
          })}
        </div>
        <button type="button" className="can-plate trophy-icon-btn trophy-arrow" onClick={() => goBy(1)} disabled={index >= list.length - 1} aria-label="Следующее достижение">{ARROW(180)}</button>
      </div>

      {current && <section className="trophy-info" aria-live="polite">
        <span className="trophy-kicker" data-rarity={current.rarity}>{ACHIEVEMENT_RARITIES[current.rarity]}{current.tag ? ' · тег' : ''}</span>
        <h2>{current.label}</h2>
        <p className="trophy-desc">{current.description}</p>
        {current.earned
          ? <p className="trophy-status">Получено{current.earnedAt ? ` ${day.format(new Date(current.earnedAt))}` : ''}</p>
          : <ul className="trophy-steps">{current.steps.map(item => <li key={item.label} data-done={item.value >= item.goal || undefined}>
              <span>{item.label}</span><b>{Math.min(item.value, item.goal)} / {item.goal}</b>
              <i style={{ '--share': Math.min(1, item.value / item.goal) } as CSSProperties} />
            </li>)}</ul>}
        <div className="trophy-rewards" aria-label="Награда">
          <span className="trophy-reward">{CUP}+{points(current.points)}</span>
          {current.xp > 0 && <span className="trophy-reward">+{current.xp} XP</span>}
          {!current.tag && <span className="trophy-reward is-plain">Без тега</span>}
        </div>
        {isOwn && current.earned && current.tag && <div className="trophy-actions">
          <button type="button" className="can-btn" disabled={wearing || wornTag === current.key} onClick={() => wear(current)}>
            {wornTag === current.key ? 'Надет рядом с именем' : wearing ? 'Надеваем…' : 'Надеть тегом'}
          </button>
        </div>}
        {notice && <p className="trophy-note" role="status">{notice}</p>}
      </section>}

      <ol className="trophy-rail" ref={rail} aria-label="Все достижения подряд">
        {list.map((card, at) => <li key={card.key}>
          <button type="button" className="trophy-thumb motion-local" data-index={at} data-rarity={card.rarity} data-earned={card.earned || undefined} aria-current={at === index || undefined} aria-label={`${card.label}${card.earned ? '' : ', ещё не получено'}`} onClick={() => go(at)}>
            <Image src={card.art} width={64} height={64} sizes="56px" alt="" loading="lazy" />
          </button>
        </li>)}
      </ol>
    </> : <section className="trophy-empty">
      <h2>{filter === 'earned' ? 'Пока ни одного' : 'Здесь пусто'}</h2>
      <p>{filter === 'earned' ? 'Первое достижение — за первый отзыв или крутку Банкомата.' : 'Выберите другой фильтр.'}</p>
    </section>}

    {reveal.length > 0 && <TrophyReveal cards={reveal} onDone={key => { setReveal([]); show(key); }} />}
  </main>;
}

/** «Новое достижение»: each medal earned since the last visit pops in with rays, one after another. */
function TrophyReveal({ cards, onDone }: { cards: TrophyCard[]; onDone: (key: string) => void }) {
  const [at, setAt] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const card = cards[at]!;
  useEffect(() => { dialog.current?.showModal(); }, []);
  const last = at === cards.length - 1;
  const advance = () => (last ? onDone(card.key) : setAt(value => value + 1));
  return <dialog ref={dialog} className="trophy-reveal" data-rarity={card.rarity} aria-labelledby="trophy-reveal-title" onCancel={event => { event.preventDefault(); onDone(card.key); }}>
    <p className="trophy-reveal-kicker">{cards.length > 1 ? `Новое достижение · ${at + 1} из ${cards.length}` : 'Новое достижение'}</p>
    <div className="trophy-reveal-stage" key={card.key}>
      <span className="trophy-rays" aria-hidden="true" />
      <Image className="trophy-art" src={card.art} width={360} height={360} sizes="300px" alt="" />
    </div>
    <span className="trophy-kicker" data-rarity={card.rarity}>{ACHIEVEMENT_RARITIES[card.rarity]}</span>
    <h2 id="trophy-reveal-title">{card.label}</h2>
    <p className="trophy-desc">{card.description}</p>
    <div className="trophy-rewards"><span className="trophy-reward">{CUP}+{points(card.points)}</span>{card.xp > 0 && <span className="trophy-reward">+{card.xp} XP</span>}</div>
    <button type="button" className="can-btn trophy-reveal-cta" data-ready="" onClick={advance} autoFocus>{last ? 'Круто!' : 'Дальше'}</button>
  </dialog>;
}
