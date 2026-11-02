'use client';
import { useActionState, useEffect, useRef, useState, useTransition, type FormEvent } from 'react';
import { addCollectionPhotosAction, deleteCollectionPhotoAction, type CollectionPhotoState } from '@/app/profile/collection-actions';
import { TrashIcon } from '@/components/action-icons';
import { ContentReportButton } from '@/components/content-report-button';
import { FormAlert } from '@/components/form-alert';
import { MoreActions } from '@/components/more-actions';
import { PhotoViewer } from '@/components/review-photo-gallery';
import { StaffDeleteMenuItem } from '@/components/staff-delete-button';
import type { CollectionPhoto } from '@/lib/collection-photos';
import { collectionRoom, MAX_COLLECTION_CAPTION, MAX_COLLECTION_PHOTOS, MAX_COLLECTION_UPLOAD } from '@/lib/collection-photo-fields';
import { surviveNetworkError } from '@/lib/network-safe-action';
import { MAX_REVIEW_PHOTO_BYTES, REVIEW_PHOTO_TYPES } from '@/lib/review-photo-limits';

const CAMERA = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>;
const send = surviveNetworkError(addCollectionPhotosAction);

/**
 * «Фото коллекции»: the member's shelf of cans as a grid; a photo opens in the same full-screen viewer as reviews. The owner
 * adds photos under the grid and deletes them in «⋯»; others report a photo, staff delete it in place.
 */
export function ProfileCollectionPhotos({ photos, own, signedIn, staff }: { photos: CollectionPhoto[]; own: boolean; signedIn: boolean; staff: boolean }) {
  const [active, setActive] = useState<number | null>(null);
  const room = collectionRoom(photos.length);
  return <>
    {photos.length > 0 ? <ul className="collection-photos">{photos.map((photo, index) => <li key={photo.id} className="collection-photo">
      <button type="button" className="collection-photo-open" aria-label={photo.caption ? `Открыть фото «${photo.caption}»` : `Открыть фото ${index + 1} из ${photos.length}`} onClick={() => setActive(index)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- served from the database */}
        <img src={`/api/collection-photos/${photo.id}?thumb`} alt="" loading="lazy" />
      </button>
      {photo.caption && <span className="collection-photo-caption">{photo.caption}</span>}
      {(own || signedIn) && <span className="collection-photo-menu"><CollectionPhotoMenu id={photo.id} own={own} staff={staff} /></span>}
    </li>)}</ul>
      : own && <p className="community-muted">Покажите свою коллекцию банок: полку, лимитки, редкие выпуски. До {MAX_COLLECTION_PHOTOS} фото, подпись — по желанию.</p>}
    {active !== null && <PhotoViewer photos={photos.map(photo => photo.id)} initialIndex={active} source="collection-photos" label="Фото коллекции" onClose={() => setActive(null)} />}
    {own && (room > 0 ? <CollectionPhotoForm room={room} /> : <p className="community-muted">В коллекции {MAX_COLLECTION_PHOTOS} фото — удалите одно, чтобы добавить новое.</p>)}
  </>;
}

/** The owner deletes a photo; others report it, staff delete it as moderators. */
function CollectionPhotoMenu({ id, own, staff }: { id: string; own: boolean; staff: boolean }) {
  const [pending, startTransition] = useTransition();
  function remove() {
    if (!window.confirm('Удалить фото из коллекции?')) return;
    startTransition(async () => {
      const result = await deleteCollectionPhotoAction(id);
      if (result.error) window.alert(result.error);
    });
  }
  return <MoreActions label="Действия с фото">
    {own ? <button className="more-actions-item is-danger" type="button" role="menuitem" disabled={pending} onClick={remove}><TrashIcon /><span>Удалить</span></button>
      : <>
        <ContentReportButton kind="collection-photo" id={id} variant="menuitem" />
        {staff && <StaffDeleteMenuItem kind="collection-photo" id={id} />}
      </>}
  </MoreActions>;
}

interface Picked { id: string; file: File; url: string; caption: string }

/**
 * Picked photos are read into memory at once: on Android a picked file could change or vanish before sending, and the
 * request broke before the server (`ERR_UPLOAD_FILE_CHANGED`). The form is sent by hand, captions in the photos' order.
 */
