'use client';
import { PhotoDeleteIcon } from '@/components/photo-delete-icon';
import { EditIcon, TrashIcon } from '@/components/action-icons';
import { REVIEW_DELETE_EVENT, REVIEW_EDIT_EVENT } from '@/components/review-edit-shortcut';

import { MIN_REVIEW_LENGTH, normalizeReviewText, reviewTextGuidance } from '@/lib/review-fields';
import Link from '@/components/navigation-progress';
import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import {
  deleteReviewAction,
  submitReviewAction,
  type ReviewFormState,
} from '@/app/catalog/review-actions';
import { MAX_REVIEW_PHOTOS, MAX_REVIEW_PHOTO_BYTES, REVIEW_PHOTO_TYPES } from '@/lib/review-photo-limits';
import type { ReviewData } from '@/lib/reviews';

interface CatalogReviewFormProps {
  brand: string;
  flavor: string;
  existing: ReviewData | null;
  authenticated: boolean;
  /** Profile reviews: open straight into editing and hand control back to the card when done. */
  initiallyEditing?: boolean;
  onClose?: () => void;
}

const CRITERIA: Array<{ name: 'design' | 'taste'; label: string }> = [
  { name: 'design', label: 'Дизайн' },
  { name: 'taste', label: 'Вкус' },
];

function RatingInput({ name, value, label, error, disabled, onChange }: { name: string; value: number; label: string; error?: string; disabled: boolean; onChange: (value: number) => void }) {
  return <div className="review-criterion">
    <label htmlFor={`rating-${name}`}>{label}</label>
    <div className="review-range-control">
      <output htmlFor={`rating-${name}`} style={{ left: `calc(12px + (100% - 24px) * ${(value - 1) / 9})` }}>{value}</output>
      <input id={`rating-${name}`} type="range" name={name} disabled={disabled} min={1} max={10} step={1} value={value} onChange={event => onChange(Number(event.target.value))} aria-valuetext={`${value} из 10`} aria-invalid={Boolean(error)} aria-describedby={error ? `${name}-error` : undefined} />
    </div>
    <div className="review-range-scale" aria-hidden="true">{Array.from({ length: 10 }, (_, index) => <span key={index} style={{ left: `${index / 9 * 100}%` }}>{index + 1}</span>)}</div>
    {error && <p className="field-error" id={`${name}-error`}>{error}</p>}
  </div>;
}

function SubmitButton({ editing, tooShort }: { editing: boolean; tooShort: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="primary-button review-submit-button" type="submit" disabled={pending || tooShort}>
      {pending ? 'Сохраняем…' : editing ? 'Сохранить отзыв' : 'Опубликовать отзыв'}
    </button>
  );
}

