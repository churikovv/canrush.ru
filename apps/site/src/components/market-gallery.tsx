'use client';
import { useState } from 'react';
import Image from 'next/image';
import { PhotoViewer } from './review-photo-gallery';
export function MarketGallery({ photos, title }: { photos: string[]; title: string }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(0);
  const current = photos[selected];
  if (!current) return null;
  return <div className="market-gallery">
    <button type="button" className="market-gallery-open" onClick={() => setOpen(true)} aria-label="Открыть фотографии объявления"><Image className="market-gallery-main" src={`/api/market-photos/${current}`} alt={`${title}, фото ${selected + 1}`} width={800} height={800} unoptimized priority /></button>
    {photos.length > 1 && <div className="market-gallery-thumbs" aria-label="Фотографии объявления">{photos.map((id, index) => <button key={id} aria-label={`Показать фотографию ${index + 1}`} aria-pressed={index === selected} onClick={() => setSelected(index)}><Image src={`/api/market-photos/${id}?size=thumbnail`} alt="" width={80} height={80} unoptimized /></button>)}</div>}
    {open && <PhotoViewer photos={photos} initialIndex={selected} source="market-photos" onClose={() => setOpen(false)} />}
  </div>;
}
