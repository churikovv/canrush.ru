'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { WallMediaKind } from '@/lib/wall-media-limits';

type View = { scale: number; x: number; y: number };
const INITIAL_VIEW: View = { scale: 1, x: 0, y: 0 };
const MAX_SCALE = 5;

function Icon({ path, size = 22 }: { path: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>;
}
function zoom(view: View, factor: number, anchor = { x: 0, y: 0 }): View {
  const scale = Math.max(1, Math.min(MAX_SCALE, view.scale * factor));
  if (scale === 1) return INITIAL_VIEW;
  const ratio = scale / view.scale;
  return { scale, x: anchor.x - (anchor.x - view.x) * ratio, y: anchor.y - (anchor.y - view.y) * ratio };
}

function PhotoCanvas({ id, label, source, onSwipe }: { id: string; label: string; source: string; onSwipe: (direction: number) => void }) {
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const [view, setView] = useState(INITIAL_VIEW);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const box = element.getBoundingClientRect();
      setView(current => zoom(current, Math.exp(-event.deltaY * 0.002), { x: event.clientX - box.left - box.width / 2, y: event.clientY - box.top - box.height / 2 }));
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, []);
  function move(event: PointerEvent<HTMLDivElement>) {
    const before = [...pointers.current.values()];
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const after = [...pointers.current.values()];
    if (before.length === 2 && after.length === 2) {
      const a = before[0]!, b = before[1]!, c = after[0]!, d = after[1]!;
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (distance < 1) return;
      const box = event.currentTarget.getBoundingClientRect();
      const anchor = { x: (a.x + b.x) / 2 - box.left - box.width / 2, y: (a.y + b.y) / 2 - box.top - box.height / 2 };
      setView(current => {
        const next = zoom(current, Math.hypot(c.x - d.x, c.y - d.y) / distance, anchor);
        return next.scale === 1 ? next : { ...next, x: next.x + (c.x + d.x - a.x - b.x) / 2, y: next.y + (c.y + d.y - a.y - b.y) / 2 };
      });
    } else if (before.length === 1) {
      setView(current => current.scale === 1 ? current : { ...current, x: current.x + event.clientX - previous.x, y: current.y + event.clientY - previous.y });
    }
  }
  return (
    <>
      <div className="review-photo-zoom-controls" role="group" aria-label="Масштаб фотографии">
        <button type="button" aria-label="Уменьшить" disabled={view.scale === 1 || !loaded} onClick={() => setView(current => zoom(current, 1 / 1.5))}><Icon path="M5 12h14" /></button>
        <button type="button" aria-label="Увеличить" disabled={view.scale === MAX_SCALE || !loaded} onClick={() => setView(current => zoom(current, 1.5))}><Icon path="M12 5v14M5 12h14" /></button>
      </div>
      <div className="review-photo-stage" ref={stage}
        onPointerDown={event => { swipe.current = pointers.current.size === 0 && view.scale === 1 ? { x: event.clientX, y: event.clientY } : null; event.currentTarget.setPointerCapture(event.pointerId); pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY }); }}
        onPointerMove={move}
        onPointerUp={event => {
          const start = swipe.current;
          if (start && view.scale === 1 && Math.abs(event.clientX - start.x) > 60 && Math.abs(event.clientX - start.x) > Math.abs(event.clientY - start.y) * 1.5) onSwipe(event.clientX < start.x ? 1 : -1);
          swipe.current = null; pointers.current.delete(event.pointerId);
        }}
        onPointerCancel={event => { swipe.current = null; pointers.current.delete(event.pointerId); }}
        onLostPointerCapture={event => pointers.current.delete(event.pointerId)}
        onDoubleClick={() => setView(current => current.scale > 1 ? INITIAL_VIEW : zoom(current, 2))}>
        {!loaded && !failed ? <span className="review-photo-spinner" role="status" aria-label="Загружаем фотографию" /> : null}
        {failed ? <p className="review-photo-load" role="alert">Не удалось загрузить фотографию. Закройте её и попробуйте снова.</p> : (
          /* eslint-disable-next-line @next/next/no-img-element -- full-size image must remain uncached after moderation */
          <img src={`/api/${source}/${id}`} alt={label} draggable={false} data-loaded={loaded || undefined} onLoad={() => setLoaded(true)} onError={() => setFailed(true)}
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }} />
        )}
      </div>
    </>
  );
}

