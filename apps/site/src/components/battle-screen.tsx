'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { battleMoveAction, battleResumeAction, craftSpinAction, startBattleAction } from '@/app/gacha/battle/actions';
import { ActionToast } from '@/components/action-toast';
import { DrinkBird } from '@/components/drink-bird';
import { RingIcon, SpinIcon } from '@/components/gacha-icons';
import Link from '@/components/navigation-progress';
import type { BattleFrame, BattleHome, BattleReward } from '@/lib/battle';
import { canAttack, legalTargets, type BattleSideView, type BattleView, type HandCard, type Unit } from '@/lib/battle-engine';
import { DRAG_SLOP, FLICK_WINDOW_MS, releasedOnTable } from '@/lib/battle-gesture';
import { BATTLE_KEYWORDS, BOARD_SIZE, DECK_SIZE, HERO_POWER_COST, HERO_POWER_DAMAGE, KEYWORD_INFO, MAX_MANA, PAID_WINS_PER_DAY, SPIN_RING_COST, STARTER_CARDS, WIN_RINGS, ringsLabel, type BattleCardDef, type BattleKeyword } from '@/lib/battle-fields';

const NO_NOTICE = {};
const RIVAL = 'Сова';

const reduced = () => typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms: number) => new Promise(resolve => { setTimeout(resolve, reduced() ? Math.min(ms, 150) : ms); });

const KEYWORD_ICONS: Record<BattleKeyword, string> = {
  shield: 'M12 3 20 6v6c0 4.6-3.2 7.8-8 9-4.8-1.2-8-4.4-8-9V6Z',
  match: 'M12 20.5 4.6 13a4.6 4.6 0 0 1 6.5-6.5l.9.9.9-.9a4.6 4.6 0 0 1 6.5 6.5Z',
  taunt: 'M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H10l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  loyal: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8Z',
  rush: 'M13.5 2 5 13.5h6L9.5 22 19 9.5h-6.5Z',
};

function Cover({ card }: { card: BattleCardDef }) {
  return card.cover ? <Image src={card.cover} width={120} height={120} sizes="120px" unoptimized alt="" /> : <span className="bt-plain" aria-hidden="true" />;
}

function KeywordMark({ keyword }: { keyword: BattleKeyword }) {
  return <span className="bt-keyword" data-keyword={keyword} aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d={KEYWORD_ICONS[keyword]} /></svg></span>;
}

function Stats({ attack, health, hurt = false }: { attack: number; health: number; hurt?: boolean }) {
  return <>
    <span className="bt-stat is-attack">{attack}</span>
    <span className="bt-stat is-health" data-hurt={hurt || undefined}>{health}</span>
  </>;
}

const describe = (card: BattleCardDef, attack: number, health: number) => `${card.title}, ${card.name}: атака ${attack}, здоровье ${health}${card.keyword ? `, ${KEYWORD_INFO[card.keyword].title}` : ''}`;

type Grab = (event: ReactPointerEvent<HTMLButtonElement>) => void;

function UnitTile({ unit, ready, selected, targeted, onTap, onGrab }: { unit: Unit; ready: boolean; selected: boolean; targeted: boolean; onTap: () => void; onGrab?: Grab }) {
  const { card } = unit;
  return <button type="button" className="bt-unit" data-bt={unit.uid} data-rarity={card.rarity ?? undefined} data-keyword={card.keyword ?? undefined} data-shield={unit.shield || undefined}
    data-ready={ready || undefined} data-selected={selected || undefined} data-target={targeted || undefined} data-sleeping={unit.sleeping || undefined}
    aria-pressed={selected} aria-label={describe(card, unit.attack, unit.health)} onClick={onTap} onPointerDown={onGrab}>
    <span className="bt-unit-cover"><Cover card={card} /></span>
    {card.keyword && <KeywordMark keyword={card.keyword} />}
    <Stats attack={unit.attack} health={unit.health} hurt={unit.health < unit.maxHealth} />
  </button>;
}

function CardFace({ card }: { card: BattleCardDef }) {
  return <>
    <span className="bt-cost">{card.cost}</span>
    <span className="bt-card-cover"><Cover card={card} /></span>
    {card.keyword && <KeywordMark keyword={card.keyword} />}
    <span className="bt-card-name">{card.title}</span>
    <Stats attack={card.attack} health={card.health} />
  </>;
}

/** Веер: крайние карты наклонены и чуть опущены. */
function fan(index: number, total: number, degrees = 4) {
  const offset = index - (total - 1) / 2;
  return { '--turn': `${offset * degrees}deg`, '--drop': `${offset * offset * 1.5}px` } as CSSProperties;
}

