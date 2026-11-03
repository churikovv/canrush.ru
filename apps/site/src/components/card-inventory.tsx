'use client';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState, useTransition, type CSSProperties } from 'react';
import { craftAction } from '@/app/gacha/actions';
import { AtmKeyFace } from '@/components/atm-key';
import { BigCard, MissingBigCard, type ShownCard } from '@/components/big-card';
import { BottomSheet, BottomSheetHead } from '@/components/bottom-sheet';
import { CardInspector } from '@/components/card-inspector';
import { ShardIcon } from '@/components/gacha-icons';
import Link from '@/components/navigation-progress';
import { canSkin, skinTraits } from '@/lib/can-skin';
import { RARITIES, RARITY_LABELS, rarityRank, type Rarity } from '@/lib/gacha-fields';

/** A card of the inventory: owned ones carry their copies, missing ones the price to craft them in shards. */
export interface InventoryCard extends ShownCard { owned: boolean; cost: number }
type Filter = 'all' | Rarity | 'missing';
/** Filter chips name groups of cards, so in the plural. */
const RARITY_PLURAL: Record<Rarity, string> = { common: 'Обычные', rare: 'Редкие', epic: 'Эпические', legendary: 'Легендарные' };

/** Slides kept as real cards around the one in focus; the rest are light covers of the same size, so scrolling stays put. */
const WINDOW = 3;
/** How long the strip must be still before the card in focus changes (`scrollend` comes sooner where it exists). */
const SETTLE_MS = 120;
const ARROW = (turn: number) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: `rotate(${turn}deg)` }}><path d="m15 5-7 7 7 7" /></svg>;
const order = (a: InventoryCard, b: InventoryCard) => rarityRank(b.rarity) - rarityRank(a.rarity) || a.brand.localeCompare(b.brand, 'ru') || a.name.localeCompare(b.name, 'ru');

/**
 * The Bankomat inventory as a game screen, like the season pass: a very big card in the middle that swipes to the
 * next, the backdrop lit by the can's colour, its look below, and a strip of small cards at the bottom to jump around.
 * Filters by rarity and by brand; the owner also sees the missing cans and crafts them for shards. A tap on the card
 * in focus opens it up close (`CardInspector`).
 */