function CollectionPhotoForm({ room }: { room: number }) {
  const [state, action, pending] = useActionState<CollectionPhotoState, FormData>(send, {});
  const [, startSend] = useTransition();
  const [picked, setPicked] = useState<Picked[]>([]);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const limit = Math.min(room, MAX_COLLECTION_UPLOAD);

  function clear() {
    picked.forEach(item => URL.revokeObjectURL(item.url));
    setPicked([]);
    setError('');
  }
  // A new answer from the server empties the form; the previews' memory goes with it.
  useEffect(() => {
    if (!state.saved) return;
    const timer = window.setTimeout(() => { setPicked(current => { current.forEach(item => URL.revokeObjectURL(item.url)); return []; }); setError(''); }, 0);
    return () => window.clearTimeout(timer);
  }, [state.saved]);

  async function pick(files: FileList | null) {
    setError('');
    const chosen = [...files ?? []];
    if (input.current) input.current.value = '';
    if (chosen.some(file => !REVIEW_PHOTO_TYPES.includes(file.type) || file.size > MAX_REVIEW_PHOTO_BYTES || !file.size)) { setError('Используйте JPG, PNG или WebP до 5 МБ.'); return; }
    const free = limit - picked.length;
    if (chosen.length > free) setError(free > 0 ? `За раз — до ${limit} фото, лишние не добавлены.` : `За раз — до ${limit} фото.`);
    try {
      const added: Picked[] = [];
      for (const file of chosen.slice(0, Math.max(0, free))) {
        const kept = new File([await file.arrayBuffer()], file.name, { type: file.type, lastModified: file.lastModified });
        added.push({ id: crypto.randomUUID(), file: kept, url: URL.createObjectURL(kept), caption: '' });
      }
      setPicked(current => [...current, ...added]);
    } catch { setError('Не удалось прочитать фото. Выберите его ещё раз.'); }
  }
  function drop(id: string) {
    setPicked(current => current.filter(item => { if (item.id === id) URL.revokeObjectURL(item.url); return item.id !== id; }));
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!picked.length) return;
    const form = new FormData();
    for (const item of picked) { form.append('photos', item.file); form.append('caption', item.caption); }
    startSend(() => action(form));
  }

  return <form className="collection-form" onSubmit={submit}>
    <input ref={input} id="collection-photo-input" type="file" accept={REVIEW_PHOTO_TYPES.join(',')} multiple className="sr-only" disabled={pending} onChange={event => void pick(event.target.files)} />
    {picked.length > 0 && <ul className="collection-picked">{picked.map((item, index) => <li key={item.id}>
      {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
      <img src={item.url} alt="" />
      <label className="sr-only" htmlFor={`collection-caption-${item.id}`}>Подпись к фото {index + 1}</label>
      <input id={`collection-caption-${item.id}`} value={item.caption} maxLength={MAX_COLLECTION_CAPTION} disabled={pending} placeholder="Подпись, по желанию"
        onChange={event => { const caption = event.target.value; setPicked(current => current.map(other => other.id === item.id ? { ...other, caption } : other)); }} />
      <button type="button" className="collection-picked-remove" aria-label={`Убрать фото ${index + 1}`} disabled={pending} onClick={() => drop(item.id)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    </li>)}</ul>}
    {(error || state.error) && <FormAlert>{error || state.error}</FormAlert>}
    <div className="collection-form-actions">
      {picked.length > 0 && <button className="community-button" type="submit" disabled={pending}>{pending ? 'Загружаем…' : `Сохранить ${picked.length > 1 ? `${picked.length} фото` : 'фото'}`}</button>}
      {picked.length < limit && <label className={`community-button${picked.length ? ' community-button-secondary' : ''} collection-add`} htmlFor="collection-photo-input" aria-disabled={pending || undefined}>{CAMERA}{picked.length ? 'Ещё фото' : 'Добавить фото'}</label>}
      {picked.length > 0 && <button className="community-button community-button-secondary" type="button" disabled={pending} onClick={clear}>Отмена</button>}
    </div>
  </form>;
}