function HandTile({ card, index, total, playable, lifted, onTap, onGrab }: { card: HandCard; index: number; total: number; playable: boolean; lifted: boolean; onTap: () => void; onGrab: Grab }) {
  return <button type="button" className="bt-card" data-rarity={card.rarity ?? undefined} data-playable={playable || undefined} data-lifted={lifted || undefined} style={fan(index, total)} aria-label={`${describe(card, card.attack, card.health)}, стоит ${card.cost}`} onClick={onTap} onPointerDown={onGrab}>
    <CardFace card={card} />
  </button>;
}

function Hero({ side, label, data, target, face, onTap }: { side: 'me' | 'rival'; label: string; data: BattleSideView; target: boolean; face: React.ReactNode; onTap?: () => void }) {
  const health = Math.max(0, data.health);
  return <button type="button" className="bt-hero" data-bt={`hero:${side}`} data-side={side} data-target={target || undefined} disabled={!onTap} aria-label={`${label}: здоровье ${health}`} onClick={onTap}>
    <span className="bt-hero-face">{face}</span>
    <span className="bt-hero-health" data-hurt={health < data.maxHealth || undefined}>{health}</span>
  </button>;
}

function Mana({ data }: { data: BattleSideView }) {
  return <span className="bt-mana" role="img" aria-label={`Мана: ${data.mana} из ${data.maxMana}`}>
    {Array.from({ length: MAX_MANA }, (_, index) => <i key={index} data-state={index < data.mana ? 'full' : index < data.maxMana ? 'spent' : undefined} />)}
    <b>{data.mana}/{data.maxMana}</b>
  </span>;
}

/** Действие героя с подписью: что делает и сколько стоит. Недоступное нажимается и объясняет почему. */
function ToolButton({ tone, icon, title, hint, ready, label, onClick }: { tone: 'power' | 'coin'; icon: ReactNode; title: string; hint: string; ready: boolean; label: string; onClick: () => void }) {
  return <button type="button" className="bt-tool" data-tone={tone} data-ready={ready || undefined} aria-disabled={!ready} aria-label={label} onClick={onClick}>
    <span className="bt-tool-icon" aria-hidden="true">{icon}</span>
    <span className="bt-tool-text"><strong>{title}</strong><small>{hint}</small></span>
  </button>;
}

function GameAction({ label, tone = 'orange', disabled, onClick }: { label: string; tone?: 'orange' | 'violet' | 'red'; disabled?: boolean; onClick: () => void }) {
  return <button type="button" className="game-btn" data-tone={tone} disabled={disabled} onClick={onClick}><span className="game-btn-face"><span className="game-btn-label">{label}</span></span></button>;
}

function Progress({ rings }: { rings: number }) {
  return <div className="bt-progress">
    <span className="bt-progress-label"><RingIcon size={18} />{Math.min(rings, SPIN_RING_COST)} из {SPIN_RING_COST} до крутки</span>
    <span className="bt-progress-bar" aria-hidden="true"><span style={{ transform: `scaleX(${Math.min(1, rings / SPIN_RING_COST)})` }} /></span>
  </div>;
}

function Rules() {
  return <div className="bt-rules">
    <p>Каждый ход прибавляет ману. Киньте карту на стол или нажмите на неё. Чтобы ударить, потяните свою банку к банке соперника или к его герою. У кого здоровье закончится первым, тот проиграл.</p>
    <p>Числа карты берутся из данных сайта на месяц: мана — из цены, атака — из оценок вкуса, здоровье — из оценок дизайна. Это мнение участников, а не сайта.</p>
    <ul>{BATTLE_KEYWORDS.map(keyword => <li key={keyword}><KeywordMark keyword={keyword} /><span><b>{KEYWORD_INFO[keyword].title}</b> {KEYWORD_INFO[keyword].rule}. <small>{KEYWORD_INFO[keyword].source}.</small></span></li>)}</ul>
  </div>;
}

/** Окно поверх стола: та же игровая панель, что у «?» в Банкомате. */
function GameWindow({ title, onClose, onBack, children }: { title: string; onClose: () => void; onBack?: () => void; children: ReactNode }) {
  return <div className="bt-overlay" onClick={onClose}>
    <div className="game-dialog-panel bt-window" role="dialog" aria-modal="true" aria-labelledby="bt-window-title" onClick={event => event.stopPropagation()}>
      <header className="game-dialog-head">
        {onBack && <button type="button" className="game-round is-back" onClick={onBack} aria-label="Назад"><span aria-hidden="true">‹</span></button>}
        <h2 id="bt-window-title">{title}</h2>
        <button type="button" className="game-round is-close" onClick={onClose} aria-label="Закрыть"><span aria-hidden="true">×</span></button>
      </header>
      <div className="game-dialog-body">{children}</div>
    </div>
  </div>;
}

