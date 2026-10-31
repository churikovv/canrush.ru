'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import Link from '@/components/navigation-progress';
import { AvatarFrame } from '@/components/avatar-frame';
import { claimQuestAction, pullAction } from '@/app/gacha/actions';
import { craftSpinAction } from '@/app/gacha/battle/actions';
import { ActionToast } from '@/components/action-toast';
import { GachaQuests } from '@/components/gacha-quests';
import { PAID_WINS_PER_DAY, SPIN_RING_COST, WIN_RINGS, ringsLabel } from '@/lib/battle-fields';
import { questsReady, type QuestClaim } from '@/lib/gacha-quests-fields';
import { PULL_COST, TEN_PULL_COST, pityLeft, type GachaScene, type Rarity } from '@/lib/gacha-fields';
import type { GachaState, PullResult, PulledCard } from '@/lib/gacha';
import { CapIcon, RingIcon, ShardIcon, SpinIcon } from '@/components/gacha-icons';
import { RarityChip, RarityShine } from '@/components/rarity-badge';

export { CapIcon, ShardIcon } from '@/components/gacha-icons';

/** The toast's trigger before the first answer. */
const NO_NOTICE = {};

/** Одна выпавшая банка: цвет рамки — редкость, «Новая!» — первая такая в альбоме. */
export function GachaCard({ card, index = 0 }: { card: PulledCard; index?: number }) {
  return <Link className="gacha-card rarity-card" href={card.href} data-rarity={card.rarity} style={{ '--card-index': index } as React.CSSProperties}>
    <RarityShine rarity={card.rarity} />
    <span className="gacha-card-cover"><Image src={card.cover} width={160} height={160} sizes="120px" unoptimized alt="" /></span>
    <RarityChip rarity={card.rarity} />
    <strong className="gacha-card-brand">{card.brand}</strong>
    <span className="gacha-card-name">{card.name}</span>
    {card.pity && <small className="gacha-card-pity">гарант</small>}
    <span className={`gacha-card-badge${card.isNew ? ' is-new' : ''}`}>{card.isNew ? 'Новая!' : `×${card.count}`}</span>
    {card.shards > 0 && <span className="gacha-card-shards">+{card.shards} <ShardIcon size={12} /></span>}
    {card.star && <span className="gacha-card-star" title="Звезда сезона" aria-label="Звезда сезона">🎃</span>}
  </Link>;
}

function AlbumIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="11" height="15" rx="2" transform="rotate(-8 8.5 12.5)" /><rect x="10" y="4" width="11" height="15" rx="2" fill="currentColor" fillOpacity=".25" transform="rotate(8 15.5 11.5)" />
  </svg>;
}

function BattleIcon() {
  return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M14.5 6.5 18 3h3v3l-3.5 3.5M5 14l4 4M7 17l-3 3M3 19l2 2" />
  </svg>;
}

function QuestIcon() {
  return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4.5" y="4.5" width="15" height="17" rx="3" fill="currentColor" fillOpacity=".25" /><path d="M9 2.5h6v4H9z" fill="currentColor" /><path d="m8.5 14 2.5 2.5 4.5-5" />
  </svg>;
}

/** A chunky game button: a raised face on a darker base that sinks when pressed; the price sits in its own chip. */
function GameButton({ tone, label, price, disabled, onClick }: { tone: 'orange' | 'violet'; label: string; price: ReactNode; disabled: boolean; onClick: () => void }) {
  return <button type="button" className="game-btn" data-tone={tone} disabled={disabled} onClick={onClick}>
    <span className="game-btn-face"><span className="game-btn-label">{label}</span><span className="game-btn-price">{price}</span></span>
  </button>;
}

const reducedMotion = () => typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The scene rendered in Blender: the machine idling on a loop, and on a pull the dispense clip (the can drops,
 * the burst) on top of it. `play` resolves when the clip ends (or after a safety timeout), so the cards open after it.
 */
