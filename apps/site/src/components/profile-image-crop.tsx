'use client';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
export interface Crop { left: number; top: number; width: number; height: number }
export interface CropSource { kind: 'avatar' | 'banner' | 'market'; file: File; src: string; width: number; height: number }
export function ProfileImageCrop({ source, initial, onCancel, onConfirm }: { source: CropSource; initial?: Crop; onCancel: () => void; onConfirm: (crop: Crop, preview: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const ratio = source.kind === 'banner' ? 4 : 1;
  const [zoom, setZoom] = useState(initial ? Math.min(source.width, source.height * ratio) / initial.width : 1);
  const [x, setX] = useState(initial && source.width !== initial.width ? initial.left / (source.width - initial.width) * 100 : 50);
  const [y, setY] = useState(initial && source.height !== initial.height ? initial.top / (source.height - initial.height) * 100 : 50);
  const [ready, setReady] = useState(false);
  const image = useRef<HTMLImageElement | null>(null);
  const drag = useRef<{ x: number; y: number; positionX: number; positionY: number } | null>(null);
  const width = Math.max(1, Math.floor(Math.min(source.width, source.height * ratio) / zoom));
  const height = Math.max(1, Math.floor(width / ratio));
  const crop = { left: Math.round((source.width - width) * x / 100), top: Math.round((source.height - height) * y / 100), width, height };
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const modal = dialog.current;
    modal?.showModal();
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const picture = new window.Image(); picture.src = source.src;
    let disposed = false;
    void picture.decode().then(() => { if (!disposed) { image.current = picture; setReady(true); } });
    return () => { disposed = true; document.body.style.overflow = overflow; modal?.close(); previous?.focus(); };
  }, [source.src]);
  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (ready && context && image.current) {
      context.clearRect(0, 0, 800, 800 / ratio);
      context.drawImage(image.current, crop.left, crop.top, crop.width, crop.height, 0, 0, 800, 800 / ratio);
    }
  }, [ready, crop.left, crop.top, crop.width, crop.height, ratio]);
  function move(event: PointerEvent<HTMLCanvasElement>) {
    if (!drag.current) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const scale = crop.width / bounds.width;
    setX(Math.max(0, Math.min(100, drag.current.positionX - (event.clientX - drag.current.x) * scale / Math.max(1, source.width - width) * 100)));
    setY(Math.max(0, Math.min(100, drag.current.positionY - (event.clientY - drag.current.y) * scale / Math.max(1, source.height - height) * 100)));
  }
  return <dialog ref={dialog} className="profile-crop-dialog" onCancel={event => { event.preventDefault(); onCancel(); }} aria-labelledby="crop-title">
    <h2 id="crop-title">{source.kind === 'market' ? 'Обрезка фотографии' : source.kind === 'avatar' ? 'Миниатюра аватара' : 'Область баннера'}</h2><p>Перетащите фото или настройте положение ползунками.</p>
    <canvas ref={canvas} width={800} height={800 / ratio} className={`profile-crop-preview crop-${source.kind}`} aria-label="Предпросмотр выбранной области" onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, positionX: x, positionY: y }; }} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} />
    <label>Масштаб<input type="range" min="1" max="4" step="0.01" value={zoom} onChange={event => setZoom(Number(event.target.value))} /></label>
    <label>По горизонтали<input type="range" min="0" max="100" value={x} onChange={event => setX(Number(event.target.value))} disabled={width === source.width} /></label>
    <label>По вертикали<input type="range" min="0" max="100" value={y} onChange={event => setY(Number(event.target.value))} disabled={height === source.height} /></label>
    <div className="profile-editor-actions"><button type="button" className="community-button community-button-secondary" onClick={onCancel}>Отмена</button><button type="button" className="community-button" disabled={!ready} onClick={() => { if (canvas.current) onConfirm(crop, canvas.current.toDataURL('image/webp', 0.85)); }}>Применить</button></div>
  </dialog>;
}