/** Wall videos play in the viewer with native controls; swipe and zoom stay with photos. */
function VideoCanvas({ id, label, source }: { id: string; label: string; source: string }) {
  return <div className="review-photo-stage review-video-stage">
    <video src={`/api/${source}/${id}`} poster={`/api/${source}/${id}?size=thumbnail`} controls autoPlay playsInline preload="metadata" aria-label={label} />
  </div>;
}

export function PhotoViewer({ photos, kinds, initialIndex, onClose, source }: { photos: string[]; kinds?: WallMediaKind[]; initialIndex: number; onClose: () => void; source: string }) {
  const [index, setIndex] = useState(initialIndex);
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    return () => { element?.close(); document.body.style.overflow = overflow; focused?.focus(); };
  }, []);
  return (
    <dialog ref={dialog} className="review-photo-dialog" aria-label="Просмотр фотографий публикации" onCancel={onClose}
      onKeyDown={event => {
        if (event.key === 'ArrowRight') { event.preventDefault(); setIndex(current => Math.min(photos.length - 1, current + 1)); }
        if (event.key === 'ArrowLeft') { event.preventDefault(); setIndex(current => Math.max(0, current - 1)); }
      }}>
      <div className="review-photo-toolbar">
        {photos.length > 1 ? <span className="review-photo-counter" aria-live="polite" aria-label={`${kinds ? 'Вложение' : 'Фото'} ${index + 1} из ${photos.length}`}>{index + 1} / {photos.length}</span> : <span />}
        <button type="button" className="review-photo-close" ref={closeButton} onClick={onClose} aria-label="Закрыть просмотр"><Icon path="M6 6l12 12M18 6 6 18" /></button>
      </div>
      {kinds?.[index] === 'video'
        ? <VideoCanvas source={source} key={photos[index]} id={photos[index]!} label={`Видео публикации ${index + 1} из ${photos.length}`} />
        : <PhotoCanvas onSwipe={direction => setIndex(current => Math.max(0, Math.min(photos.length - 1, current + direction)))} source={source} key={photos[index]} id={photos[index]!} label={`${kinds?.[index] === 'gif' ? 'GIF' : 'Фотография'} публикации ${index + 1} из ${photos.length}`} />}
      {photos.length > 1 && <>
        <button type="button" className="review-photo-arrow" data-side="prev" disabled={index === 0} onClick={() => setIndex(index - 1)} aria-label="Предыдущее вложение"><Icon path="m15 6-6 6 6 6" size={26} /></button>
        <button type="button" className="review-photo-arrow" data-side="next" disabled={index === photos.length - 1} onClick={() => setIndex(index + 1)} aria-label="Следующее вложение"><Icon path="m9 6 6 6-6 6" size={26} /></button>
        <div className="review-photo-dots" aria-hidden="true">{photos.map((id, dot) => <span key={id} data-active={dot === index || undefined} />)}</div>
      </>}
    </dialog>
  );
}

const KIND_LABEL: Record<WallMediaKind, string> = { image: 'фотографию', gif: 'GIF', video: 'видео' };

export function ReviewPhotoGallery({ photos, kinds, source = 'review-photos' }: { photos: string[]; kinds?: WallMediaKind[]; source?: 'review-photos' | 'wall-photos' }) {
  const [active, setActive] = useState<number | null>(null);
  if (!photos.length) return null;
  return (
    <>
      <div className="review-photo-thumbnails" aria-label="Фотографии публикации">
        {photos.map((id, index) => <button type="button" key={id} data-kind={kinds?.[index]} onClick={() => setActive(index)} aria-label={`Открыть ${KIND_LABEL[kinds?.[index] ?? 'image']} ${index + 1} из ${photos.length}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- thumbnails are served already resized */}
          <img src={`/api/${source}/${id}?size=thumbnail`} alt={`Вложение публикации ${index + 1}`} loading="lazy" />
          {kinds?.[index] === 'gif' && <span className="review-media-badge" aria-hidden="true">GIF</span>}
          {kinds?.[index] === 'video' && <span className="review-media-play" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" /></svg></span>}
        </button>)}
      </div>
      {active !== null ? <PhotoViewer source={source} photos={photos} kinds={kinds} initialIndex={active} onClose={() => setActive(null)} /> : null}
    </>
  );
}