function MenuRow({ icon, title, hint, danger }: { icon: ReactNode; title: string; hint: string; danger?: boolean }) {
  return <>
    <span className="bt-menu-icon" data-danger={danger || undefined} aria-hidden="true">{icon}</span>
    <span className="bt-menu-text"><strong>{title}</strong><small>{hint}</small></span>
    <span className="bt-menu-arrow" aria-hidden="true">›</span>
  </>;
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const MACHINE_ICON = <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8.5 7h7v6h-7zM9 17h4" /></svg>;
const FLAG_ICON = <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}><path d="M6 21V4h11l-2.5 4 2.5 4H6" /></svg>;

type Zoom = { card: BattleCardDef; attack: number; health: number; play: string | null; playable: boolean };
type BattleWindow = 'pause' | 'rules' | 'surrender' | 'deck';

/** «Битва банок» на досках: стартовый экран, бой с Совой и итог. Ходы решает сервер, здесь только показ кадров. */
export function BattleScreen({ home, signedIn }: { home: BattleHome | null; signedIn: boolean }) {
  const [battleId, setBattleId] = useState(home?.battle?.id ?? null);
  const [view, setView] = useState<BattleView | null>(home?.battle?.view ?? null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState<Zoom | null>(null);
  const [played, setPlayed] = useState<BattleCardDef | null>(null);
  const [menu, setMenu] = useState<BattleWindow | null>(null);
  const [reward, setReward] = useState<BattleReward | null>(null);
  const [rings, setRings] = useState(home?.rings ?? 0);
  const [paidLeft, setPaidLeft] = useState(home?.paidLeft ?? PAID_WINS_PER_DAY);
  const [notice, setNotice] = useState<{ text: string; tone: 'success' | 'error' } | null>(null);
  const [flying, setFlying] = useState<{ card: HandCard; x: number; y: number } | null>(null);
  const [aiming, setAiming] = useState<{ x: number; y: number } | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const hand = useRef<HTMLElement>(null);
  const table = useRef<HTMLDivElement>(null);
  const flyingNode = useRef<HTMLDivElement>(null);
  const aimLine = useRef<SVGLineElement>(null);
  const aimRing = useRef<SVGCircleElement>(null);
  const dragged = useRef(false);
  const acted = useRef(false);
  const backEntry = useRef(false);
  const windowOpen = menu !== null;

  // Кэш переходов мог отдать старую страницу: стол и колечки сверяются с сервером при каждом открытии экрана.
  useEffect(() => {
    if (!signedIn) return;
    void battleResumeAction().then(fresh => {
      if (!fresh || acted.current) return;
      setBattleId(fresh.battle?.id ?? null);
      setView(fresh.battle?.view ?? null);
      setRings(fresh.rings);
      setPaidLeft(fresh.paidLeft);
    }).catch(() => undefined);
  }, [signedIn]);

  // Системное «назад» закрывает окно, а не уводит из боя: своя запись истории на время окна.
  useEffect(() => {
    if (!windowOpen) return;
    history.pushState({ canrushBattleWindow: true }, '');
    backEntry.current = true;
    const onPop = () => { backEntry.current = false; setMenu(null); };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenu(null); };
    window.addEventListener('popstate', onPop);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('keydown', onKey);
      if (backEntry.current) { backEntry.current = false; history.back(); }
    };
  }, [windowOpen]);

  const find = (id: string) => stage.current?.querySelector<HTMLElement>(`[data-bt="${id}"]`) ?? null;

  /** Числа урона всплывают над целью; узлы живут вне React и убирают себя сами. */
  function floats(hits: readonly { target: string; amount: number; blocked: boolean }[]) {
    const box = stage.current?.getBoundingClientRect();
    if (!box) return;
    for (const hit of hits) {
      const rect = find(hit.target)?.getBoundingClientRect();
      if (!rect) continue;
      const mark = document.createElement('span');
      mark.className = 'bt-float';
      mark.dataset.blocked = hit.blocked ? 'true' : 'false';
      mark.textContent = hit.blocked ? 'S-тир!' : `−${hit.amount}`;
      mark.style.left = `${rect.left - box.left + rect.width / 2}px`;
      mark.style.top = `${rect.top - box.top + rect.height / 2}px`;
      stage.current?.append(mark);
      mark.animate([{ transform: 'translate(-50%, -50%) scale(.6)', opacity: 0 }, { transform: 'translate(-50%, -90%) scale(1.25)', opacity: 1, offset: .25 }, { transform: 'translate(-50%, -190%) scale(1)', opacity: 0 }], { duration: reduced() ? 300 : 800, easing: 'ease-out' }).onfinish = () => mark.remove();
    }
  }

  async function lunge(from: string, to: string) {
    const source = find(from), goal = find(to);
    if (!source || !goal || reduced()) return;
    const a = source.getBoundingClientRect(), b = goal.getBoundingClientRect();
    const x = b.left + b.width / 2 - a.left - a.width / 2, y = b.top + b.height / 2 - a.top - a.height / 2;
    source.style.zIndex = '4';
    await source.animate([{ transform: 'none' }, { transform: `translate(${x * .15}px, ${y * .15}px) scale(1.12)`, offset: .3 }, { transform: `translate(${x * .85}px, ${y * .85}px) scale(1.05)`, offset: .62, easing: 'ease-in' }, { transform: 'none' }], { duration: 460, easing: 'ease-out' }).finished.catch(() => undefined);
    source.style.zIndex = '';
  }

  async function playFrames(frames: readonly BattleFrame[]) {
    for (const { event, view: next } of frames) {
      const rival = 'side' in event && event.side === 'rival';
      if (event.kind === 'attack') {
        await lunge(event.attacker, event.target);
        floats(event.hits);
        for (const hit of event.hits.filter(item => item.dead)) find(hit.target)?.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.6) rotate(-8deg)' }], { duration: 240, fill: 'forwards' });
        await wait(240);
      } else if (event.kind === 'power') {
        floats(event.hits);
        await wait(320);
      } else if (event.kind === 'play' && rival) {
        setPlayed(event.card);
        await wait(900);
        setPlayed(null);
      }
      setView(next);
      await wait(rival ? 420 : event.kind === 'turn' ? 300 : 60);
    }
  }

  async function send(action: unknown) {
    if (busy || !battleId) return;
    acted.current = true;
    setBusy(true);
    setSelected(null);
    setZoom(null);
    try {
      const response = await battleMoveAction(battleId, action);
      if ('error' in response) { setNotice({ text: response.error, tone: 'error' }); return; }
      await playFrames(response.frames);
      if (response.reward) { setReward(response.reward); setRings(response.reward.rings); setPaidLeft(response.reward.paidLeft); setMenu(null); }
    } catch {
      setNotice({ text: 'Связь пропала. Попробуйте ещё раз.', tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    acted.current = true;
    setBusy(true);
    try {
      const response = await startBattleAction();
      if ('error' in response) { setNotice({ text: response.error, tone: 'error' }); return; }
      setReward(null);
      setBattleId(response.id);
      setView(response.view);
    } catch {
      setNotice({ text: 'Связь пропала. Попробуйте ещё раз.', tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function craft() {
    setBusy(true);
    try {
      const response = await craftSpinAction();
      if ('error' in response) { setNotice({ text: response.error, tone: 'error' }); return; }
      setRings(response.state.rings);
      setNotice({ text: 'Подарочная крутка собрана', tone: 'success' });
    } catch {
      setNotice({ text: 'Связь пропала. Попробуйте ещё раз.', tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  const toast = <ActionToast message={notice?.text} tone={notice?.tone} trigger={notice ?? NO_NOTICE} />;
  const rules = menu === 'rules' && <GameWindow title="Как играть" onClose={() => setMenu(null)} onBack={view ? () => setMenu('pause') : undefined}><Rules /></GameWindow>;

  if (!view) {
    const deck = home?.deck ?? STARTER_CARDS;
    return <div className="bt-screen" data-no-pull>
      <div className="bt-stage bt-lobby" ref={stage}>
        <header className="bt-lobby-top">
          <Link className="game-round is-back" href="/gacha" aria-label="В Банкомат"><span aria-hidden="true">‹</span></Link>
          <div className="bt-lobby-side">
            {signedIn && <span className="game-chip is-rings" aria-label={`Колечек: ${rings}`}><RingIcon size={18} />{rings}</span>}
            <button type="button" className="game-round" onClick={() => setMenu('rules')} aria-haspopup="dialog" aria-label="Как играть"><span aria-hidden="true">?</span></button>
          </div>
        </header>
        <span className="bt-lobby-rival" aria-hidden="true"><DrinkBird mood="waiting" size={74} /></span>
        <div className="bt-lobby-title">
          <h1>Битва банок</h1>
          <p>{RIVAL} уже за столом</p>
        </div>
        <button type="button" className="bt-lobby-deck" onClick={() => setMenu('deck')} aria-haspopup="dialog" aria-label={`Посмотреть колоду: ${home?.own ?? 0} своих карт из ${DECK_SIZE}`}>
          <span className="bt-hand is-preview" style={{ '--n': Math.min(deck.length, 5) } as CSSProperties}>
            {deck.slice(0, 5).map((card, index) => <span className="bt-card" key={`${card.id}-${index}`} data-rarity={card.rarity ?? undefined} style={fan(index, Math.min(deck.length, 5), 6)}><CardFace card={card} /></span>)}
          </span>
          <span className="bt-lobby-note"><strong>Ваша колода</strong><small>{home ? `Своих карт: ${home.own} из ${DECK_SIZE}` : 'Стартовые банки'} · посмотреть ›</small></span>
        </button>
        {signedIn && <section className="bt-lobby-reward" aria-label="Награда за победу">
          <p><RingIcon size={22} /><b>+{ringsLabel(WIN_RINGS)}</b><small>{paidLeft ? `за победу · сегодня ещё ${paidLeft}` : 'на сегодня награды кончились'}</small></p>
          <span className="bt-lobby-bar" role="img" aria-label={`Колечек ${Math.min(rings, SPIN_RING_COST)} из ${SPIN_RING_COST} до крутки`}>
            <span className="bt-progress-bar"><span style={{ transform: `scaleX(${Math.min(1, rings / SPIN_RING_COST)})` }} /></span>
            <span className="bt-lobby-goal">{Math.min(rings, SPIN_RING_COST)}/{SPIN_RING_COST}<SpinIcon size={18} /></span>
          </span>
          {rings >= SPIN_RING_COST && <GameAction label="Собрать крутку" tone="violet" disabled={busy} onClick={() => void craft()} />}
        </section>}
        {!signedIn ? <Link className="game-btn bt-lobby-go" data-tone="orange" href="/sign-in"><span className="game-btn-face"><span className="game-btn-label">Войти и играть</span></span></Link>
          : home?.blocked ? <p className="bt-lobby-blocked">Аккаунт заблокирован.</p>
          : <button type="button" className="game-btn bt-lobby-go" data-tone="orange" disabled={busy} onClick={() => void start()}><span className="game-btn-face"><span className="game-btn-label">{busy ? 'Ищем бой…' : 'В бой'}</span></span></button>}
        {rules}
        {menu === 'deck' && <GameWindow title="Колода" onClose={() => setMenu(null)}>
          <p className="bt-window-text">Собирается сама: лучшие ваши карты по кривой маны, остальное добирают стартовые банки. Новые карточки из Банкомата усиливают её.</p>
          <div className="bt-deck-grid">{[...deck].sort((a, b) => a.cost - b.cost).map((card, index) => <span className="bt-unit is-still" key={`${card.id}-${index}`} data-rarity={card.rarity ?? undefined}>
            <span className="bt-unit-cover"><Cover card={card} /></span>
            <span className="bt-cost">{card.cost}</span>
            {card.keyword && <KeywordMark keyword={card.keyword} />}
            <Stats attack={card.attack} health={card.health} />
          </span>)}</div>
        </GameWindow>}
      </div>
      {toast}
    </div>;
  }

  const unit = view.me.board.find(item => item.uid === selected) ?? null;
  const targets = unit ? legalTargets(unit, view.rival.board) : [];
  const myTurn = view.active === 'me' && !view.winner && !busy;
  const playable = (card: HandCard) => myTurn && card.cost <= view.me.mana && view.me.board.length < BOARD_SIZE;
  const powerReason = !myTurn ? `Сейчас ходит ${RIVAL}.` : view.me.powerUsed ? 'Удар уже был в этом ходу.' : view.me.mana < HERO_POWER_COST ? `Для удара нужно ${HERO_POWER_COST} маны, у вас ${view.me.mana}.` : null;

  /** Жест до порога — обычное нажатие; дальше указатель ведёт карту, а `click` после него не считается. */
  function follow(event: ReactPointerEvent<HTMLButtonElement>, on: { start: () => void; move: (x: number, y: number) => void; end: (x: number, y: number, speed: number) => void }) {
    const id = event.pointerId, fromX = event.clientX, fromY = event.clientY;
    let started = false, lastY = fromY, lastTime = event.timeStamp, speed = 0;
    const move = (next: PointerEvent) => {
      if (next.pointerId !== id) return;
      if (!started) {
        if (Math.hypot(next.clientX - fromX, next.clientY - fromY) < DRAG_SLOP) return;
        started = true;
        dragged.current = true;
        on.start();
      }
      const spent = next.timeStamp - lastTime;
      if (spent > 0) speed = (lastY - next.clientY) / spent;
      lastY = next.clientY;
      lastTime = next.timeStamp;
      on.move(next.clientX, next.clientY);
    };
    const stop = (last: PointerEvent) => {
      if (last.pointerId !== id) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      if (!started) return;
      if (last.type === 'pointercancel') on.end(fromX, fromY, 0);
      else on.end(last.clientX, last.clientY, last.timeStamp - lastTime > FLICK_WINDOW_MS ? 0 : speed);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  }

  function grabCard(event: ReactPointerEvent<HTMLButtonElement>, card: HandCard) {
    if (!myTurn) return;
    const from = event.currentTarget.getBoundingClientRect();
    const box = stage.current?.getBoundingClientRect();
    if (!box) return;
    const place = (x: number, y: number, scale = 1) => `translate(${x - box.left - from.width / 2}px, ${y - box.top - from.height / 2}px) scale(${scale})`;
    const glide = (transform: string) => {
      const node = flyingNode.current;
      if (!node || reduced()) { setFlying(null); return; }
      node.animate([{ transform: node.style.transform }, { transform }], { duration: 200, easing: 'cubic-bezier(.2, .8, .3, 1)', fill: 'forwards' }).onfinish = () => setFlying(null);
    };
    follow(event, {
      start: () => setFlying({ card, x: from.left - box.left, y: from.top - box.top }),
      move: (x, y) => { if (flyingNode.current) flyingNode.current.style.transform = place(x, y); },
      end: (x, y, speed) => {
        const thrown = releasedOnTable(y, hand.current?.getBoundingClientRect().top ?? Infinity, speed);
        const row = table.current?.getBoundingClientRect();
        if (thrown && playable(card) && row) {
          void send({ kind: 'play', card: card.uid });
          glide(place(row.left + row.width / 2, row.top + row.height / 2, .72));
          return;
        }
        if (thrown) setNotice({ text: view!.me.board.length >= BOARD_SIZE ? 'На столе нет места.' : 'Не хватает маны.', tone: 'error' });
        glide(place(from.left + from.width / 2, from.top + from.height / 2));
      },
    });
  }

  /** Удар жестом: от банки тянется стрелка, цель подсвечивается под пальцем, отпускание бьёт. */
  function grabUnit(event: ReactPointerEvent<HTMLButtonElement>, item: Unit) {
    if (!myTurn || !canAttack(item)) return;
    const allowed = legalTargets(item, view!.rival.board);
    const box = stage.current?.getBoundingClientRect();
    if (!allowed.length || !box) return;
    const from = event.currentTarget.getBoundingClientRect();
    let hover: HTMLElement | null = null;
    let target: string | null = null;
    follow(event, {
      start: () => { setSelected(item.uid); setAiming({ x: from.left - box.left + from.width / 2, y: from.top - box.top + from.height / 2 }); },
      move: (x, y) => {
        for (const [node, axisX, axisY] of [[aimLine.current, 'x2', 'y2'], [aimRing.current, 'cx', 'cy']] as const) {
          node?.setAttribute(axisX, String(x - box.left));
          node?.setAttribute(axisY, String(y - box.top));
        }
        const found = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-bt]') ?? null;
        const id = found?.dataset.bt === 'hero:rival' ? 'hero' : found?.dataset.bt ?? null;
        const next = id && allowed.includes(id) ? found : null;
        if (next !== hover) { hover?.removeAttribute('data-hover'); next?.setAttribute('data-hover', ''); hover = next; }
        target = next ? id : null;
      },
      end: () => {
        hover?.removeAttribute('data-hover');
        setAiming(null);
        setSelected(null);
        if (target) void send({ kind: 'attack', attacker: item.uid, target });
      },
    });
  }

  function tapMine(item: Unit) {
    if (dragged.current) return;
    if (!myTurn || !canAttack(item)) { setZoom({ card: item.card, attack: item.attack, health: item.health, play: null, playable: false }); return; }
    if (!legalTargets(item, view!.rival.board).length) { setNotice({ text: 'Пока некого бить.', tone: 'error' }); return; }
    setSelected(selected === item.uid ? null : item.uid);
  }

  function tapRival(item: Unit) {
    if (dragged.current) return;
    if (unit && targets.includes(item.uid)) void send({ kind: 'attack', attacker: unit.uid, target: item.uid });
    else setZoom({ card: item.card, attack: item.attack, health: item.health, play: null, playable: false });
  }

  // A fresh board for every battle: the fade of a beaten hero is held on its element and must not reach the next fight.
  return <div className="bt-screen" data-no-pull key={battleId}>
    <div className="bt-stage" ref={stage} data-throwing={flying ? '' : undefined} onPointerDownCapture={() => { dragged.current = false; }}>
      <h1 className="sr-only">Битва банок</h1>
      <header className="bt-top">
        <button type="button" className="game-round bt-exit" onClick={() => setMenu('pause')} aria-label="Меню боя"><span aria-hidden="true">≡</span></button>
        <Hero side="rival" label={RIVAL} data={view.rival} target={targets.includes('hero')} face={<DrinkBird mood={view.me.health < view.rival.health ? 'happy' : 'waiting'} size={58} />}
          onTap={unit && targets.includes('hero') ? () => void send({ kind: 'attack', attacker: unit.uid, target: 'hero' }) : undefined} />
        <div className="bt-rival-info">
          <span className="bt-backs" role="img" aria-label={`Карт в руке соперника: ${view.rival.handLeft}`}>{Array.from({ length: view.rival.handLeft }, (_, index) => <i key={index} />)}</span>
          <Mana data={view.rival} />
        </div>
      </header>
      <section className="bt-field" aria-label="Стол">
        <div className="bt-row" aria-label="Банки соперника">{view.rival.board.map(item => <UnitTile key={item.uid} unit={item} ready={false} selected={false} targeted={targets.includes(item.uid)} onTap={() => tapRival(item)} />)}</div>
        <p className="bt-turn" key={view.turn} data-mine={view.active === 'me' || undefined} role="status">{view.active === 'me' ? 'Ваш ход' : `Ходит ${RIVAL}`}</p>
        <div className="bt-row is-mine" ref={table} aria-label="Ваши банки">{view.me.board.map(item => <UnitTile key={item.uid} unit={item} ready={myTurn && canAttack(item)} selected={selected === item.uid} targeted={false} onTap={() => tapMine(item)} onGrab={event => grabUnit(event, item)} />)}</div>
      </section>
      <section className="bt-console" aria-label="Ваш герой">
        <div className="bt-tools">
          <ToolButton tone="power" title="Удар" hint={view.me.powerUsed ? 'уже в этом ходу' : `${HERO_POWER_COST} маны · ${HERO_POWER_DAMAGE} урон`} ready={powerReason === null}
            icon={<svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d={KEYWORD_ICONS.rush} /></svg>}
            label={`Удар героя: ${HERO_POWER_COST} маны, ${HERO_POWER_DAMAGE} урон герою соперника${powerReason ? `. ${powerReason}` : ''}`}
            onClick={() => { if (powerReason) setNotice({ text: powerReason, tone: 'error' }); else void send({ kind: 'power' }); }} />
          {view.me.coin && <ToolButton tone="coin" title="+1 мана" hint="один раз за бой" ready={myTurn} icon="+1" label="Монетка: +1 мана на этот ход, один раз за бой"
            onClick={() => { if (myTurn) void send({ kind: 'coin' }); else setNotice({ text: `Сейчас ходит ${RIVAL}.`, tone: 'error' }); }} />}
        </div>
        <Hero side="me" label="Вы" data={view.me} target={false} face={<AvatarFace />} />
        <div className="bt-side">
          <Mana data={view.me} />
          <button type="button" className="game-btn bt-end" data-tone="orange" disabled={!myTurn} onClick={() => void send({ kind: 'end' })}><span className="game-btn-face"><span className="game-btn-label">Конец хода</span></span></button>
        </div>
      </section>
      <section className="bt-hand" ref={hand} aria-label="Ваша рука" style={{ '--n': view.hand.length } as CSSProperties}>{view.hand.map((card, index) => <HandTile key={card.uid} card={card} index={index} total={view.hand.length} playable={playable(card)} lifted={flying?.card.uid === card.uid}
        onTap={() => { if (!dragged.current) setZoom({ card, attack: card.attack, health: card.health, play: card.uid, playable: playable(card) }); }} onGrab={event => grabCard(event, card)} />)}</section>

      {flying && <div className="bt-flying" ref={flyingNode} style={{ transform: `translate(${flying.x}px, ${flying.y}px)` }} aria-hidden="true"><span className="bt-card" data-rarity={flying.card.rarity ?? undefined} data-playable=""><CardFace card={flying.card} /></span></div>}
      {aiming && <svg className="bt-aim" aria-hidden="true"><line ref={aimLine} x1={aiming.x} y1={aiming.y} x2={aiming.x} y2={aiming.y} /><circle ref={aimRing} cx={aiming.x} cy={aiming.y} r="16" /></svg>}

      {played && <div className="bt-played" aria-live="polite"><ZoomCard card={played} attack={played.attack} health={played.health} /></div>}
      {zoom && <div className="bt-overlay" onClick={() => setZoom(null)}>
        <div className="bt-zoom" onClick={event => event.stopPropagation()}>
          <ZoomCard card={zoom.card} attack={zoom.attack} health={zoom.health} />
          {zoom.play && <GameAction label={zoom.playable ? 'Выставить' : view.me.board.length >= BOARD_SIZE ? 'Стол занят' : 'Не хватает маны'} disabled={!zoom.playable} onClick={() => void send({ kind: 'play', card: zoom.play })} />}
          <button type="button" className="bt-link" onClick={() => setZoom(null)}>Закрыть</button>
        </div>
      </div>}
      {menu === 'pause' && <GameWindow title="Пауза" onClose={() => setMenu(null)}>
        <div className="game-dialog-pity bt-score">
          <div><b>{Math.max(0, view.me.health)}</b><span>вы</span></div>
          <div><b>{Math.ceil(view.turn / 2)}</b><span>ход</span></div>
          <div><b>{Math.max(0, view.rival.health)}</b><span>{RIVAL.toLowerCase()}</span></div>
        </div>
        <GameAction label="Продолжить" onClick={() => setMenu(null)} />
        <nav className="bt-menu" aria-label="Меню боя">
          {/* Запись окна заменяется Банкоматом: «назад» оттуда вернёт в бой, а не на пустую запись. */}
          <Link className="bt-menu-row" href="/gacha" replace onClick={() => { backEntry.current = false; }}><MenuRow icon={MACHINE_ICON} title="В Банкомат" hint="Бой сохранится, вернётесь на этот же ход" /></Link>
          <button type="button" className="bt-menu-row" onClick={() => setMenu('rules')}><MenuRow icon="?" title="Как играть" hint="Правила и свойства карт" /></button>
          <button type="button" className="bt-menu-row" onClick={() => setMenu('surrender')}><MenuRow icon={FLAG_ICON} title="Сдаться" hint="Засчитаем поражение" danger /></button>
        </nav>
      </GameWindow>}
      {rules}
      {menu === 'surrender' && <GameWindow title="Сдаться?" onClose={() => setMenu(null)} onBack={() => setMenu('pause')}>
        <p className="bt-window-text">Бой закончится поражением, колечек за него не будет.</p>
        <GameAction label="Играть дальше" onClick={() => setMenu(null)} />
        <GameAction label={busy ? 'Сдаёмся…' : 'Сдаться'} tone="red" disabled={busy} onClick={() => void send('surrender')} />
      </GameWindow>}
      {reward && <div className="bt-overlay">
        <div className="bt-panel" data-won={reward.won || undefined}>
          <span className="bt-start-bird"><DrinkBird mood={reward.won ? 'sleepy' : 'happy'} size={84} /></span>
          <h2>{reward.won ? 'Победа!' : 'Поражение'}</h2>
          <p>{reward.earned ? <span className="bt-earned"><RingIcon size={20} />+{ringsLabel(reward.earned)}</span> : reward.won ? 'Колечки на сегодня закончились, но победа засчитана.' : 'Колечки дают только за победу.'}</p>
          <Progress rings={rings} />
          {rings >= SPIN_RING_COST && <GameAction label="Собрать крутку" tone="violet" disabled={busy} onClick={() => void craft()} />}
          <GameAction label={busy ? 'Ищем бой…' : 'Ещё бой'} disabled={busy} onClick={() => void start()} />
          <Link className="bt-link" href="/gacha">В Банкомат</Link>
        </div>
      </div>}
    </div>
    {toast}
  </div>;
}

function ZoomCard({ card, attack, health }: { card: BattleCardDef; attack: number; health: number }) {
  return <div className="bt-zoom-card" data-rarity={card.rarity ?? undefined}>
    <span className="bt-cost">{card.cost}</span>
    <span className="bt-zoom-cover"><Cover card={card} /></span>
    <strong>{card.title}</strong>
    <small>{card.name}</small>
    {card.keyword && <p className="bt-zoom-rule"><b>{KEYWORD_INFO[card.keyword].title}.</b> {KEYWORD_INFO[card.keyword].rule}.</p>}
    <Stats attack={attack} health={health} />
  </div>;
}

/** Своя аватарка; без неё остаётся значок, как в шапке сайта. */
function AvatarFace() {
  const [failed, setFailed] = useState(false);
  // An image that failed before hydration never fires onError: check it when the element attaches.
  const watch = useCallback((image: HTMLImageElement | null) => { if (image?.complete && !image.naturalWidth) setFailed(true); }, []);
  // eslint-disable-next-line @next/next/no-img-element -- a redirect to the stored avatar, not an optimizable asset
  return failed ? <span className="bt-plain" aria-hidden="true" /> : <img ref={watch} src="/api/me/avatar" alt="" width={60} height={60} onError={() => setFailed(true)} />;
}
