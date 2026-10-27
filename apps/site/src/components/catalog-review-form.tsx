'use client';
import { pastedFiles, toFileList } from '@/lib/clipboard-files';
import { PhotoDeleteIcon } from '@/components/photo-delete-icon';
import { EditIcon, TrashIcon } from '@/components/action-icons';
import { REVIEW_DELETE_EVENT, REVIEW_EDIT_EVENT } from '@/components/review-edit-shortcut';

import { DETAILED_REVIEW_LENGTH, GOOD_REVIEW_LENGTH, MIN_REVIEW_LENGTH, normalizeReviewText, reviewTextGuidance } from '@/lib/review-fields';
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
import { RatingFace, ratingMood } from '@/components/rating-face';
import { CountryInput } from '@/components/country-input';
import { RatingDial } from '@/components/rating-dial';
import { FormOptional } from '@/components/form-step';

interface CatalogReviewFormProps {
  brand: string;
  flavor: string;
  existing: ReviewData | null;
  authenticated: boolean;
  /** Profile reviews: open straight into editing and hand control back to the card when done. */
  initiallyEditing?: boolean;
  onClose?: () => void;
  /** The product page's panel: told after a save, a cancel or a delete (with whether a review exists now) to fold back. */
  onSettled?: (hasReview: boolean) => void;
  /** The product page: writing goes step by step — taste, design, then country, text and photos. */
  stepped?: boolean;
}

const CRITERIA: Array<{ name: 'design' | 'taste'; label: string }> = [
  { name: 'design', label: 'Дизайн' },
  { name: 'taste', label: 'Вкус' },
];

function RatingInput({ name, value, label, error, disabled, onChange }: { name: 'design' | 'taste'; value: number; label: string; error?: string; disabled: boolean; onChange: (value: number) => void }) {
  return <div className="review-criterion">
    <label htmlFor={`rating-${name}`}>{label}</label>
    <div className="review-range-row">
      <div className="review-range-main">
        <div className="review-range-control">
          <output htmlFor={`rating-${name}`} style={{ left: `calc(12px + (100% - 24px) * ${(value - 1) / 9})` }}>{value}</output>
          <input id={`rating-${name}`} type="range" name={name} disabled={disabled} min={1} max={10} step={1} value={value} onChange={event => onChange(Number(event.target.value))} aria-valuetext={`${value} из 10, ${ratingMood(name, value).word}`} aria-invalid={Boolean(error)} aria-describedby={error ? `${name}-error` : undefined} />
        </div>
        <div className="review-range-scale" aria-hidden="true">{Array.from({ length: 10 }, (_, index) => <span key={index} style={{ left: `${index / 9 * 100}%` }}>{index + 1}</span>)}</div>
      </div>
      <RatingFace kind={name} value={value} />
    </div>
    {error && <p className="field-error" id={`${name}-error`}>{error}</p>}
  </div>;
}

/** The wizard's order: taste first, the reason people open the page, then the can. */
const STEPS: Array<{ name: 'design' | 'taste'; label: string; question: string }> = [
  { name: 'taste', label: 'Вкус', question: 'Как вам вкус?' },
  { name: 'design', label: 'Дизайн', question: 'А дизайн банки?' },
];

/** «Страна производства»: optional, the country printed on the can («Изготовлено в…»). */
function CountryField({ value, error, disabled, onChange }: { value: string; error?: string; disabled: boolean; onChange: (value: string) => void }) {
  const note = error ? 'review-country-error' : 'review-country-help';
  return <div className="review-country-field">
    <label htmlFor="review-country">Страна производства <FormOptional /></label>
    <CountryInput value={value} onChange={onChange} disabled={disabled} invalid={Boolean(error)} describedBy={note} />
    {error ? <p className="field-error" id={note}>{error}</p> : <p className="review-hint-card" id={note}>
      <span className="review-meter-icon" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5s-1.1 6.1-3.4 8.5M12 3.5C9.7 5.9 8.6 8.7 8.6 12s1.1 6.1 3.4 8.5" /></svg>
      </span>
      <span>Посмотрите на банке строку «Изготовлено в…» — один и тот же энергетик из разных стран бывает разным на вкус.</span>
    </p>}
  </div>;
}

