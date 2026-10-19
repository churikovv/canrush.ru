'use client';
import { useState } from 'react';
import { PhotoViewer } from './review-photo-gallery';

const VISIBLE = 3;

/** Store photos open in the site's own viewer (zoom, swipe, arrows) instead of a new tab. */
export function StoreGallery({ photos, name, layout = 'mosaic' }: { photos: string[]; name: string; layout?: 'mosaic' | 'strip' }) {
  const [active, setActive] = useState<number | null>(null);
  if (!photos.length) return null;
  const shown = layout === 'mosaic' ? photos.slice(0, VISIBLE) : photos;
  const rest = photos.length - shown.length;
  return <>
    <div className={layout === 'mosaic' ? 'store-gallery' : 'store-photo-gallery'} data-count={Math.min(photos.length, VISIBLE)} aria-label={`Фотографии магазина ${name}`}>
      {shown.map((id, index) => {
        const more = index === shown.length - 1 && rest > 0;
        return <button type="button" key={id} onClick={() => setActive(index)} aria-label={more ? `Открыть все фотографии магазина, ещё ${rest}` : `Открыть фото магазина ${index + 1} из ${photos.length}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- store photos are served already resized and must stay uncached */}
          <img src={`/api/store-photos/${id}${layout === 'mosaic' && index === 0 ? '' : '?size=thumbnail'}`} alt={`${name}, фото ${index + 1}`} loading={index === 0 ? 'eager' : 'lazy'} />
          {more && <span className="store-gallery-more" aria-hidden="true">+{rest}</span>}
        </button>;
      })}
    </div>
    {active !== null && <PhotoViewer photos={photos} initialIndex={active} source="store-photos" onClose={() => setActive(null)} />}
  </>;
}
