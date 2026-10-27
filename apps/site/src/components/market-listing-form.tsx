'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { MarketPhotoPicker } from './market-photo-picker';
import { PriceFilterInput } from './price-filter-input';
import { DELIVERY, MarketError, formatPrice, parseListing } from '@/lib/market-fields';
import { createListingAction } from '@/app/market/actions';
import { FormStep } from './form-step';
import { FormAlert } from '@/components/form-alert';

const STEPS = [
  { id: 'listing-step-title', title: 'Название' },
  { id: 'listing-step-photos', title: 'Фотографии' },
  { id: 'listing-step-details', title: 'Характеристики' },
  { id: 'listing-step-terms', title: 'Условия продажи' },
  { id: 'listing-step-check', title: 'Проверка' },
] as const;
const LAST_STEP = STEPS.length - 1;

type Fields = { title: string; description: string; price: string; quantity: string; city: string; delivery: string[] };
const EMPTY: Fields = { title: '', description: '', price: '', quantity: '', city: '', delivery: [] };

/**
 * A new market listing, step by step like a drink request (`store-form-progress`, one step on screen, «Назад» / «Далее»):
 * title → photos → brand and description → price, quantity, city and delivery → a check of the card. The same form in
 * the market and in the business cabinet (`inCabinet`: after publishing it returns to the cabinet's listings). Each
 * step is checked before moving on, and the last one runs the server's own `parseListing`, so its messages match.
 */
