'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef, useState } from 'react';
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
}

const CRITERIA: Array<{ name: 'design' | 'taste'; label: string }> = [
  { name: 'design', label: 'Дизайн' },
  { name: 'taste', label: 'Вкус' },
];

function RatingInput({ name, value, label, error, onChange }: { name: string; value: number; label: string; error?: string; onChange: (value: number) => void }) {
  return <div className="review-criterion">
    <label htmlFor={`rating-${name}`}>{label}</label>
    <div className="review-range-control">
      <output htmlFor={`rating-${name}`} style={{ left: `calc(12px + (100% - 24px) * ${(value - 1) / 9})` }}>{value}</output>
      <input id={`rating-${name}`} type="range" name={name} min={1} max={10} step={1} value={value} onChange={event => onChange(Number(event.target.value))} aria-valuetext={`${value} из 10`} aria-invalid={Boolean(error)} aria-describedby={error ? `${name}-error` : undefined} />
    </div>
    <div className="review-range-scale" aria-hidden="true"><span>1</span><span>10</span></div>
    {error && <p className="field-error" id={`${name}-error`}>{error}</p>}
  </div>;
}

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="primary-button review-submit-button" type="submit" disabled={pending}>
      {pending ? 'Сохраняем…' : editing ? 'Сохранить отзыв' : 'Опубликовать отзыв'}
    </button>
  );
}

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="review-delete-button"
      type="submit"
      formAction={deleteReviewAction}
      formNoValidate
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm('Удалить отзыв? Вернуть его после удаления не получится.')) event.preventDefault();
      }}
    >
      Удалить отзыв
    </button>
  );
}

export function CatalogReviewForm({ brand, flavor, existing, authenticated }: CatalogReviewFormProps) {
  const [editing, setEditing] = useState(!existing);
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
  const textLength = text.length;

  useEffect(() => {
    if (state.status === 'error') errorSummaryRef.current?.focus();
  }, [state]);

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
    <form className="review-form" action={formAction}>
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

      <fieldset className="review-edit-fields" disabled={pending || !editing}>
      <div className="review-criteria">
        {CRITERIA.map(({ name, label }) => (
          <RatingInput
            key={name}
            name={name}
            value={ratings[name]}
            onChange={value => setRatings(current => ({ ...current, [name]: value }))}
            label={label}
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
          id="review-text"
          name="text"
          value={text}
          maxLength={1000}
          rows={4}
          placeholder="Что понравилось или не понравилось?"
          aria-invalid={Boolean(state.fieldErrors?.text)}
          aria-describedby={state.fieldErrors?.text ? 'review-text-error' : 'review-text-help'}
          onChange={(event) => setText(event.currentTarget.value)}
          required
        />
        <div className="review-composer-toolbar">        <span className="review-photo-picker review-photo-icon" title="Добавить фотографии">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 3-3 6 6"/></svg>
          <input id="review-photos" type="file" accept="image/jpeg,image/png,image/webp" multiple aria-label="Добавить фотографии"
            aria-describedby="review-photos-help" disabled={retained.length + files.length >= MAX_REVIEW_PHOTOS}
            onChange={event => { choosePhotos(event.currentTarget.files); event.currentTarget.value = ''; }} />
        </span>
<span>{retained.length + files.length} / 5 фото</span></div>
        </div>
        <p className="field-help" id="review-text-help">
          Без спойлеров о промоакциях и ценах, они быстро меняются.
        </p>
        {state.fieldErrors?.text ? (
          <p className="field-error" id="review-text-error">
            {state.fieldErrors.text}
          </p>
        ) : null}
      </div>

      <div className="review-photo-editor">
        <p id="review-photos-help" className="field-help">До 5 фотографий в формате JPG, PNG или WebP, до 5 МБ каждая.</p>
        {photoError ? <p role="alert" className="field-error">{photoError}</p> : null}
        <div className="review-photo-previews">
          {retained.map((id, index) => <div key={id} className="review-photo-preview">
            {/* eslint-disable-next-line @next/next/no-img-element -- private uncached photo route */}
            <img src={`/api/review-photos/${id}?size=thumbnail`} alt={`Сохранённая фотография ${index + 1}`} />
            <button type="button" onClick={() => setRetained(current => current.filter(value => value !== id))} aria-label={`Удалить сохранённую фотографию ${index + 1}`}>Удалить</button>
          </div>)}
          {files.map(({ file, url }, index) => <div key={url} className="review-photo-preview">
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
            <img src={url} alt={`Новая фотография ${index + 1}: ${file.name}`} />
            <button type="button" onClick={() => { URL.revokeObjectURL(url); previews.current.delete(url); setFiles(current => current.filter(item => item.url !== url)); }} aria-label={`Удалить новую фотографию ${index + 1}`}>Удалить</button>
          </div>)}
        </div>
      </div>
      </fieldset>

      <div className="review-form-actions">
        {editing ? <><SubmitButton editing={hasReview} />{hasReview && <button className="community-button community-button-secondary" type="button" disabled={pending} onClick={() => {
          setText(saved.current.text); setRatings({ design: saved.current.design, taste: saved.current.taste }); setRetained(saved.current.photos);
          previews.current.forEach(url => URL.revokeObjectURL(url)); previews.current.clear(); setFiles([]); setPhotoError(''); setEditing(false);
        }}>Отмена</button>}</> : <button className="primary-button" type="button" onClick={() => setEditing(true)}>Редактировать отзыв</button>}
        {hasReview && editing ? <DeleteButton /> : null}
      </div>
    </form>
  );
}
