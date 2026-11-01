'use client';

import { useEffect, useRef, useState, type PointerEvent, type SyntheticEvent } from 'react';

/** Сколько пикселей пальцем — полный оборот банки. */
const TURN_PX = 420;
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Сцена из Blender на весь экран: петля `<base>-<стадия>.mp4` с постером `.webp`. Новая стадия проявляется поверх старой с той же
 * секунды петли, поэтому предмет превращается на месте, а не сменяется другим роликом. `turnable` — палец крутит сцену перемоткой
 * петли: это работает только там, где петля — полный оборот.
 */
export function TurnScene({ base, stages, seconds, stage, flash, turnable = false }: { base: string; stages: number; seconds: number; stage: number; flash: number; turnable?: boolean }) {
  const [layers, setLayers] = useState([stage]);
  if (layers.at(-1) !== stage) setLayers([layers.at(-1) ?? stage, stage]);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; time: number } | null>(null);
  const top = () => [...(box.current?.querySelectorAll('video') ?? [])].at(-1) ?? null;

  // Постеры всех стадий заранее: выбор уровня в ленте не должен мигать пустым кадром.
  useEffect(() => { for (let index = 1; index <= stages; index += 1) new Image().src = `${base}-${index}.webp`; }, [base, stages]);
  useEffect(() => { if (reducedMotion()) top()?.pause(); }, [layers]);

  function join(event: SyntheticEvent<HTMLVideoElement>) {
    const lower = event.currentTarget.previousElementSibling;
    if (lower instanceof HTMLVideoElement) event.currentTarget.currentTime = lower.currentTime;
  }
  function grab(event: PointerEvent<HTMLDivElement>) {
    const video = top();
    if (!turnable || !video) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    video.pause();
    drag.current = { x: event.clientX, time: video.currentTime };
  }
  function turn(event: PointerEvent<HTMLDivElement>) {
    const video = top();
    if (!drag.current || !video || video.seeking) return;
    // Время идёт — передняя сторона банки едет влево, поэтому палец вправо отматывает петлю назад.
    const time = drag.current.time - ((event.clientX - drag.current.x) / TURN_PX) * seconds;
    video.currentTime = ((time % seconds) + seconds) % seconds;
  }
  function release() {
    if (!drag.current) return;
    drag.current = null;
    if (!reducedMotion()) void top()?.play().catch(() => undefined);
  }

  return <div className="pass-slot" ref={box} data-turnable={turnable || undefined} onPointerDown={grab} onPointerMove={turn} onPointerUp={release} onPointerCancel={release}>
    {layers.map(item => <video key={item} className="pass-video" src={`${base}-${item}.mp4`} poster={`${base}-${item}.webp`} autoPlay loop muted playsInline preload="auto" aria-hidden="true"
      onLoadedMetadata={join} onAnimationEnd={() => setLayers(list => (list.at(-1) === item ? [item] : list))} />)}
    {flash > 0 && <span key={flash} className="pass-flash" aria-hidden="true" />}
  </div>;
}
