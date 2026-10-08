'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { motion, useReducedMotion } from 'motion/react';
import { ProfileImageCrop, type Crop, type CropSource } from '@/components/profile-image-crop';

interface Photo { id: string; file: File; original: File; src: string; preview: string; width: number; height: number; crop?: Crop }
export function MarketPhotoPicker({ onChange, onBusyChange, disabled = false, crop = true, compact = false }: { onChange: (files: File[]) => void; onBusyChange?: (busy: boolean) => void; disabled?: boolean; crop?: boolean; compact?: boolean }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const urls = useRef(new Set<string>());
  const drag = useRef<string | null>(null);
  const adding = useRef(false);
  const reducedMotion = useReducedMotion();
  const [dragging, setDragging] = useState<string | null>(null);
  const grid = useRef<HTMLOListElement>(null);
  useEffect(() => { const allocated = urls.current; return () => { for (const url of allocated) URL.revokeObjectURL(url); }; }, []);
  function update(next: Photo[]) { setPhotos(next); onChange(next.map(photo => photo.file)); }
  async function add(files: File[]) {
    if (disabled || adding.current) return;
    setError('');
    if (photos.length + files.length > 5) { setError('Можно добавить не более 5 фотографий.'); return; }
    adding.current = true; setBusy(true); onBusyChange?.(true);
    const added: Photo[] = [];
    const allocated: string[] = [];
    try {
      for (const file of files) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024 || !file.size) throw new Error('Используйте JPG, PNG или WebP до 5 МБ.');
        const src = URL.createObjectURL(file); urls.current.add(src); allocated.push(src);
        const image = new window.Image(); image.src = src; await image.decode();
        if (image.naturalWidth * image.naturalHeight > 40_000_000) throw new Error('Фотография должна быть не больше 40 мегапикселей.');
        added.push({ id: crypto.randomUUID(), file, original: file, src, preview: src, width: image.naturalWidth, height: image.naturalHeight });
      }
      update([...photos, ...added]);
    } catch (cause) {
      allocated.forEach(url => { URL.revokeObjectURL(url); urls.current.delete(url); });
      setError(cause instanceof Error ? cause.message : 'Не удалось прочитать фото.');
    }
    finally { adding.current = false; setBusy(false); onBusyChange?.(false); }
  }
  function move(id: string, target: number) {
    if (disabled || busy) return;
    const next = [...photos], index = next.findIndex(photo => photo.id === id);
    if (index < 0 || target < 0 || target >= next.length) return;
    const [photo] = next.splice(index, 1); if (photo) next.splice(target, 0, photo); update(next);
  }
  const selected = photos.find(photo => photo.id === editing);
  return <div className="market-photo-picker">
    <div className={`market-dropzone${compact ? ' market-dropzone-compact' : ''}`} onDragOver={event => { event.preventDefault(); }} onDrop={event => { event.preventDefault(); if (!drag.current) void add(Array.from(event.dataTransfer.files)); }}>
      {!compact && <strong>Фотографии · {photos.length}/5</strong>}
      {!compact && <p>{crop ? 'Первое фото станет обложкой. Перетащите фотографии, чтобы изменить порядок.' : 'Добавьте фотографии к сообщению.'}</p>}
      <button type="button" aria-label="Добавить фотографии" title="Добавить фотографии или перетащить сюда — до 5 фото" className="community-button community-button-secondary" disabled={disabled || busy || photos.length === 5} onClick={() => input.current?.click()}>{compact ? <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="m3 17 5-5 4 4 3-3 6 6M15 6v6M12 9h6"/><circle cx="8" cy="8" r="1"/></svg> : busy ? 'Читаем фото…' : 'Добавить фотографии'}</button>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={event => { void add(Array.from(event.target.files ?? [])); event.target.value = ''; }} />
      {!compact && <small>Или перетащите сюда. JPG, PNG, WebP, до 5 МБ каждое.</small>}
    </div>
    {photos.length > 0 && <ol ref={grid} className="market-photo-previews">{photos.map((photo, index) => <motion.li
      key={photo.id}
      layout
      drag={!disabled && !busy}
      dragSnapToOrigin
      dragMomentum={false}
      animate={{ scale: dragging === photo.id && !reducedMotion ? 1.04 : 1 }}
      transition={{ duration: reducedMotion ? 0 : 0.2, ease: 'easeOut' }}
      style={{ zIndex: dragging === photo.id ? 2 : 0 }}
      className={dragging === photo.id ? 'is-dragging' : undefined}
      tabIndex={disabled || busy ? -1 : 0}
      aria-label={`Фотография ${index + 1}${index === 0 ? ', обложка' : ''}. Используйте стрелки для изменения порядка.`}
      onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        const direction = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : 0;
        if (direction) { event.preventDefault(); move(photo.id, index + direction); }
      }}
      onDragStart={() => { drag.current = photo.id; setDragging(photo.id); }}
      onDragEnd={(_event, info) => {
        const list = grid.current;
        if (list) {
          const bounds = list.getBoundingClientRect();
          let closest = index, distance = Infinity;
          Array.from(list.children).forEach((child, position) => {
            const item = child as HTMLElement;
            const x = bounds.left + item.offsetLeft + item.offsetWidth / 2;
            const y = bounds.top + item.offsetTop + item.offsetHeight / 2;
            const nextDistance = Math.hypot(info.point.x - x, info.point.y - y);
            if (nextDistance < distance) { distance = nextDistance; closest = position; }
          });
          move(photo.id, closest);
        }
        drag.current = null; setDragging(null);
      }}
    >
      <Image src={photo.preview} alt={`Фотография ${index + 1}${index === 0 ? ', обложка' : ''}`} width={160} height={160} unoptimized draggable={false} />
      <div className="market-photo-tools" onPointerDown={event => event.stopPropagation()}>
        {crop && <button type="button" disabled={disabled || busy} aria-label={`Обрезать фото ${index + 1}`} title="Обрезать" onClick={() => setEditing(photo.id)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M6 3v13a2 2 0 0 0 2 2h13M3 6h13a2 2 0 0 1 2 2v13"/></svg></button>}
        <button type="button" disabled={disabled || busy} title="Удалить" onClick={() => { URL.revokeObjectURL(photo.src); urls.current.delete(photo.src); update(photos.filter(item => item.id !== photo.id)); }} aria-label={`Удалить фото ${index + 1}`}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg></button>
      </div>
    </motion.li>)}</ol>}
    {error && <p className="market-error" role="alert">{error}</p>}
    {selected && <ProfileImageCrop key={selected.id} source={{ ...selected, kind: 'market' } satisfies CropSource} initial={selected.crop} onCancel={() => setEditing(null)} onConfirm={(area, preview) => {
      const bytes = Uint8Array.from(atob(preview.split(',')[1] ?? ''), char => char.charCodeAt(0));
      update(photos.map(photo => photo.id === selected.id ? { ...photo, crop: area, preview, file: new File([bytes], 'photo.webp', { type: 'image/webp' }) } : photo)); setEditing(null);
    }} />}
  </div>;
}
