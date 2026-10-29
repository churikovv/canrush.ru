'use client';
import { useActionState, useEffect, useRef, useState, useTransition, type DragEvent } from 'react';
import { createCompanyPostAction, deleteCompanyPostAction, pinCompanyPresentationAction, type CompanyActionState } from '@/app/company/actions';
import { ContentReportButton } from '@/components/content-report-button';
import { FormAlert } from '@/components/form-alert';
import { MoreActions } from '@/components/more-actions';
import { StaffDeleteMenuItem } from '@/components/staff-delete-button';
import { TrashIcon } from '@/components/action-icons';
import { PhotoDeleteIcon } from '@/components/photo-delete-icon';
import { fileSizeLabel, MAX_PDF_BYTES, MAX_POST_PHOTOS, MAX_POST_TEXT } from '@/lib/business-profile-fields';
import { MAX_REVIEW_PHOTO_BYTES, REVIEW_PHOTO_TYPES } from '@/lib/review-photo-limits';
import { PhotoViewer } from '@/components/review-photo-gallery';

const PIN_ICON = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 17v5M9 3h6l-1 6 4 4H6l4-4-1-6Z" /></svg>;
const PDF_ICON = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></svg>;

/** A file is a PDF by its type or, where the system gives none, by its name; the server checks the content. */
const looksLikePdf = (file: File) => file.type === 'application/pdf' || /\.pdf$/iu.test(file.name);

/**
 * The company's composers (owner and managers), one per tab. `news` («Лента») is the home feed's pill «Что нового?»
 * that opens into a text with up to four photos and folds back after posting or Escape on an empty draft. `deck`
 * («Презентации») is a big PDF drop zone — drag a deck onto it or tap to pick one; it lights up while a file hovers and
 * shows the file once dropped — with an optional caption. The PDF is checked again on the server by its content; here
 * the type and size, so a 40 MB deck or a picture fails before it uploads.
 */