export function MarketListingForm({ brands, inCabinet = false }: { brands: string[]; inCabinet?: boolean }) {
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [brand, setBrand] = useState('');
  const [anyCity, setAnyCity] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [photosBusy, setPhotosBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const busy = pending || photosBusy;
  const set = (key: keyof Fields) => (event: { target: { value: string } }) => setFields(current => ({ ...current, [key]: event.target.value }));
  const photoUrl = useMemo(() => photos[0] ? URL.createObjectURL(photos[0]) : '', [photos]);
  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl); }, [photoUrl]);

  function formData() {
    const data = new FormData();
    data.set('title', fields.title); data.set('description', fields.description); data.set('brand', brand);
    data.set('price', fields.price); data.set('quantity', fields.quantity);
    if (anyCity) data.set('anyCity', 'on'); else data.set('city', fields.city);
    fields.delivery.forEach(value => data.append('delivery', value));
    return data;
  }
  /** What keeps a step from being finished, or '' when it is ready. */
  function stepProblem(index: number): string {
    if (index === 0) return fields.title.trim() ? fields.title.trim().length > 120 ? 'Название — до 120 символов.' : '' : 'Напишите, что продаёте: бренд, вкус, коллекция.';
    if (index === 1) return photos.length ? '' : 'Добавьте хотя бы одну фотографию банок.';
    if (index === 2) return !brand ? 'Выберите бренд.' : fields.description.trim() ? '' : 'Опишите банки: состояние, срок годности, что входит в набор.';
    if (index === 3) {
      try { parseListing(formData()); return ''; }
      catch (problem) { return problem instanceof MarketError ? problem.message : 'Проверьте условия продажи.'; }
    }
    return '';
  }
  function show(next: number) {
    setStep(next); setReached(value => Math.max(value, next)); setError('');
    requestAnimationFrame(() => { formRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); formRef.current?.querySelectorAll<HTMLElement>('section.form-card')[next]?.focus({ preventScroll: true }); });
  }
  function advance(target: number) {
    if (busy) return;
    if (target > step) for (let index = step; index < target; index++) {
      const issue = stepProblem(index);
      if (issue) { if (index !== step) setStep(index); setError(issue); return; }
    }
    show(target);
  }
  function toggleDelivery(value: string) {
    setFields(current => ({ ...current, delivery: current.delivery.includes(value) ? current.delivery.filter(item => item !== value) : [...current.delivery, value] }));
  }

  let preview: ReturnType<typeof parseListing> | null = null;
  if (step === LAST_STEP) { try { preview = parseListing(formData()); } catch { preview = null; } }

  return <form ref={formRef} noValidate className="store-form market-form market-listing-wizard" onSubmit={event => {
    event.preventDefault();
    if (step < LAST_STEP) { advance(step + 1); return; }
    if (busy) return;
    const index = [0, 1, 2, 3].findIndex(item => stepProblem(item));
    if (index >= 0) { setStep(index); setError(stepProblem(index)); return; }
    const data = formData();
    photos.forEach(photo => data.append('photos', photo));
    setError(''); startTransition(async () => {
      try { const result = await createListingAction(data); if (result.id) router.push(inCabinet ? '/business/cabinet?section=market&created=1' : `/market/${result.id}`); else setError(result.error ?? 'Не удалось опубликовать объявление.'); }
      catch { setError('Не удалось отправить объявление. Проверьте соединение.'); }
    });
  }}><fieldset disabled={pending}>
    <p className="store-form-counter" aria-live="polite">Шаг {step + 1} из {STEPS.length} · <b>{STEPS[step]!.title}</b></p>
    <ol className="store-form-progress" aria-label="Этапы объявления">{STEPS.map((item, index) => <li key={item.id} data-state={index === step ? 'current' : index <= reached ? 'visited' : 'upcoming'}>
      <button type="button" disabled={index > reached} aria-current={index === step ? 'step' : undefined} onClick={() => { if (index !== step) advance(index); }}><span className="store-form-progress-label">{index + 1}. {item.title}</span></button>
    </li>)}</ol>

    <section className="form-card" aria-labelledby="listing-step-title" tabIndex={-1} hidden={step !== 0}>
      <FormStep n={1} id="listing-step-title" title="Название" hint="Коротко, что продаёте: бренд, вкус, коллекция." />
      <label><span className="sr-only">Название объявления</span><input name="title" maxLength={120} value={fields.title} onChange={set('title')} placeholder="Например, «Burn Apple Kiwi, 6 банок»" /></label>
    </section>

    <section className="form-card" aria-labelledby="listing-step-photos" tabIndex={-1} hidden={step !== 1}>
      <FormStep n={2} id="listing-step-photos" title="Фотографии" hint="Нужно хотя бы одно фото банок; первое станет обложкой." />
      <MarketPhotoPicker compact onChange={setPhotos} onBusyChange={setPhotosBusy} disabled={pending} />
    </section>

    <section className="form-card" aria-labelledby="listing-step-details" tabIndex={-1} hidden={step !== 2}>
      <FormStep n={3} id="listing-step-details" title="Характеристики" hint="Бренд помогает найти объявление в фильтрах." />
      <div className="form-field"><label htmlFor="listing-brand">Бренд</label><PriceFilterInput id="listing-brand" value={brand} options={[...brands.map(value => ({ value, label: value })), { value: 'Другой', label: 'Другой бренд' }, { value: 'Разные бренды', label: 'Разные бренды' }]} allLabel="Выберите бренд" onChange={setBrand} /></div>
      <label>Описание<textarea name="description" maxLength={5000} rows={6} value={fields.description} onChange={set('description')} placeholder="Состояние банок, срок годности, что входит в набор" /></label>
    </section>

    <section className="form-card" aria-labelledby="listing-step-terms" tabIndex={-1} hidden={step !== 3}>
      <FormStep n={4} id="listing-step-terms" title="Условия продажи" hint="Цена указывается за одну банку." />
      <div className="market-form-row"><label>Цена за одну банку, ₽<input name="price" inputMode="decimal" maxLength={12} value={fields.price} onChange={set('price')} placeholder="1200" /></label><label>Количество, шт.<input name="quantity" type="number" min={1} max={100000} step={1} inputMode="numeric" value={fields.quantity} onChange={set('quantity')} placeholder="6" /></label></div>
      <label className="market-any-city"><input type="checkbox" checked={anyCity} onChange={event => setAnyCity(event.target.checked)} />Любой город</label>
      {!anyCity && <label>Город<input name="city" maxLength={100} autoComplete="address-level2" value={fields.city} onChange={set('city')} placeholder="Москва" /></label>}
      <fieldset className="market-delivery"><legend>Способы доставки</legend>{Object.entries(DELIVERY).map(([value, label]) => <label key={value}><input type="checkbox" checked={fields.delivery.includes(value)} onChange={() => toggleDelivery(value)} />{label}</label>)}</fieldset>
    </section>

    <section className="form-card" aria-labelledby="listing-step-check" tabIndex={-1} hidden={step !== LAST_STEP}>
      <FormStep n={5} id="listing-step-check" title="Проверка" hint="Так объявление увидят в маркете. Если что-то не так — вернитесь к нужному шагу." />
      {preview && <div className="market-listing-preview">
        <span className="market-listing-preview-cover">{photoUrl ? <Image src={photoUrl} width={160} height={160} unoptimized alt="" /> : null}</span>
        <div>
          <small>{preview.brand}{photos.length > 1 ? ` · ${photos.length} фото` : ''}</small>
          <strong>{preview.title}</strong>
          <p><b>{formatPrice(preview.price)}</b> за банку · {preview.quantity} шт.</p>
          <p>{preview.city} · {preview.delivery.map(value => DELIVERY[value]).join(', ')}</p>
          <p className="market-listing-preview-text">{preview.description}</p>
        </div>
      </div>}
      <p className="market-note">Оплату и доставку вы согласуете с покупателем в переписке. CanRush не принимает платежи и не оформляет доставку.</p>
    </section>

    <div className="form-submit store-form-footer">
      {error && <FormAlert>{error}</FormAlert>}
      <div className="store-form-nav">
        {step > 0 && <button type="button" className="community-button community-button-secondary" disabled={busy} onClick={() => show(step - 1)}>Назад</button>}
        <button className="community-button" disabled={busy} type="submit">{pending ? 'Публикуем…' : step < LAST_STEP ? 'Далее' : 'Опубликовать объявление'}</button>
      </div>
    </div>
  </fieldset></form>;
}