function useScene(scene: GachaScene) {
  const idle = useRef<HTMLVideoElement>(null);
  const dispense = useRef<HTMLVideoElement>(null);
  const [dispensing, setDispensing] = useState(false);
  // The loop autoplays for everyone; with reduced motion it stops on its first frame (the poster's pose).
  useEffect(() => { if (reducedMotion()) idle.current?.pause(); }, []);
  function play(): Promise<void> {
    const video = dispense.current;
    if (!video || reducedMotion()) return Promise.resolve();
    return new Promise(resolve => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        setDispensing(false);
        if (idle.current) { idle.current.currentTime = 0; void idle.current.play().catch(() => undefined); }
        resolve();
      };
      video.onended = finish;
      // Shown only once it really plays, so a slow start never flashes an empty frame.
      video.onplaying = () => setDispensing(true);
      video.currentTime = 0;
      void video.play().catch(finish);
      setTimeout(finish, 4000);
    });
  }
  return { idle, dispense, dispensing, play };
}

/** Where the can lands in the tray, as a share of the video frame (render_scene.py's camera). */
const TRAY = { x: 0.5, y: 0.84 };

/**
 * The pulled cards pop out of the tray, rise with a glow in their rarity's colour, hang for a moment and fall in an
 * arc into the collection button, which jumps at every landing. Resolves when the last card has landed.
 */
function flyToCollection(scene: HTMLElement, view: HTMLElement, target: HTMLElement, cards: PulledCard[]): Promise<void> {
  const box = scene.getBoundingClientRect();
  const frame = view.getBoundingClientRect();
  const goal = target.getBoundingClientRect();
  const fromX = frame.left - box.left + frame.width * TRAY.x;
  const fromY = frame.top - box.top + frame.height * TRAY.y;
  const toX = goal.left - box.left + goal.width / 2 - fromX;
  const toY = goal.top - box.top + goal.height / 2 - fromY;
  const lift = Math.min(150, frame.height * 0.3);
  const shown = cards.slice(0, 10);
  return Promise.all(shown.map((card, index) => new Promise<void>(resolve => {
    const fly = document.createElement('div');
    fly.className = 'gacha-fly';
    fly.dataset.rarity = card.rarity;
    fly.style.left = `${fromX}px`;
    fly.style.top = `${fromY}px`;
    const img = document.createElement('img');
    img.src = card.cover;
    img.alt = '';
    fly.append(img);
    scene.append(fly);
    // Fans out a little so a ×10 reads as a stream of cards, not one.
    const spread = (index - (shown.length - 1) / 2) * Math.min(26, frame.width / 16);
    const delay = index * 120;
    const animation = fly.animate([
      { transform: 'translate(-50%, -50%) scale(.15) rotate(0deg)', opacity: 0, offset: 0 },
      { transform: `translate(calc(-50% + ${spread}px), calc(-50% - ${lift}px)) scale(1.18) rotate(-7deg)`, opacity: 1, offset: 0.24, easing: 'ease-in-out' },
      { transform: `translate(calc(-50% + ${spread}px), calc(-50% - ${lift * 0.9}px)) scale(1) rotate(5deg)`, opacity: 1, offset: 0.46, easing: 'cubic-bezier(.55, 0, .85, .35)' },
      { transform: `translate(calc(-50% + ${toX}px), calc(-50% + ${toY}px)) scale(.22) rotate(24deg)`, opacity: 0.9, offset: 1 },
    ], { duration: 1150, delay, easing: 'linear', fill: 'forwards' });
    animation.onfinish = () => {
      fly.remove();
      target.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.28) rotate(-6deg)' }, { transform: 'scale(.94)' }, { transform: 'scale(1)' }], { duration: 380, easing: 'ease-out' });
      // A new card adds to the counter as it lands (a duplicate does not); React sets the same total right after.
      const count = target.querySelector('.game-collection-count');
      if (card.isNew && count) count.textContent = String(Number(count.textContent) + 1);
      resolve();
    };
  }))).then(() => undefined);
}

const best = (cards: PulledCard[]): Rarity => cards.reduce<Rarity>((top, card) => (['common', 'rare', 'epic', 'legendary'].indexOf(card.rarity) > ['common', 'rare', 'epic', 'legendary'].indexOf(top) ? card.rarity : top), 'common');

/**
 * Автомат: баланс крышек, гарант, «Крутить» (бесплатно раз в день, потом за крышки) и «×10». Крутка — server action,
 * автомат трясётся, пока ждёт ответ и ещё чуть-чуть, потом банки открываются по одной.
 */