export function CompanyPostForm({ businessId, mode }: { businessId: string; mode: 'news' | 'deck' }) {
  const [open, setOpen] = useState(mode === 'deck');
  const [state, action, pending] = useActionState<CompanyActionState, FormData>(createCompanyPostAction.bind(null, businessId), {});
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [over, setOver] = useState(false);
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  // dragenter and dragleave fire for every child the file passes over: count them, so the zone does not flicker.
  const depth = useRef(0);
  useEffect(() => {
    if (!state.saved) return;
    // A fresh post: clear the composer (React already reset the form's own fields).
    const timer = window.setTimeout(() => { setFile(null); setText(''); setPhotoList([]); if (input.current) input.current.value = ''; if (mode === 'news') setOpen(false); }, 0);
    return () => window.clearTimeout(timer);
  }, [state, mode]);
  // The form sends what the photo input holds: it always mirrors the list shown, previews included.
  function setPhotoList(next: { file: File; url: string }[]) {
    setPhotos(current => { current.filter(item => !next.includes(item)).forEach(item => URL.revokeObjectURL(item.url)); return next; });
    if (photoInput.current) {
      const transfer = new DataTransfer();
      next.forEach(item => transfer.items.add(item.file));
      photoInput.current.files = transfer.files;
    }
  }
  function addPhotos(files: FileList | null) {
    setError('');
    const picked = [...(files ?? [])];
    const bad = picked.find(item => !REVIEW_PHOTO_TYPES.includes(item.type) || item.size > MAX_REVIEW_PHOTO_BYTES);
    if (bad) setError('Фото — JPG, PNG или WebP до 5 МБ.');
    const fresh = picked.filter(item => item !== bad && REVIEW_PHOTO_TYPES.includes(item.type) && item.size <= MAX_REVIEW_PHOTO_BYTES).map(item => ({ file: item, url: URL.createObjectURL(item) }));
    if (photos.length + fresh.length > MAX_POST_PHOTOS) setError(`Не больше ${MAX_POST_PHOTOS} фото в записи.`);
    setPhotoList([...photos, ...fresh].slice(0, MAX_POST_PHOTOS));
  }
  function clear() {
    setFile(null);
    if (input.current) input.current.value = '';
  }
  function pick(next: File | null) {
    setError('');
    if (!next) { clear(); return; }
    if (!looksLikePdf(next)) { setError('Нужен файл PDF. Сохраните презентацию в PDF (в PowerPoint, Keynote или Google Slides: «Файл → Скачать → PDF»).'); clear(); return; }
    if (next.size > MAX_PDF_BYTES) { setError('PDF — до 20 МБ. Сожмите файл или уберите тяжёлые картинки.'); clear(); return; }
    setFile(next);
  }
  function drop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    depth.current = 0;
    setOver(false);
    const dropped = event.dataTransfer.files[0];
    if (!dropped || pending) return;
    // The form sends what its input holds: put the dropped file there.
    if (input.current && looksLikePdf(dropped) && dropped.size <= MAX_PDF_BYTES) {
      const transfer = new DataTransfer();
      transfer.items.add(dropped);
      input.current.files = transfer.files;
    }
    pick(dropped);
  }
  if (!open) return <button type="button" className="wall-composer-pill" onClick={() => { setOpen(true); window.requestAnimationFrame(() => document.getElementById('company-post-text')?.focus()); }}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
    <span>Что нового?</span>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="4" /><circle cx="9" cy="10" r="1.8" /><path d="m4 18 5-5 4 4 3-3 4 4" /></svg>
  </button>;
  const news = mode === 'news';
  if (news) return <form action={action} className="wall-composer" data-collapsible
    onKeyDown={event => { if (event.key === 'Escape' && !text.trim() && !photos.length) setOpen(false); }}>
    <input ref={photoInput} type="file" name="photos" accept={REVIEW_PHOTO_TYPES.join(',')} multiple hidden tabIndex={-1} aria-hidden="true" />
    <fieldset disabled={pending}>
      <label htmlFor="company-post-text" className="sr-only">Новость компании</label>
      <div className="review-text-composer">
        <textarea id="company-post-text" name="text" value={text} onChange={event => setText(event.target.value)} placeholder="Что нового?" maxLength={MAX_POST_TEXT} rows={3} />
        <div className="review-composer-toolbar">
          <span className="review-photo-picker review-photo-icon" title="Добавить фото">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 3-3 6 6"/></svg>
            <input type="file" accept={REVIEW_PHOTO_TYPES.join(',')} multiple aria-label="Добавить фото к новости" disabled={photos.length >= MAX_POST_PHOTOS}
              onChange={event => { addPhotos(event.currentTarget.files); event.currentTarget.value = ''; }} />
          </span>
          <span>{photos.length} / {MAX_POST_PHOTOS} · фото</span>
          <span className="review-composer-count">{text.length} / {MAX_POST_TEXT}</span>
        </div>
      </div>
      {(error || state.error) && <p role="alert" className="field-error">{error || state.error}</p>}
      {photos.length > 0 && <div className="review-photo-previews">{photos.map((item, index) => <div key={item.url} className="review-photo-preview" data-kind="image">
        {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
        <img src={item.url} alt={`Новое фото ${index + 1}: ${item.file.name}`} />
        <button className="photo-delete-overlay" title="Удалить фото" type="button" aria-label={`Удалить фото ${index + 1}`} onClick={() => setPhotoList(photos.filter(other => other !== item))}><PhotoDeleteIcon /></button>
      </div>)}</div>}
      <div className="community-form-footer wall-composer-footer"><button className="community-button review-composer-submit" type="submit" disabled={!text.trim() && !photos.length}>{pending ? 'Отправляем…' : 'Отправить'}</button></div>
    </fieldset>
  </form>;
  return <form className="company-composer" action={action}>
    <input ref={input} id="company-post-file" type="file" name="file" accept="application/pdf,.pdf" className="sr-only" disabled={pending} onChange={event => pick(event.target.files?.[0] ?? null)} />
    {file ? <div className="company-drop is-ready" aria-live="polite">
      <span className="company-drop-done" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg></span>
      <span className="company-drop-file"><strong>{file.name}</strong><small>PDF · {fileSizeLabel(file.size)} · готово к публикации</small></span>
      <span className="company-drop-actions">
        <label className="company-drop-link" htmlFor="company-post-file">Заменить</label>
        <button type="button" className="company-drop-link is-danger" onClick={clear} disabled={pending}>Убрать</button>
      </span>
    </div>
      : <label className="company-drop" htmlFor="company-post-file" data-over={over || undefined}
        onDragEnter={event => { event.preventDefault(); depth.current += 1; setOver(true); }}
        onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }}
        onDragLeave={() => { depth.current = Math.max(0, depth.current - 1); if (!depth.current) setOver(false); }}
        onDrop={drop}>
        <span className="company-drop-art" aria-hidden="true">
          <span className="company-drop-sheet">{PDF_ICON}<b>PDF</b></span>
          <span className="company-drop-arrow"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" /></svg></span>
        </span>
        <strong className="company-drop-title"><span className="is-pointer">{over ? 'Отпускайте — загрузим' : 'Перетащите PDF-презентацию сюда'}</span><span className="is-touch">Нажмите, чтобы выбрать PDF-презентацию</span></strong>
        <span className="company-drop-hint"><span className="is-pointer">или нажмите, чтобы выбрать файл · </span>до 20 МБ · покажем её целиком прямо на странице</span>
      </label>}
    {file && <>
      <label className="sr-only" htmlFor="company-deck-text">Подпись к презентации</label>
      <textarea id="company-deck-text" name="text" rows={2} maxLength={MAX_POST_TEXT} value={text} onChange={event => setText(event.target.value)} placeholder="Пара слов о презентации — необязательно" disabled={pending} />
    </>}
    {(error || state.error) && <FormAlert>{error || state.error}</FormAlert>}
    {file && <button className="community-button company-publish" type="submit" disabled={pending}>{pending ? 'Загружаем презентацию…' : 'Опубликовать презентацию'}</button>}
  </form>;
}

