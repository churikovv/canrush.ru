'use client';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { BigCard, type ShownCard } from '@/components/big-card';
import { CanPose, type CanPoseReader } from '@/components/can-volume';
import Link from '@/components/navigation-progress';
import { canSkin, skinTraits } from '@/lib/can-skin';
import { RARITY_LABELS, type Rarity } from '@/lib/gacha-fields';

/** How strongly the card shimmers: it grows with rarity, and a holographic or pearl surface adds to it. */
const SHIMMER: Record<Rarity, number> = { common: .14, rare: .22, epic: .32, legendary: .42 };
const MARK = 'canrushCardInspector';
const marked = () => (window.history.state as Record<string, unknown> | null)?.[MARK] === true;
/** The most a card leans, in degrees, across and along. */
const TILT_X = 14, TILT_Y = 18;
/** How far the resting card sways round its upright axis, and how long a sway takes: `card-sway` in shared.css. */
const SWAY = 7, SWAY_MS = 6000;

/**
 * A card up close, over the whole screen. Dragging it (a finger, the mouse over it, or tilting an Android phone) leans it
 * in 3D, and the glare and the rainbow sheen follow the point: the effects of its look play as on a real foil card.
 * Left alone it sways a little. It lives in the history: the system back closes it, as the reviews sheet.
 */