const METER_ICONS = {
  short: <path d="M4.5 19.5h4l10-10-4-4-10 10zM13 7l4 4" />,
  enough: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  good: <path d="m3.5 17 6-6 4 4 7-7M15 8h5.5v5.5" />,
  detailed: <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />,
};

/**
 * Under the review text: a bar to a detailed review with ticks at the publishable and good lengths, an icon, a counting title
 * and a quiet hint. Only the level change is announced, not every keystroke.
 */
function ReviewTextMeter({ guidance }: { guidance: ReturnType<typeof reviewTextGuidance> }) {
  return <div className="review-meter" data-level={guidance.level} id="review-text-help">
    <span className="review-meter-icon" aria-hidden="true">
      <svg key={guidance.level} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{METER_ICONS[guidance.level]}</svg>
    </span>
    <p aria-hidden="true"><b>{guidance.title}</b><span>{guidance.hint}</span></p>
    <div className="review-meter-bar" aria-hidden="true">
      <span style={{ width: `${guidance.progress * 100}%` }} />
      {[MIN_REVIEW_LENGTH, GOOD_REVIEW_LENGTH].map(at => <i key={at} style={{ left: `${at / DETAILED_REVIEW_LENGTH * 100}%` }} />)}
    </div>
    <span className="sr-only" role="status">{guidance.status}</span>
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

export function CatalogReviewForm({ brand, flavor, existing, authenticated, initiallyEditing = false, onClose, onSettled, stepped = false }: CatalogReviewFormProps) {
  const [step, setStep] = useState(0);
  const [editing, setEditing] = useState(initiallyEditing || !existing);
  const [hasReview, setHasReview] = useState(Boolean(existing));
  const [ratings, setRatings] = useState({ design: existing?.design ?? 5, taste: existing?.taste ?? 5 });
  const [country, setCountry] = useState(existing?.country ?? '');
  const saved = useRef({ text: existing?.text ?? '', design: existing?.design ?? 5, taste: existing?.taste ?? 5, country: existing?.country ?? '', photos: existing?.photos ?? [] });
  const [files, setFiles] = useState<Array<{ file: File; url: string }>>([]);
  const [retained, setRetained] = useState(existing?.photos ?? []);
  const [photoError, setPhotoError] = useState('');
  const previews = useRef(new Set<string>());
  const [text, setText] = useState(existing?.text ?? '');
  const [state, formAction, pending] = useActionState<ReviewFormState, FormData>(async (previous, data) => {
    // React resets the form after each action; the controls show state, so a resend after an error takes it from there.
    data.set('design', String(ratings.design)); data.set('taste', String(ratings.taste)); data.set('country', country);
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
        saved.current = { text: String(data.get('text') ?? ''), design: Number(data.get('design')), taste: Number(data.get('taste')), country: String(data.get('country') ?? ''), photos: result.photos ?? [] };
        setHasReview(true);
        setEditing(false);
        setStep(0);
        onClose?.();
        onSettled?.(true);
      }
      // A rejected score sends the wizard back to its step.
      if (result.fieldErrors?.taste) setStep(0); else if (result.fieldErrors?.design) setStep(1);
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
    if (stepped) document.getElementById(`rating-${STEPS[0]!.name}`)?.focus({ preventScroll: true });
    else textRef.current?.focus({ preventScroll: true });
  }, [editing, stepped]);

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
        saved.current = { text: '', design: 5, taste: 5, country: '', photos: [] };
        setText(''); setRatings({ design: 5, taste: 5 }); setCountry(''); setRetained([]);
        setHasReview(false); setEditing(true); setStep(0);
        onClose?.();
        onSettled?.(false);
      } catch {
        setDeleteError('Не удалось удалить отзыв. Проверьте соединение и попробуйте ещё раз.');
      }
    });
  }
  const remove = useRef(removeReview);
  useEffect(() => { remove.current = removeReview; });
  const textLength = text.length;
  const wizard = stepped && editing;
  const guidance = reviewTextGuidance(text);

  useEffect(() => {
    if (state.status === 'error') errorSummaryRef.current?.focus();
  }, [state]);
  // Moving between steps keeps the keyboard on the new step's control (not on the first render).
  const stepMoved = useRef(false);
  useEffect(() => {
    if (!stepMoved.current) return;
    stepMoved.current = false;
    if (step < STEPS.length) document.getElementById(`rating-${STEPS[step]!.name}`)?.focus({ preventScroll: true });
    else textRef.current?.focus({ preventScroll: true });
    formRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
  }, [step]);
  const goTo = (next: number) => { stepMoved.current = true; setStep(next); };

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
    <form className="review-form" id="review-form" ref={formRef} action={formAction}
      // A screenshot or copied photo pasted anywhere in the form joins the review photos.
      onPaste={event => { const files = pastedFiles(event, file => file.type.startsWith('image/')); if (files.length) choosePhotos(toFileList(files)); }}>
      <input type="hidden" name="ratingScale" value="10" />
      <input type="hidden" name="brand" value={brand} />
      <input type="hidden" name="flavor" value={flavor} />

      {/* The wizard folds away on success, so a kept «saved» note would greet the next edit. */}
      {state.message && !(wizard && state.status === 'success') ? (
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

      {wizard ? <div className="review-steps">
        <button className="review-steps-back" type="button" disabled={busy || step === 0} onClick={() => goTo(step - 1)} aria-label="Назад к прошлому шагу">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <ol className="review-steps-list">
          {/* Editing a saved review: every step is open at once, so a text fix skips the scores. */}
          {[...STEPS.map(item => `${item.label}${hasReview || step > STEPS.indexOf(item) ? ` ${ratings[item.name]}` : ''}`), 'Отзыв'].map((label, index) =>
            <li key={index} aria-current={index === step ? 'step' : undefined} data-done={index < step || undefined}>
              {index !== step && (hasReview || index < step) ? <button type="button" disabled={busy} onClick={() => goTo(index)}>{label}</button> : <span>{label}</span>}
            </li>)}
        </ol>
      </div> : null}

      {/* Locked rather than disabled while viewing, so the edit/delete icons inside the composer stay usable. */}
      <fieldset className="review-edit-fields" disabled={busy} data-locked={editing ? undefined : ''}>
      {wizard && step < STEPS.length ? <RatingDial key={STEPS[step]!.name} name={STEPS[step]!.name} question={STEPS[step]!.question}
        value={ratings[STEPS[step]!.name]} error={state.fieldErrors?.[STEPS[step]!.name]}
        onChange={value => setRatings(current => ({ ...current, [STEPS[step]!.name]: value }))} /> : null}
      {wizard && step < STEPS.length ? null : <>
      {wizard ? null : <div className="review-criteria">
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
      </div>}

      <CountryField value={country} onChange={setCountry} disabled={!editing} error={state.fieldErrors?.country} />

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
        {editing ? <ReviewTextMeter guidance={guidance} /> : null}
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
      </>}
      </fieldset>

      {wizard && step < STEPS.length ? <div className="review-form-actions review-step-actions">
        <button className="primary-button" type="button" onClick={() => goTo(step + 1)}>Далее</button>
      </div> : editing ? <div className="review-form-actions">
        <SubmitButton editing={hasReview} tooShort={normalizeReviewText(text).length < MIN_REVIEW_LENGTH} />
        {hasReview && <button className="community-button community-button-secondary" type="button" disabled={busy} onClick={() => {
          setText(saved.current.text); setRatings({ design: saved.current.design, taste: saved.current.taste }); setCountry(saved.current.country); setRetained(saved.current.photos);
          clearPreviews(); setEditing(false); setStep(0); onClose?.(); onSettled?.(true);
        }}>Отмена</button>}
      </div> : null}
    </form>
  );
}
