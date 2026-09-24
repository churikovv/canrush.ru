'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';

type View = { scale: number; x: number; y: number };
const INITIAL_VIEW: View = { scale: 1, x: 0, y: 0 };
function zoom(view: View, factor: number, anchor = { x: 0, y: 0 }): View {
  const scale = Math.max(1, Math.min(5, view.scale * factor));
  if (scale === 1) return INITIAL_VIEW;
  const ratio = scale / view.scale;
  return { scale, x: anchor.x - (anchor.x - view.x) * ratio, y: anchor.y - (anchor.y - view.y) * ratio };
}

function PhotoCanvas({ id, label }: { id: string; label: string }) {
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
      <div className="review-photo-zoom-controls" aria-label="Масштаб фотографии">
        <button type="button" aria-label="Уменьшить" disabled={view.scale === 1 || !loaded} onClick={() => setView(current => zoom(current, 1 / 1.5))}>−</button>
        <button type="button" aria-label="Сбросить масштаб" onClick={() => setView(INITIAL_VIEW)}>{Math.round(view.scale * 100)}%</button>
        <button type="button" aria-label="Увеличить" disabled={view.scale === 5 || !loaded} onClick={() => setView(current => zoom(current, 1.5))}>+</button>
      </div>
      <div className="review-photo-stage" ref={stage}
        onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY }); }}
        onPointerMove={move}
        onPointerUp={event => pointers.current.delete(event.pointerId)}
        onPointerCancel={event => pointers.current.delete(event.pointerId)}
        onLostPointerCapture={event => pointers.current.delete(event.pointerId)}
        onDoubleClick={() => setView(current => current.scale > 1 ? INITIAL_VIEW : zoom(current, 2))}>
        {!loaded && !failed ? <p className="review-photo-load" role="status">Загружаем фотографию…</p> : null}
        {failed ? <p className="review-photo-load" role="alert">Не удалось загрузить фотографию. Закройте её и попробуйте снова.</p> : (
          /* eslint-disable-next-line @next/next/no-img-element -- full-size image must remain uncached after moderation */
          <img src={`/api/review-photos/${id}`} alt={label} draggable={false} onLoad={() => setLoaded(true)} onError={() => setFailed(true)}
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }} />
        )}
      </div>
    </>
  );
}

function PhotoViewer({ photos, initialIndex, onClose }: { photos: string[]; initialIndex: number; onClose: () => void }) {
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
    <dialog ref={dialog} className="review-photo-dialog" aria-label="Просмотр фотографий отзыва" onCancel={onClose}
      onKeyDown={event => {
        if (event.key === 'ArrowRight') { event.preventDefault(); setIndex(current => Math.min(photos.length - 1, current + 1)); }
        if (event.key === 'ArrowLeft') { event.preventDefault(); setIndex(current => Math.max(0, current - 1)); }
      }}>
      <div className="review-photo-toolbar">
        <span aria-live="polite">Фото {index + 1} из {photos.length}</span>
        <button type="button" ref={closeButton} onClick={onClose} aria-label="Закрыть фотографии">Закрыть ×</button>
      </div>
      <PhotoCanvas key={photos[index]} id={photos[index]!} label={`Фотография отзыва ${index + 1} из ${photos.length}`} />
      <div className="review-photo-navigation">
        <button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)} aria-label="Предыдущая фотография">←</button>
        <p>Увеличивайте двумя пальцами или кнопками. Увеличенное фото можно перемещать.</p>
        <button type="button" disabled={index === photos.length - 1} onClick={() => setIndex(index + 1)} aria-label="Следующая фотография">→</button>
      </div>
    </dialog>
  );
}

export function ReviewPhotoGallery({ photos }: { photos: string[] }) {
  const [active, setActive] = useState<number | null>(null);
  if (!photos.length) return null;
  return (
    <>
      <div className="review-photo-thumbnails" aria-label="Фотографии отзыва">
        {photos.map((id, index) => <button type="button" key={id} onClick={() => setActive(index)} aria-label={`Открыть фотографию ${index + 1} из ${photos.length}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- thumbnails are served already resized */}
          <img src={`/api/review-photos/${id}?size=thumbnail`} alt={`Фотография отзыва ${index + 1}`} loading="lazy" />
        </button>)}
      </div>
      {active !== null ? <PhotoViewer photos={photos} initialIndex={active} onClose={() => setActive(null)} /> : null}
    </>
  );
}
