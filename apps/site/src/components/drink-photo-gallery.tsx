'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PhotoViewer } from '@/components/review-photo-gallery';

/**
 * The top of a drink page when its author added more photos (migration 0153): the cover first, then the extra photos,
 * in a row that snaps — swipe on a phone, arrows on a wide screen, dots under it. A tap on an extra photo opens it full
 * screen in the same viewer as review photos. `photos` — ids served by `/api/catalog-drink-photos/<id>`.
 */
export function DrinkPhotoGallery({ cover, photos, label }: { cover: ReactNode; photos: string[]; label: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const total = photos.length + 1;
  useEffect(() => {
    const row = track.current;
    if (!row) return;
    const onScroll = () => setCurrent(Math.round(row.scrollLeft / Math.max(1, row.clientWidth)));
    row.addEventListener('scroll', onScroll, { passive: true });
    return () => row.removeEventListener('scroll', onScroll);
  }, []);
  const go = (index: number) => {
    const row = track.current;
    if (!row) return;
    row.scrollTo({ left: index * row.clientWidth, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  return <div className="drink-gallery" data-no-pull>
    <div className="drink-gallery-track" ref={track} tabIndex={0} role="group" aria-roledescription="фотографии" aria-label={`${label}: ${total} фото`}
      onKeyDown={event => {
        if (event.key === 'ArrowRight') { event.preventDefault(); go(Math.min(total - 1, current + 1)); }
        if (event.key === 'ArrowLeft') { event.preventDefault(); go(Math.max(0, current - 1)); }
      }}>
      <div className="drink-gallery-slide">{cover}</div>
      {photos.map((id, index) => <button key={id} type="button" className="drink-gallery-slide is-photo" onClick={() => setOpen(index)} aria-label={`Открыть фото ${index + 2} из ${total}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- served from the database */}
        <img src={`/api/catalog-drink-photos/${id}`} alt="" draggable={false} />
      </button>)}
    </div>
    <button type="button" className="drink-gallery-arrow is-prev" aria-label="Предыдущее фото" disabled={current === 0} onClick={() => go(current - 1)}>‹</button>
    <button type="button" className="drink-gallery-arrow is-next" aria-label="Следующее фото" disabled={current >= total - 1} onClick={() => go(current + 1)}>›</button>
    <div className="drink-gallery-dots" aria-hidden="true">{Array.from({ length: total }, (_, index) => <span key={index} data-current={index === current || undefined} />)}</div>
    {open !== null && <PhotoViewer photos={photos} initialIndex={open} source="catalog-drink-photos" label={`Фото: ${label}`} onClose={() => setOpen(null)} />}
  </div>;
}
