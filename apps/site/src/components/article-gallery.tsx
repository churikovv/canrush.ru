'use client';
import { useState, type ReactNode } from 'react';
import { PhotoViewer } from '@/components/review-photo-gallery';

/**
 * The article's photo gallery: any element with `data-photo` inside (the cover and every photo block) opens the
 * full-screen viewer of reviews on that photo, with all the article's photos to swipe through. The text stays server
 * rendered; only the click is handled here.
 */
export function ArticleGallery({ photos, children }: { photos: string[]; children: ReactNode }) {
  const [open, setOpen] = useState<number | null>(null);
  return <div className="article-gallery-scope" onClick={event => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-photo]') : null;
    const at = target ? photos.indexOf(target.dataset.photo ?? '') : -1;
    if (at >= 0) { event.preventDefault(); setOpen(at); }
  }}>
    {children}
    {open !== null && <PhotoViewer photos={photos} initialIndex={open} source="article-images" label="Фото статьи" onClose={() => setOpen(null)} />}
  </div>;
}