export function CatalogReviewForm({ brand, flavor, existing, authenticated, initiallyEditing = false, onClose }: CatalogReviewFormProps) {
  const [editing, setEditing] = useState(initiallyEditing || !existing);
  const [hasReview, setHasReview] = useState(Boolean(existing));
  const [ratings, setRatings] = useState({ design: existing?.design ?? 5, taste: existing?.taste ?? 5 });
  const saved = useRef({ text: existing?.text ?? '', design: existing?.design ?? 5, taste: existing?.taste ?? 5, photos: existing?.photos ?? [] });
  const [files, setFiles] = useState<Array<{ file: File; url: string }>>([]);
  const [retained, setRetained] = useState(existing?.photos ?? []);
  const [photoError, setPhotoError] = useState('');
  const previews = useRef(new Set<string>());
  const [text, setText] = useState(existing?.text ?? '');
  const [state, formAction, pending] = useActionState<ReviewFormState, FormData>(async (previous, data) => {
    files.forEach(({ file }) => data.append('photos', file));
    retained.forEach(id => data.append('retainedPhoto', id));
    try {
      const result = await submitReviewAction(previous, data);
      if (result.status === 'success') {
        previews.current.forEach(url => URL.revokeObjectURL(url));
        previews.current.clear();
        setFiles([]);
        setRetained(result.photos ?? []);
        setPhotoError('');
        saved.current = { text: String(data.get('text') ?? ''), design: Number(data.get('design')), taste: Number(data.get('taste')), photos: result.photos ?? [] };
        setHasReview(true);
        setEditing(false);
        onClose?.();
      }
      return result;
    } catch {
      return { status: 'error', message: 'Не удалось отправить отзыв. Проверьте соединение и попробуйте ещё раз.' };
    }
  }, {});
  useEffect(() => {
    const urls = previews.current;
    return () => { urls.forEach(url => URL.revokeObjectURL(url)); };
  }, []);
  function choosePhotos(selected: FileList | null) {
    const added = Array.from(selected ?? []);
    if (added.length + files.length + retained.length > MAX_REVIEW_PHOTOS) { setPhotoError('Можно добавить не более 5 фотографий.'); return; }
    if (added.some(file => file.size > MAX_REVIEW_PHOTO_BYTES || !REVIEW_PHOTO_TYPES.includes(file.type))) { setPhotoError('Выберите JPG, PNG или WebP не больше 5 МБ каждый.'); return; }
    setPhotoError('');
    setFiles(current => [...current, ...added.map(file => {
      const url = URL.createObjectURL(file);
      previews.current.add(url);
      return { file, url };
    })]);
  }
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const photoCount = retained.length + files.length;
  const [deleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState('');
  const busy = pending || deleting;

  function clearPreviews() {
    previews.current.forEach(url => URL.revokeObjectURL(url));
    previews.current.clear();
    setFiles([]);
    setPhotoError('');
  }

  const focusText = useRef(initiallyEditing);
  function startEditing() {
    focusText.current = true;
    setEditing(true);
  }
  // The edit icon unmounts once editing starts, so focus moves to the text after the commit.
  useEffect(() => {
    if (!editing || !focusText.current) return;
    focusText.current = false;
    textRef.current?.focus({ preventScroll: true });
  }, [editing]);

  function removeReview() {
    if (busy || !window.confirm('Удалить отзыв? Вернуть его после удаления не получится.')) return;
    const data = new FormData();
    data.set('brand', brand);
    data.set('flavor', flavor);
    setDeleteError('');
    startDelete(async () => {
      try {
        await deleteReviewAction(data);
        clearPreviews();
        saved.current = { text: '', design: 5, taste: 5, photos: [] };
        setText(''); setRatings({ design: 5, taste: 5 }); setRetained([]);
        setHasReview(false); setEditing(true);
        onClose?.();
      } catch {
        setDeleteError('Не удалось удалить отзыв. Проверьте соединение и попробуйте ещё раз.');
      }
    });
  }
  const remove = useRef(removeReview);
  useEffect(() => { remove.current = removeReview; });
  const textLength = text.length;
  const guidance = reviewTextGuidance(text);

  useEffect(() => {
    if (state.status === 'error') errorSummaryRef.current?.focus();
  }, [state]);

  // The edit icon on the author's own published review card opens this form.
  useEffect(() => {
    // Only the single form on a product page answers the card shortcut; profile forms are opened by their own card.
    if (!hasReview || onClose) return;
    const open = () => {
      startEditing();
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      formRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    };
    const del = () => remove.current();
    window.addEventListener(REVIEW_EDIT_EVENT, open);
    window.addEventListener(REVIEW_DELETE_EVENT, del);
    return () => {
      window.removeEventListener(REVIEW_EDIT_EVENT, open);
      window.removeEventListener(REVIEW_DELETE_EVENT, del);
    };
  }, [hasReview, onClose]);

  if (!authenticated) {
    return (
      <div className="review-signin-prompt">
        <p>Войдите, чтобы сохранить оценки и опубликовать отзыв от своего имени.</p>
        <Link className="primary-link review-signin-link" href="/sign-in">
          Войти и оценить
        </Link>
      </div>
    );
  }

  return (
    <form className="review-form" id="review-form" ref={formRef} action={formAction}>
      <input type="hidden" name="ratingScale" value="10" />
      <input type="hidden" name="brand" value={brand} />
      <input type="hidden" name="flavor" value={flavor} />

      {state.message ? (
        <div
          className={`review-form-feedback review-form-feedback-${state.status ?? 'error'}`}
          ref={state.status === 'error' ? errorSummaryRef : undefined}
          role={state.status === 'error' ? 'alert' : 'status'}
          tabIndex={state.status === 'error' ? -1 : undefined}
        >
          {state.message}
        </div>
      ) : null}

      {deleteError ? <div className="review-form-feedback review-form-feedback-error" role="alert">{deleteError}</div> : null}

      {/* Locked rather than disabled while viewing, so the edit/delete icons inside the composer stay usable. */}
      <fieldset className="review-edit-fields" disabled={busy} data-locked={editing ? undefined : ''}>
      <div className="review-criteria">
        {CRITERIA.map(({ name, label }) => (
          <RatingInput
            key={name}
            name={name}
            value={ratings[name]}
            onChange={value => setRatings(current => ({ ...current, [name]: value }))}
            label={label}
            disabled={!editing}
            error={state.fieldErrors?.[name]}
          />
        ))}
      </div>

      <div className="review-text-field">
        <div className="review-text-heading">
          <label htmlFor="review-text">Ваш отзыв</label>
          <span aria-live="polite">{textLength} / 1000</span>
        </div>
        <div className="review-text-composer">
        <textarea
          ref={textRef}
          id="review-text"
          name="text"
          value={text}
          maxLength={1000}
          rows={4}
          placeholder="Что понравилось или не понравилось?"
          aria-invalid={Boolean(state.fieldErrors?.text)}
          aria-describedby={[editing && 'review-text-help', state.fieldErrors?.text && 'review-text-error'].filter(Boolean).join(' ') || undefined}
          readOnly={!editing}
          onChange={(event) => setText(event.currentTarget.value)}
          required
        />
        <div className="review-composer-toolbar">
          {editing ? <>
            <span className="review-photo-picker review-photo-icon" title="Добавить фотографии">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 3-3 6 6"/></svg>
              <input id="review-photos" type="file" accept="image/jpeg,image/png,image/webp" multiple aria-label="Добавить фотографии"
                aria-describedby="review-photos-count" disabled={photoCount >= MAX_REVIEW_PHOTOS}
                onChange={event => { choosePhotos(event.currentTarget.files); event.currentTarget.value = ''; }} />
            </span>
            <span id="review-photos-count" aria-label={`Фотографий: ${photoCount} из ${MAX_REVIEW_PHOTOS}`}>{photoCount} / {MAX_REVIEW_PHOTOS}</span>
          </> : null}
          {hasReview ? <span className="review-composer-actions">
            {!editing && <button className="review-composer-action" type="button" aria-label="Редактировать отзыв" title="Редактировать отзыв" onClick={startEditing}><EditIcon size={20} /></button>}
            {/* The profile reviews page already has a delete button beside the product. */}
            {!onClose && <button className="review-composer-action review-composer-delete" type="button" aria-label="Удалить отзыв" title="Удалить отзыв" onClick={removeReview}><TrashIcon size={20} /></button>}
          </span> : null}
        </div>
        </div>
        {editing ? <p className={`field-help review-text-guidance review-text-guidance-${guidance.level}`} id="review-text-help" role="status" aria-live="polite">
          {guidance.message}
        </p> : null}
        {state.fieldErrors?.text ? (
          <p className="field-error" id="review-text-error">
            {state.fieldErrors.text}
          </p>
        ) : null}
      </div>

      <div className="review-photo-editor">
        {photoError ? <p role="alert" className="field-error">{photoError}</p> : null}
        <div className="review-photo-previews">
          {retained.map((id, index) => <div key={id} className="review-photo-preview">
            {/* eslint-disable-next-line @next/next/no-img-element -- private uncached photo route */}
            <img src={`/api/review-photos/${id}?size=thumbnail`} alt={`Сохранённая фотография ${index + 1}`} />
            <button className="photo-delete-overlay" title="Удалить фотографию" type="button" hidden={!editing} onClick={() => setRetained(current => current.filter(value => value !== id))} aria-label={`Удалить сохранённую фотографию ${index + 1}`}><PhotoDeleteIcon /></button>
          </div>)}
          {files.map(({ file, url }, index) => <div key={url} className="review-photo-preview">
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
            <img src={url} alt={`Новая фотография ${index + 1}: ${file.name}`} />
            <button className="photo-delete-overlay" title="Удалить фотографию" type="button" onClick={() => { URL.revokeObjectURL(url); previews.current.delete(url); setFiles(current => current.filter(item => item.url !== url)); }} aria-label={`Удалить новую фотографию ${index + 1}`}><PhotoDeleteIcon /></button>
          </div>)}
        </div>
      </div>
      </fieldset>

      {editing ? <div className="review-form-actions">
        <SubmitButton editing={hasReview} tooShort={normalizeReviewText(text).length < MIN_REVIEW_LENGTH} />
        {hasReview && <button className="community-button community-button-secondary" type="button" disabled={busy} onClick={() => {
          setText(saved.current.text); setRatings({ design: saved.current.design, taste: saved.current.taste }); setRetained(saved.current.photos);
          clearPreviews(); setEditing(false); onClose?.();
        }}>Отмена</button>}
      </div> : null}
    </form>
  );
}
