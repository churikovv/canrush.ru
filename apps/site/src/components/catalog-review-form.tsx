'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  deleteReviewAction,
  submitReviewAction,
  type ReviewFormState,
} from '@/app/catalog/review-actions';
import type { ReviewData } from '@/lib/reviews';

interface CatalogReviewFormProps {
  brand: string;
  flavor: string;
  existing: ReviewData | null;
  authenticated: boolean;
}

const CRITERIA: Array<{ name: 'design' | 'taste' | 'composition'; label: string }> = [
  { name: 'design', label: 'Дизайн' },
  { name: 'taste', label: 'Вкус' },
  { name: 'composition', label: 'Состав' },
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
        {selected > 0 ? `${selected} из 5` : 'Не оценено'}
      </output>
      <div className="review-star-input">
        {[1, 2, 3, 4, 5].map((star) => {
          const inputId = `${name}-star-${star}`;
          return (
            <span
              key={star}
              className={star <= selected ? 'review-star-option review-star-option-selected' : 'review-star-option'}
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
              <label htmlFor={inputId} aria-label={`${label}: ${star} из 5`}>
                <svg
                  width={26}
                  height={26}
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  aria-hidden="true"
                >
                  <path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.3l6.5-.9z" strokeLinejoin="round" />
                </svg>
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
  const [state, formAction] = useActionState<ReviewFormState, FormData>(submitReviewAction, {});
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const [textLength, setTextLength] = useState(existing?.text.length ?? 0);

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
          defaultValue={existing?.text ?? ''}
          maxLength={1000}
          rows={4}
          placeholder="Что понравилось или не понравилось?"
          aria-invalid={Boolean(state.fieldErrors?.text)}
          aria-describedby={state.fieldErrors?.text ? 'review-text-error' : 'review-text-help'}
          onChange={(event) => setTextLength(event.currentTarget.value.length)}
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