export function CardInventory({ cards, isOwn, shards, owner, backHref }: { cards: InventoryCard[]; isOwn: boolean; shards: number; owner: string; backHref: string }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [brand, setBrand] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [inspecting, setInspecting] = useState<ShownCard | null>(null);
  const [crafting, startCraft] = useTransition();
  const [error, setError] = useState('');
  const track = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLOListElement>(null);
  const brands = useRef<HTMLDialogElement>(null);
  const settle = useRef(0);
  // The card an arrow or a key is taking the strip to: a second press before it arrives goes one further.
  const aim = useRef<number | null>(null);

  const owned = useMemo(() => cards.filter(card => card.owned), [cards]);
  const counts = useMemo(() => Object.fromEntries(RARITIES.map(rarity => [rarity, owned.filter(card => card.rarity === rarity).length])) as Record<Rarity, number>, [owned]);
  const brandRows = useMemo(() => [...new Set(cards.map(card => card.brand))].map(name => ({ name, owned: owned.filter(card => card.brand === name).length, total: cards.filter(card => card.brand === name).length }))
    .sort((a, b) => b.owned - a.owned || a.name.localeCompare(b.name, 'ru')), [cards, owned]);
  const list = useMemo(() => cards.filter(card => (filter === 'missing' ? !card.owned : card.owned && (filter === 'all' || card.rarity === filter)) && (!brand || card.brand === brand))
    .sort(filter === 'missing' ? (a, b) => a.brand.localeCompare(b.brand, 'ru') || a.cost - b.cost : order), [cards, filter, brand]);
  const index = Math.min(active, Math.max(0, list.length - 1));
  const current = list[index];
  const skin = current?.owned ? canSkin(current.brand, current.flavor) : null;

  /** Distance between two slides, measured: the width depends on the screen. */
  const step = () => {
    const first = track.current?.querySelector<HTMLElement>('.inv-slide');
    const gap = track.current ? parseFloat(getComputedStyle(track.current).columnGap) || 0 : 0;
    return first ? first.offsetWidth + gap : 1;
  };
  function go(target: number) {
    const next = Math.max(0, Math.min(list.length - 1, target));
    aim.current = next;
    track.current?.scrollTo({ left: next * step(), behavior: 'smooth' });
  }
  const goBy = (shift: number) => go((aim.current ?? index) + shift);
  /**
   * The card in focus changes only when the strip comes to rest. Re-rendering the slides while a flick was still moving
   * (a new card in focus, real cards mounted at the window's edge, their look starting to move) changed the layout inside
   * the snap container, and the phone snapped back to the card it had left: a fast swipe «sometimes came back».
   */
  function scrolled() {
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(rested, SETTLE_MS);
  }
  function rested() {
    window.clearTimeout(settle.current);
    if (!track.current) return;
    aim.current = null;
    setActive(Math.round(track.current.scrollLeft / step()));
  }
  useEffect(() => () => window.clearTimeout(settle.current), []);
  function choose(next: Filter, nextBrand = brand) {
    setFilter(next);
    setBrand(nextBrand);
    setActive(0);
    setError('');
    track.current?.scrollTo({ left: 0 });
  }

  // The strip follows the card in focus.
  useEffect(() => {
    const thumb = rail.current?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    const box = rail.current;
    if (thumb && box) box.scrollTo({ left: thumb.offsetLeft - (box.clientWidth - thumb.offsetWidth) / 2, behavior: 'smooth' });
  }, [index, list]);

  function craft(card: InventoryCard) {
    if (!window.confirm(`Собрать карточку бренда ${card.brand} за ${card.cost} осколков? Какая банка — узнаете после.`)) return;
    setError('');
    startCraft(async () => {
      const result = await craftAction(card.brand, card.flavor);
      if ('error' in result) { setError(result.error); return; }
      router.refresh();
    });
  }

  const traits = current?.owned && skin ? skinTraits(skin, current.rarity) : [];
  const style = { '--inv-a': skin?.a ?? '#3a4152', '--inv-b': skin?.b ?? '#1b2030' } as CSSProperties;
  const filters: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: 'Все', count: owned.length },
    ...[...RARITIES].reverse().map(rarity => ({ key: rarity, label: RARITY_PLURAL[rarity], count: counts[rarity] })),
    ...(isOwn ? [{ key: 'missing' as const, label: 'Не хватает', count: cards.length - owned.length }] : []),
  ];

  return <main className="inv-screen" data-rarity={current?.owned ? current.rarity : undefined} style={style} data-no-pull>
    <header className="inv-top">
      <Link className="can-plate inv-icon-btn" href={backHref} aria-label="Назад"><span aria-hidden="true">‹</span></Link>
      <div className="inv-title">
        <h1>Коллекция</h1>
        <p>{isOwn ? 'Ваши карточки' : owner} · {owned.length} из {cards.length}</p>
      </div>
      {isOwn && <span className="can-plate inv-shards" title="Осколки: дубли превращаются в них, из них собираются недостающие карточки"><ShardIcon size={18} />{shards}<span className="sr-only"> осколков</span></span>}
    </header>

    <div className="inv-filters" role="toolbar" aria-label="Какие карточки показать">
      {filters.map(item => <button key={item.key} type="button" className="inv-chip" data-rarity={item.key !== 'all' && item.key !== 'missing' ? item.key : undefined} aria-pressed={filter === item.key} onClick={() => choose(item.key)}>{item.label}<b>{item.count}</b></button>)}
      <button type="button" className="inv-chip" aria-pressed={Boolean(brand)} aria-haspopup="dialog" onClick={() => brands.current?.showModal()}>{brand ?? 'Бренд'}<span aria-hidden="true">▾</span></button>
    </div>

    {list.length ? <>
      <div className="inv-stage">
        <button type="button" className="can-plate inv-icon-btn inv-arrow" onClick={() => goBy(-1)} disabled={index === 0} aria-label="Предыдущая карточка">{ARROW(0)}</button>
        <div className="inv-track" ref={track} onScroll={scrolled} onScrollEnd={rested} tabIndex={0} aria-label="Карточки"
          onKeyDown={event => { if (event.key === 'ArrowRight') { event.preventDefault(); goBy(1); } if (event.key === 'ArrowLeft') { event.preventDefault(); goBy(-1); } }}>
          {list.map((card, at) => {
            const near = Math.abs(at - index);
            // `motion-local`: no press animation — it wrote an inline transform on the slide from the first touch of a swipe.
            return <button key={`${card.brand}\u0000${card.flavor}`} type="button" className="inv-slide motion-local" data-pos={near === 0 ? 'active' : near === 1 ? 'near' : undefined} tabIndex={near === 0 ? 0 : -1}
              aria-label={card.owned ? `${card.brand}, ${card.name}${near === 0 ? ' — открыть крупно' : ''}` : `${card.brand}, ещё нет в коллекции`}
              onClick={() => (near === 0 ? card.owned && setInspecting(card) : go(at))}>
              {near > WINDOW
                ? <span className="inv-slide-lite" data-rarity={card.owned ? card.rarity : undefined}>{card.owned ? <Image src={card.cover} width={160} height={160} sizes="160px" unoptimized alt="" loading="lazy" draggable={false} /> : <b aria-hidden="true">?</b>}</span>
                : card.owned ? <BigCard card={card} live={near === 0} /> : <MissingBigCard brand={card.brand} />}
            </button>;
          })}
        </div>
        <button type="button" className="can-plate inv-icon-btn inv-arrow" onClick={() => goBy(1)} disabled={index >= list.length - 1} aria-label="Следующая карточка">{ARROW(180)}</button>
      </div>

      {current && <section className="inv-info" aria-live="polite">
        <span className="inv-kicker" data-rarity={current.owned ? current.rarity : undefined}>{current.owned ? `${RARITY_LABELS[current.rarity]}${(current.count ?? 0) > 1 ? ` · ×${current.count}` : ''}` : 'Нет в коллекции'}</span>
        <h2>{current.owned ? `${current.brand} · ${current.name}` : current.brand}</h2>
        {traits.length > 0 && <ul className="card-traits" aria-label="Облик">{traits.map(item => <li key={item.kind} data-rare={item.rare || undefined}><small>{item.kind}</small>{item.name}{item.rare && <b aria-label="редкий"> ✦</b>}</li>)}</ul>}
        {/* An owned card opens up close by a tap, and the drink is one more tap there; only a missing one needs a button here. */}
        {!current.owned && isOwn && <div className="inv-actions">
          <button type="button" className="can-btn" disabled={crafting || shards < current.cost} onClick={() => craft(current)}>
            {crafting ? 'Собираем…' : <>Собрать · <ShardIcon size={16} />{current.cost}</>}
          </button>
        </div>}
        {!current.owned && isOwn && shards < current.cost && <p className="inv-note">Не хватает осколков: дубли из Банкомата превращаются в них.</p>}
        {error && <p className="inv-note is-error" role="alert">{error}</p>}
      </section>}

      <ol className="inv-rail" ref={rail} aria-label="Все карточки подряд">
        {list.map((card, at) => <li key={`${card.brand}\u0000${card.flavor}`}>
          <button type="button" className="inv-thumb motion-local" data-index={at} data-rarity={card.owned ? card.rarity : undefined} aria-current={at === index || undefined} aria-label={card.owned ? `${card.brand}, ${card.name}` : `${card.brand}, нет в коллекции`} onClick={() => go(at)}>
            {card.owned ? <Image src={card.cover} width={64} height={64} sizes="56px" unoptimized alt="" loading="lazy" /> : <span className="inv-thumb-missing">?</span>}
          </button>
        </li>)}
      </ol>
    </> : <section className="inv-empty">
      <h2>{filter === 'missing' ? 'Собраны все банки' : brand ? `Нет карточек ${brand}` : 'Пока ни одной карточки'}</h2>
      <p>{filter === 'all' && !brand ? 'Первая крутка в день — бесплатно.' : 'Выберите другой фильтр.'}</p>
      {isOwn && filter === 'all' && !brand && <Link className="atm-key inv-empty-try" data-tone="gold" href="/gacha"><AtmKeyFace label="Крутить Банкомат" /></Link>}
    </section>}

    <BottomSheet ref={brands} className="inv-brands" labelledBy="inv-brands-title">
      <BottomSheetHead id="inv-brands-title" title="Бренды" onClose={() => brands.current?.close()} />
      <ul className="inv-brand-list">
        <li><button type="button" aria-pressed={!brand} onClick={() => { choose(filter, null); brands.current?.close(); }}><b>Все бренды</b><span>{owned.length} из {cards.length}</span></button></li>
        {brandRows.map(row => <li key={row.name}><button type="button" aria-pressed={brand === row.name} onClick={() => { choose(filter, row.name); brands.current?.close(); }}>
          <b>{row.name}</b><span>{row.owned} из {row.total}</span><i style={{ '--share': row.owned / row.total } as CSSProperties} />
        </button></li>)}
      </ul>
    </BottomSheet>

    {inspecting && <CardInspector card={inspecting} onClose={() => setInspecting(null)} />}
  </main>;
}