/**
 * A post's «⋯»: the team pins a PDF as the main presentation (its own block on the profile) or deletes the post, others
 * report it, staff delete it as moderators.
 */
export function CompanyPostMenu({ businessId, postId, editor, signedIn, staff, pdf = false, pinned = false }: { businessId: string; postId: string; editor: boolean; signedIn: boolean; staff: boolean; pdf?: boolean; pinned?: boolean }) {
  const [pending, startTransition] = useTransition();
  if (!editor && !signedIn) return null;
  function remove() {
    if (!window.confirm('Удалить запись со стены компании?')) return;
    startTransition(async () => {
      const result = await deleteCompanyPostAction(businessId, postId);
      if (result.error) window.alert(result.error);
    });
  }
  function pin() {
    startTransition(async () => {
      const result = await pinCompanyPresentationAction(businessId, pinned ? null : postId);
      if (result.error) window.alert(result.error);
    });
  }
  return <MoreActions label="Действия с записью">
    {editor && pdf && <button className="more-actions-item" type="button" role="menuitem" disabled={pending} onClick={pin}>{PIN_ICON}<span>{pinned ? 'Открепить из блока «Презентация»' : 'Показать в блоке «Презентация»'}</span></button>}
    {editor ? <button className="more-actions-item is-danger" type="button" role="menuitem" disabled={pending} onClick={remove}><TrashIcon /><span>Удалить</span></button>
      : <>
        <ContentReportButton kind="business-post" id={postId} variant="menuitem" />
        {staff && <StaffDeleteMenuItem kind="business-post" id={postId} />}
      </>}
  </MoreActions>;
}

/** The PDF of a post as a card: opens in the browser's viewer in a new tab. */
export function CompanyFile({ postId, name, size }: { postId: string; name: string; size: number }) {
  return <a className="company-file" href={`/api/business-files/${postId}`} target="_blank" rel="noopener">
    <span className="company-file-icon">{PDF_ICON}</span>
    <span className="company-file-text"><strong>{name}</strong><small>PDF · {fileSizeLabel(size)}</small></span>
    <span className="company-file-open">Открыть</span>
  </a>;
}

/** A post's photos (up to four, laid out by their number); a tap opens the same full-screen viewer as review photos. */
export function CompanyPhotos({ photos }: { photos: string[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return <>
    <div className="company-photos" data-count={Math.min(photos.length, 4)}>{photos.map((id, index) => <button key={id} type="button" className="company-photo" onClick={() => setOpen(index)} aria-label={`Открыть фото ${index + 1} из ${photos.length}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- served from the database */}
      <img src={`/api/business-photos/${id}?thumb`} alt="" loading="lazy" />
    </button>)}</div>
    {open !== null && <PhotoViewer photos={photos} initialIndex={open} source="business-photos" label="Фото компании" onClose={() => setOpen(null)} />}
  </>;
}

/**
 * «Подписаться» / «Вы подписаны»: subscribers get a notification for each new post. Changes at once and goes back if
 * the server refuses; a guest is sent to sign in.
 */
/**
 * The team's PDF upload inside the «Презентация» block of «Лента»: the drop zone shows at once while there is no deck,
 * and behind «Загрузить новую» once there is one, so the open presentation stays first.
 */
export function CompanyDeckUpload({ businessId, hasDeck }: { businessId: string; hasDeck: boolean }) {
  const [open, setOpen] = useState(!hasDeck);
  if (!open) return <button type="button" className="community-button community-button-secondary company-deck-upload" onClick={() => setOpen(true)}>{PDF_ICON}Загрузить новую презентацию</button>;
  return <CompanyPostForm businessId={businessId} mode="deck" />;
}