export function GachaMachine({ initial, signedIn, albumHref, scene, seasonTitle = null, rules }: {
  initial: GachaState | null; signedIn: boolean; albumHref: string | null; scene: GachaScene; seasonTitle?: string | null;
  /** The odds and caps sections (server-rendered): shown in the «?» game window */
  rules: ReactNode;
}) {
  const [state, setState] = useState(initial);
  const [cards, setCards] = useState<PulledCard[] | null>(null);
  const [cosmetic, setCosmetic] = useState<PullResult['cosmetic']>(null);
  const [error, setError] = useState<string>();
  const [spinning, setSpinning] = useState(false);
  const [pending, startTransition] = useTransition();
  const [claiming, startClaim] = useTransition();
  const [notice, setNotice] = useState<{ text: string; tone: 'success' | 'error'; host: HTMLDialogElement | null } | null>(null);
  // Kept in state, not a ref: the toast is portalled into the open window, the only place above its backdrop.
  const [questsWindow, setQuestsWindow] = useState<HTMLDialogElement | null>(null);
  const [ringsWindow, setRingsWindow] = useState<HTMLDialogElement | null>(null);
  const [crafting, startCraft] = useTransition();
  const result = useRef<HTMLDivElement>(null);
  const { idle: idleRef, dispense: dispenseRef, dispensing, play: playDispense } = useScene(scene);
  const sceneBox = useRef<HTMLDivElement>(null);
  const sceneView = useRef<HTMLDivElement>(null);
  const collection = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (cards && !spinning) result.current?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'nearest' });
  }, [cards, spinning]);

  function pull(times: 1 | 10) {
    setError(undefined);
    setCards(null);
    setSpinning(true);
    // The dispense clip is the wait.
    const clip = playDispense();
    startTransition(async () => {
      const [response] = await Promise.all([pullAction(times), clip]);
      if (!('error' in response) && !reducedMotion() && sceneBox.current && sceneView.current && collection.current) {
        await flyToCollection(sceneBox.current, sceneView.current, collection.current, response.cards);
      }
      setSpinning(false);
      if ('error' in response) { setError(response.error); return; }
      setCards(response.cards);
      setCosmetic(response.cosmetic);
      setState(response.state);
    });
  }

  function claim(quest: QuestClaim) {
    startClaim(async () => {
      const response = await claimQuestAction(quest);
      if ('error' in response) { setNotice({ text: response.error, tone: 'error', host: questsWindow }); return; }
      setState(response.state);
      setNotice({ text: `+${response.reward} крышек`, tone: 'success', host: questsWindow });
    });
  }

  function craftSpin() {
    startCraft(async () => {
      const response = await craftSpinAction();
      if ('error' in response) { setNotice({ text: response.error, tone: 'error', host: ringsWindow }); return; }
      setState(response.state);
      setNotice({ text: 'Подарочная крутка собрана', tone: 'success', host: ringsWindow });
    });
  }

  const busy = pending || spinning;
  const left = state ? pityLeft(state.pity) : null;
  const canOne = Boolean(state && (state.free || state.gifted > 0 || state.caps >= PULL_COST));
  const canTen = Boolean(state && state.caps >= TEN_PULL_COST);
  const top = cards ? best(cards) : null;
  const quests = state && !state.blocked ? state.quests : null;
  const ready = quests ? questsReady(quests) : 0;

  const season = state?.banner ?? null;
  const rulesDialog = useRef<HTMLDialogElement>(null);
  const results = <div ref={result} aria-live="polite">
    {cosmetic && !spinning && <div className="gacha-cosmetic" role="status">
      <span className="gacha-cosmetic-avatar" aria-hidden="true"><span /><AvatarFrame frame="pumpkin" /></span>
      <div><strong>{cosmetic.title} — ваша!</strong><span>Она уже в «Настройки → Оформление → Рамка аватарки». После Хеллоуина её не достать.</span>
        <Link href="/profile/settings?section=appearance">Надеть рамку →</Link></div>
    </div>}
    {cards && !spinning && <div className="gacha-result" data-best={top ?? undefined}>
      <h2>{cards.length === 1 ? 'Выпало' : `Выпало ${cards.length} банок`}{top === 'legendary' ? ' · легенда!' : top === 'epic' ? ' · эпик!' : ''}</h2>
      <div className="gacha-cards">{cards.map((card, index) => <GachaCard key={`${card.brand}-${card.flavor}-${index}`} card={card} index={index} />)}</div>
    </div>}
  </div>;

  return <section className="gacha gacha-game" aria-labelledby="gacha-title" style={{ '--scene-ground': scene.ground } as React.CSSProperties}>
    <h1 id="gacha-title" className="sr-only">{seasonTitle ?? 'Банкомат'}</h1>
    <div ref={sceneBox} className="gacha-scene" data-dispensing={dispensing || undefined}>
      <div ref={sceneView} className="gacha-scene-view" style={{ aspectRatio: `${scene.width} / ${scene.height}` }}>
        <video ref={idleRef} className="gacha-video" src={scene.idle} poster={scene.poster} autoPlay loop muted playsInline preload="auto" aria-hidden="true" />
        <video ref={dispenseRef} className="gacha-video gacha-video-dispense" src={scene.dispense} muted playsInline preload="auto" aria-hidden="true" />
      </div>
      <div className="gacha-hud gacha-hud-top">
        <div className="gacha-hud-left">
          <div className="gacha-hud-title">{seasonTitle && <span aria-hidden="true">🎃</span>}{seasonTitle ?? 'Банкомат'}{season && <small>до {season.ends}</small>}</div>
          {!state?.blocked && <Link className="game-battle" href="/gacha/battle" data-active={state?.inBattle || undefined} aria-label={state?.inBattle ? 'Вернуться в бой' : 'Битва банок'}>
            <span className="game-round is-battle"><BattleIcon /></span>
            {state?.inBattle && <span className="game-battle-flag" aria-hidden="true">Вернуться</span>}
          </Link>}
        </div>
        <div className="gacha-hud-side">
          {state && <div className="gacha-hud-chips">
            <span className="game-chip" aria-label={`Крышек: ${state.caps}`}><CapIcon size={20} />{state.caps}</span>
            <span className="game-chip" aria-label={`Осколков: ${state.shards}`}><ShardIcon size={17} />{state.shards}</span>
            {!state.blocked && <button type="button" className="game-chip is-rings" data-ready={state.rings >= SPIN_RING_COST || undefined} onClick={() => ringsWindow?.showModal()} aria-haspopup="dialog" aria-label={`Колечек: ${state.rings}. Собрать крутку`}><RingIcon size={18} />{state.rings}</button>}
            {state.gifted > 0 && <span className="game-chip" aria-label={`Подарочных круток: ${state.gifted}`}><SpinIcon size={18} />{state.gifted}</span>}
          </div>}
          <div className="gacha-hud-icons">
            <button type="button" className="game-round" onClick={() => rulesDialog.current?.showModal()} aria-haspopup="dialog" aria-label="Условия: шансы, гарант и крышки"><span aria-hidden="true">?</span></button>
            {quests && <span className="game-quests">
              <button type="button" className="game-round is-quests" onClick={() => questsWindow?.showModal()} aria-haspopup="dialog"
                aria-label={`Задания дня: ${ready ? `можно забрать наград — ${ready}` : `сделано ${quests.claimed} из ${quests.rows.length}`}`}><QuestIcon /></button>
              {ready > 0 ? <span className="game-quests-count" data-ready="" aria-hidden="true">{ready}</span>
                : quests.claimed < quests.rows.length ? <span className="game-quests-count" aria-hidden="true">{quests.claimed}/{quests.rows.length}</span> : null}
            </span>}
          </div>
        </div>
      </div>
      <div className="gacha-hud gacha-hud-bottom">
        {signedIn && state ? <div className="game-buttons" data-collection={albumHref ? '' : undefined}>
          {albumHref && <span ref={collection} className="game-collection">
            <Link className="game-round is-collection" href={albumHref} aria-label={`Коллекция: ${state.cards} карточек`}><AlbumIcon /></Link>
            <span className="game-collection-count" aria-hidden="true">{state.cards}</span>
          </span>}
          <GameButton tone="orange" label={busy ? 'Крутим…' : 'Крутить'} disabled={busy || !canOne || state.blocked} onClick={() => pull(1)}
            price={state.free ? 'Бесплатно' : state.gifted > 0 ? `Подарок · ${state.gifted}` : <><CapIcon size={16} />{PULL_COST}</>} />
          <GameButton tone="violet" label="×10" disabled={busy || !canTen || state.blocked} onClick={() => pull(10)}
            price={<><CapIcon size={16} />{TEN_PULL_COST}</>} />
        </div> : <div className="game-buttons"><Link className="game-btn" data-tone="orange" href="/sign-in"><span className="game-btn-face"><span className="game-btn-label">Войти и крутить</span></span></Link></div>}
      </div>
    </div>
    {(error || (state && !state.free && !canOne)) && <div className="gacha-under">
      {state && !state.free && !canOne && <p className="gacha-hint">Бесплатная крутка вернётся завтра. Крышки дают задания дня, остальное — в «?».</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>}
    <dialog ref={rulesDialog} className="game-dialog" aria-labelledby="gacha-rules-title" onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
      <div className="game-dialog-panel">
        <header className="game-dialog-head">
          <h2 id="gacha-rules-title">Условия</h2>
          <button type="button" className="game-round is-close" onClick={() => rulesDialog.current?.close()} aria-label="Закрыть"><span aria-hidden="true">×</span></button>
        </header>
        <div className="game-dialog-body">
          {left && <section className="game-dialog-pity" aria-label="Гарант">
            <div><b>{left.epic}</b><span>до эпика</span></div>
            <div><b>{left.legendary}</b><span>до легенды</span></div>
            {season?.cosmetic && <div className="is-cosmetic"><b>{season.cosmetic.owned ? '✓' : season.cosmetic.left}</b><span>{season.cosmetic.owned ? 'рамка ваша' : 'до рамки'}</span></div>}
          </section>}
          {season && <p className="game-dialog-season">{season.subtitle}{season.cosmetic && !season.cosmetic.owned ? ` Шанс рамки — ${season.cosmetic.chance}% за крутку.` : ''} До {season.ends}.</p>}
          {rules}
        </div>
      </div>
    </dialog>
    {quests && state && <dialog ref={setQuestsWindow} className="game-dialog" aria-labelledby="gacha-quests-title" onClick={event => {
      // A task's link leaves the page, and a window in the top layer would stay over the loading screen.
      if (event.target === event.currentTarget || (event.target as Element).closest('a')) event.currentTarget.close();
    }}>
      <div className="game-dialog-panel">
        <header className="game-dialog-head">
          <h2 id="gacha-quests-title">Задания дня</h2>
          <button type="button" className="game-round is-close" onClick={() => questsWindow?.close()} aria-label="Закрыть"><span aria-hidden="true">×</span></button>
        </header>
        <div className="game-dialog-body">
          <div className="quests-sum"><span>Сделано {quests.claimed} из {quests.rows.length}</span><span className="game-chip" aria-label={`Крышек: ${state.caps}`}><CapIcon size={20} />{state.caps}</span></div>
          <GachaQuests board={quests} busy={claiming} onClaim={claim} />
        </div>
      </div>
    </dialog>}
    <ActionToast message={notice?.text} tone={notice?.tone} trigger={notice ?? NO_NOTICE} container={notice?.host} />
    {state && !state.blocked && <dialog ref={setRingsWindow} className="game-dialog" aria-labelledby="gacha-rings-title" onClick={event => {
      if (event.target === event.currentTarget || (event.target as Element).closest('a')) event.currentTarget.close();
    }}>
      <div className="game-dialog-panel">
        <header className="game-dialog-head">
          <h2 id="gacha-rings-title">Колечки</h2>
          <button type="button" className="game-round is-close" onClick={() => ringsWindow?.close()} aria-label="Закрыть"><span aria-hidden="true">×</span></button>
        </header>
        <div className="game-dialog-body">
          <div className="rings-craft">
            <span className="rings-craft-count"><RingIcon size={34} />{state.rings} из {SPIN_RING_COST}</span>
            <span className="rings-craft-bar" aria-hidden="true"><span style={{ transform: `scaleX(${Math.min(1, state.rings / SPIN_RING_COST)})` }} /></span>
            <p>{SPIN_RING_COST} колечек — одна подарочная крутка. Победа в Битве банок даёт {ringsLabel(WIN_RINGS)}, оплачиваются первые {PAID_WINS_PER_DAY} побед за день.</p>
            <button type="button" className="quest-claim rings-craft-button" disabled={crafting || state.rings < SPIN_RING_COST} onClick={craftSpin}>{state.rings < SPIN_RING_COST ? `Ещё ${ringsLabel(SPIN_RING_COST - state.rings)}` : 'Собрать крутку'}</button>
            <Link className="rings-craft-link" href="/gacha/battle">В бой</Link>
          </div>
        </div>
      </div>
    </dialog>}
    {results}
  </section>;
}
