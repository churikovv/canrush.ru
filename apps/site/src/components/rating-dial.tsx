'use client';
import { useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import { RatingFace, ratingMood } from '@/components/rating-face';

const MIN = 1, MAX = 10;
/** Pixels of horizontal drag per point. */
const STEP_PX = 36;
const clamp = (value: number) => Math.min(MAX, Math.max(MIN, value));

/**
 * One step of the review wizard: the score in large type with its neighbours right beside it on the baseline, fading
 * out on both sides with dotted separators (3 · 4 · 5 · 6 · 7). Swipe or drag sideways to scroll the numbers, tap a
 * neighbour, or type the number — the centre is a numeric field (`role="spinbutton"`, arrows change it). A change slides
 * the row and grows the new score. The mascot and the mood word sit below.
 */
export function RatingDial({ name, value, question, error, onChange }: { name: 'design' | 'taste'; value: number; question: string; error?: string; onChange: (value: number) => void }) {
  const mood = ratingMood(name, value);
  // What is being typed («1» on the way to «10», or an empty field); any other change drops it.
  const [draft, setDraft] = useState<string | null>(null);
  const drag = useRef<{ x: number; start: number; moved: boolean; id: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const previous = useRef(value);
  const swallowClick = useRef(false);
  const id = `rating-${name}`;

  /** Every change that is not typing drops the half-typed draft. */
  const pick = (next: number) => { setDraft(null); onChange(clamp(next)); };

  // The row slides in from the side the new score came from, the score grows into place.
  useLayoutEffect(() => {
    const from = previous.current;
    previous.current = value;
    if (from === value || !row.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const shift = Math.sign(value - from) * 40;
    row.current.animate([{ transform: `translateX(${shift}px)` }, { transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.2, .8, .2, 1)' });
    input.current?.animate([{ transform: 'scale(.72)', opacity: .5 }, { transform: 'none', opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.34, 1.56, .64, 1)' });
  }, [value]);

  function down(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    drag.current = { x: event.clientX, start: value, moved: false, id: event.pointerId };
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const dx = event.clientX - current.x;
    if (!current.moved && Math.abs(dx) < 8) return;
    if (!current.moved) { current.moved = true; event.currentTarget.setPointerCapture(event.pointerId); input.current?.blur(); }
    // Like a wheel picker: pulling the row left brings the bigger numbers to the centre.
    const next = clamp(current.start - Math.round(dx / STEP_PX));
    if (next !== value) pick(next);
  }
  function up(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    drag.current = null;
    if (!current?.moved) return;
    // A drag that ended over the field or a neighbour must not also focus or pick it; a later tap still does.
    event.preventDefault();
    swallowClick.current = true;
    setTimeout(() => { swallowClick.current = false; });
  }

  return <div className="review-step-rating">
    <label className="review-step-question" htmlFor={id}>{question}</label>
    <div className="rating-dial" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drag.current = null; }}
      onClickCapture={event => { if (swallowClick.current) { swallowClick.current = false; event.preventDefault(); event.stopPropagation(); } }}>
      <div className="rating-dial-row" ref={row}>
        <Neighbour offset={-2} value={value} onPick={pick} />
        <Dots hidden={value - 2 < MIN} />
        <Neighbour offset={-1} value={value} onPick={pick} />
        <Dots hidden={value - 1 < MIN} />
        <input ref={input} id={id} className="rating-dial-value" type="text" inputMode="numeric" autoComplete="off" maxLength={2}
          role="spinbutton" aria-valuemin={MIN} aria-valuemax={MAX} aria-valuenow={value} aria-valuetext={`${value} из 10, ${mood.word}`}
          aria-invalid={Boolean(error)} aria-describedby={[`${id}-hint`, error && `${name}-error`].filter(Boolean).join(' ')}
          value={draft ?? String(value)}
          // Exactly as wide as its digits, so the neighbours stand right beside it.
          style={{ width: `${Math.max(1, (draft ?? String(value)).length)}ch` }}
          onFocus={event => event.currentTarget.select()}
          onBlur={() => setDraft(null)}
          onChange={event => {
            const text = event.currentTarget.value.replace(/\D/g, '').slice(0, 2);
            setDraft(text);
            const number = Number(text);
            if (text && number >= MIN && number <= MAX) onChange(number);
          }}
          onKeyDown={event => {
            const delta = event.key === 'ArrowUp' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowDown' || event.key === 'ArrowLeft' ? -1 : 0;
            if (event.key === 'Home') { event.preventDefault(); pick(MIN); }
            else if (event.key === 'End') { event.preventDefault(); pick(MAX); }
            else if (delta) { event.preventDefault(); pick(value + delta); }
          }} />
        <Dots hidden={value + 1 > MAX} />
        <Neighbour offset={1} value={value} onPick={pick} />
        <Dots hidden={value + 2 > MAX} />
        <Neighbour offset={2} value={value} onPick={pick} />
      </div>
    </div>
    <div className="rating-dial-mood" aria-hidden="true">
      <RatingFace kind={name} value={value} />
      <span><b>{value}</b> из 10 · {mood.word}</span>
    </div>
    <p className="rating-dial-hint" id={`${id}-hint`}>Листайте или введите число</p>
    {error && <p className="field-error" id={`${name}-error`}>{error}</p>}
  </div>;
}

/** Three whole dots between numbers (separate dots, so none is cut in half); none past the end of the scale. */
function Dots({ hidden }: { hidden: boolean }) {
  return hidden ? null : <span className="rating-dial-dots" aria-hidden="true"><i /><i /><i /></span>;
}

/** A faded number beside the score; nothing past the end of the scale, so «10» keeps the row narrow. */
function Neighbour({ offset, value, onPick }: { offset: number; value: number; onPick: (value: number) => void }) {
  const number = value + offset;
  if (number < MIN || number > MAX) return null;
  return <button type="button" tabIndex={-1} aria-hidden="true" className="rating-dial-near" data-far={Math.abs(offset) > 1 || undefined}
    onClick={() => onPick(number)}>{number}</button>;
}