export function CardInspector({ card, onClose, actions }: { card: ShownCard; onClose: () => void; actions?: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const tilt = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const dragging = useRef(false);
  // A press that started on the card: its click lands on the stage (the stage holds the pointer) and must not close.
  const pressed = useRef(false);
  const sway = useRef<HTMLDivElement>(null);
  const swayAnimation = useRef<Animation | null>(null);
  // The lean the card was last given, for the can drawn round on it.
  const leaning = useRef({ ry: 0, light: .5 });
  const [resting, setResting] = useState(true);
  const skin = canSkin(card.brand, card.flavor);
  const traits = skinTraits(skin, card.rarity);
  const shimmer = SHIMMER[card.rarity] + (skin.light === 'holo' || skin.light === 'iris' ? .14 : 0);

  // The caller passes a new `onClose` on every render; the window opens once and calls the latest.
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });
  useEffect(() => {
    const sheet = dialog.current;
    sheet?.showModal();
    if (!marked()) window.history.pushState({ ...(window.history.state as object | null), [MARK]: true }, '');
    const back = () => { if (!marked()) close.current(); };
    window.addEventListener('popstate', back);
    return () => { window.removeEventListener('popstate', back); sheet?.close(); };
  }, []);

  /** `x`, `y` — the point on the card from 0 to 1; the card leans away from it, the light gathers on it. */
  const lean = useCallback((x: number, y: number) => {
    leaning.current = { ry: (x - .5) * 2 * TILT_Y, light: x };
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const node = tilt.current;
      if (!node) return;
      node.style.setProperty('--rx', `${((.5 - y) * 2 * TILT_X).toFixed(2)}deg`);
      node.style.setProperty('--ry', `${((x - .5) * 2 * TILT_Y).toFixed(2)}deg`);
      node.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
      node.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
    });
  }, []);

  /**
   * The card's turn for the round can (`CanVolume`): its lean plus the sway, read from the sway animation's clock, so the
   * label turns with the card. The sway's ease-in-out halves add up to a cosine.
   */
  const pose = useCallback<CanPoseReader>(() => {
    const node = sway.current;
    if (node && !swayAnimation.current) swayAnimation.current = node.getAnimations().find(animation => (animation as CSSAnimation).animationName === 'card-sway') ?? null;
    const time = Number(swayAnimation.current?.currentTime ?? 0);
    const swayed = swayAnimation.current ? -SWAY * Math.cos(time / SWAY_MS * Math.PI * 2) : 0;
    return { turn: (leaning.current.ry + swayed) / (TILT_Y + SWAY), light: leaning.current.light };
  }, []);

  // An Android phone leans the card as it tilts; iOS asks for a permission first, so there it is the finger only.
  useEffect(() => {
    const Orientation = window.DeviceOrientationEvent as (typeof DeviceOrientationEvent & { requestPermission?: unknown }) | undefined;
    if (!Orientation || typeof Orientation.requestPermission === 'function' || !window.matchMedia('(pointer: coarse)').matches) return;
    let base: number | null = null;
    const turn = (event: DeviceOrientationEvent) => {
      if (dragging.current || event.beta === null || event.gamma === null) return;
      base ??= event.beta;
      lean(.5 + Math.max(-1, Math.min(1, event.gamma / 30)) / 2, .5 + Math.max(-1, Math.min(1, (event.beta - base) / 30)) / 2);
      setResting(false);
    };
    window.addEventListener('deviceorientation', turn);
    return () => window.removeEventListener('deviceorientation', turn);
  }, [lean]);

  /**
   * The point is measured on the stage, which never moves, against the card's own size before any tilt: measured on the
   * tilted card itself, every lean moved the card under the pointer and the next lean answered that — the card shook.
   */
  function point(event: ReactPointerEvent<HTMLDivElement>) {
    const card = tilt.current;
    if (!card) return;
    const box = event.currentTarget.getBoundingClientRect();
    const middleX = box.left + box.width / 2, middleY = box.top + box.height / 2;
    lean(Math.max(0, Math.min(1, .5 + (event.clientX - middleX) / card.offsetWidth)), Math.max(0, Math.min(1, .5 + (event.clientY - middleY) / card.offsetHeight)));
  }
  function rest() {
    dragging.current = false;
    setResting(true);
    lean(.5, .5);
  }
  function dismiss() {
    if (marked()) window.history.back();
    else onClose();
  }

  return <dialog ref={dialog} className="card-inspector" data-rarity={card.rarity} aria-label={`${card.brand}, ${card.name}`} style={{ '--skin-a': skin.a, '--skin-b': skin.b } as CSSProperties}
    onCancel={event => { event.preventDefault(); dismiss(); }} onClick={event => { if (event.target === event.currentTarget) dismiss(); }}>
    <button type="button" className="can-plate card-inspector-close" onClick={dismiss} aria-label="Закрыть"><span aria-hidden="true">×</span></button>
    {/* The stage takes the pointer: a mouse leans the card anywhere over it, a finger drags from the card. */}
    <div className="card-inspector-stage" onClick={event => { if (event.target === event.currentTarget && !pressed.current) dismiss(); pressed.current = false; }}
      onPointerDown={event => { pressed.current = false; if (!tilt.current?.contains(event.target as Node)) return; pressed.current = true; dragging.current = true; setResting(false); event.currentTarget.setPointerCapture(event.pointerId); point(event); }}
      onPointerMove={event => { if (dragging.current || event.pointerType === 'mouse') { setResting(false); point(event); } }}
      onPointerUp={rest} onPointerCancel={rest} onPointerLeave={event => { if (event.pointerType === 'mouse') rest(); }}>
      <div ref={sway} className="card-inspector-sway" data-resting={resting || undefined}>
        <div ref={tilt} className="card-inspector-tilt" data-resting={resting || undefined} style={{ '--shimmer': shimmer } as CSSProperties}>
          <CanPose.Provider value={pose}><BigCard card={card} live /></CanPose.Provider>
          <span className="card-inspector-holo" aria-hidden="true" />
          <span className="card-inspector-glare" aria-hidden="true" />
        </div>
      </div>
    </div>
    <div className="card-inspector-info">
      <span className="card-inspector-kicker" data-rarity={card.rarity}>{RARITY_LABELS[card.rarity]}{(card.count ?? 0) > 1 ? ` · ×${card.count}` : ''}</span>
      <h2>{card.brand} · {card.name}</h2>
      <ul className="card-traits" aria-label="Облик">{traits.map(item => <li key={item.kind} data-rare={item.rare || undefined}><small>{item.kind}</small>{item.name}{item.rare && <b aria-label="редкий"> ✦</b>}</li>)}</ul>
      <div className="card-inspector-actions">
        {actions}
        <Link className="can-btn" href={card.href}>К напитку</Link>
      </div>
    </div>
  </dialog>;
}

/**
 * A small card that opens itself up close: the same markup inside a button, so the card in a list keeps its look and
 * a tap shows it big. The drink page is one tap further, in the big view.
 */
export function InspectableCard({ card, className, title, style, children }: { card: ShownCard; className: string; title?: string; style?: CSSProperties; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className={`${className} inspectable-card`} data-rarity={card.rarity} title={title} style={style} aria-haspopup="dialog" aria-label={`Открыть карточку ${card.brand}, ${card.name}`} onClick={() => setOpen(true)}>{children}</button>
    {open && <CardInspector card={card} onClose={() => setOpen(false)} />}
  </>;
}
