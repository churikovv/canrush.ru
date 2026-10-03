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

function StarInput({
  name,
  value,
  label,
  error,
}: {
  name: string;
  value: number;
  label: string;
  error?: string;
}) {
  const [selected, setSelected] = useState(value);

  return (
    <fieldset className="review-criterion" aria-describedby={error ? `${name}-error` : `${name}-value`}>
      <legend>{label}</legend>
      <output id={`${name}-value`} aria-live="polite">
        {selected > 0 ? `${selected} из 10` : 'Не оценено'}
      </output>
      <div className="review-star-input">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => {
          const inputId = `${name}-star-${star}`;
          return (
            <span
              key={star}
              className={star === selected ? 'review-star-option review-star-option-selected' : 'review-star-option'}
            >
              <input
                type="radio"
                id={inputId}
                name={name}
                value={star}
                checked={selected === star}
                onChange={() => setSelected(star)}
                required
              />
              <label htmlFor={inputId} aria-label={`${label}: ${star} из 10`}>
                {star}
              </label>
            </span>
          );
        })}
      </div>
      {error ? (
        <p className="field-error" id={`${name}-error`}>
          {error}
        </p>
      ) : null}
    </fieldset>
  );
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

      <fieldset className="review-edit-fields" disabled={pending}>
      <div className="review-criteria">
        {CRITERIA.map(({ name, label }) => (
          <StarInput
            key={name}
            name={name}
            value={existing ? existing[name] : 0}
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
        <label htmlFor="review-photos">Фотографии · {retained.length + files.length} / 5</label>
        <p id="review-photos-help" className="field-help">До 5 фотографий в формате JPG, PNG или WebP, до 5 МБ каждая.</p>
        <span className="review-photo-picker">
          <span aria-hidden="true">{retained.length + files.length >= MAX_REVIEW_PHOTOS ? 'Добавлено 5 фото' : 'Добавить фото'}</span>
          <input id="review-photos" type="file" accept="image/jpeg,image/png,image/webp" multiple aria-label="Добавить фотографии"
            aria-describedby="review-photos-help" disabled={retained.length + files.length >= MAX_REVIEW_PHOTOS}
            onChange={event => { choosePhotos(event.currentTarget.files); event.currentTarget.value = ''; }} />
        </span>
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

      <p className="review-channel-note">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71l-4.14-3.05-1.99 1.94c-.23.23-.42.42-.83.42z" />
        </svg>
        <span>
          Telegram-канал берём из профиля. <Link href="/profile/edit">Настроить канал</Link>
        </span>
      </p>

      <div className="review-form-actions">
        <SubmitButton editing={Boolean(existing)} />
        {existing ? <DeleteButton /> : null}
      </div>
    </form>
  );
}
