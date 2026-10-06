'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ProfileImageCrop, type Crop, type CropSource } from '@/components/profile-image-crop';

interface Photo { id: string; file: File; original: File; src: string; preview: string; width: number; height: number; crop?: Crop }
export function MarketPhotoPicker({ onChange, onBusyChange, disabled = false, crop = true }: { onChange: (files: File[]) => void; onBusyChange?: (busy: boolean) => void; disabled?: boolean; crop?: boolean }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const urls = useRef(new Set<string>());
  const drag = useRef<string | null>(null);
  const adding = useRef(false);
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
    <div className="market-dropzone" onDragOver={event => { event.preventDefault(); }} onDrop={event => { event.preventDefault(); if (!drag.current) void add(Array.from(event.dataTransfer.files)); }}>
      <strong>Фотографии · {photos.length}/5</strong>
      <p>{crop ? 'Первое фото станет обложкой. Перетащите фотографии, чтобы изменить порядок.' : 'Добавьте фотографии к сообщению.'}</p>
      <button type="button" className="community-button community-button-secondary" disabled={disabled || busy || photos.length === 5} onClick={() => input.current?.click()}>{busy ? 'Читаем фото…' : 'Добавить фотографии'}</button>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={event => { void add(Array.from(event.target.files ?? [])); event.target.value = ''; }} />
      <small>Или перетащите сюда. JPG, PNG, WebP, до 5 МБ каждое.</small>
    </div>
    {photos.length > 0 && <ol className="market-photo-previews">{photos.map((photo, index) => <li key={photo.id} draggable={!disabled && !busy} onDragStart={() => { drag.current = photo.id; }} onDragEnd={() => { drag.current = null; }} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); event.stopPropagation(); if (drag.current) move(drag.current, index); drag.current = null; }}>
      <Image src={photo.preview} alt={`Фотография ${index + 1}${index === 0 ? ', обложка' : ''}`} width={160} height={160} unoptimized />
      <div className="market-photo-tools">
        {crop && <button type="button" disabled={disabled || busy} onClick={() => setEditing(photo.id)}>Обрезать</button>}
        <button type="button" aria-label={`Переместить фото ${index + 1} влево`} disabled={disabled || busy || index === 0} onClick={() => move(photo.id, index - 1)}>←</button>
        <button type="button" aria-label={`Переместить фото ${index + 1} вправо`} disabled={disabled || busy || index === photos.length - 1} onClick={() => move(photo.id, index + 1)}>→</button>
        <button type="button" disabled={disabled || busy} onClick={() => { URL.revokeObjectURL(photo.src); urls.current.delete(photo.src); update(photos.filter(item => item.id !== photo.id)); }} aria-label={`Удалить фото ${index + 1}`}>Удалить</button>
      </div>
    </li>)}</ol>}
    {error && <p className="market-error" role="alert">{error}</p>}
    {selected && <ProfileImageCrop key={selected.id} source={{ ...selected, kind: 'market' } satisfies CropSource} initial={selected.crop} onCancel={() => setEditing(null)} onConfirm={(area, preview) => {
      const bytes = Uint8Array.from(atob(preview.split(',')[1] ?? ''), char => char.charCodeAt(0));
      update(photos.map(photo => photo.id === selected.id ? { ...photo, crop: area, preview, file: new File([bytes], 'photo.webp', { type: 'image/webp' }) } : photo)); setEditing(null);
    }} />}
  </div>;
}
