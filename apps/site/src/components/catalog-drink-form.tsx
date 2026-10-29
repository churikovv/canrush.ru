'use client';
import Image from 'next/image';
import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from 'react';
import Link from '@/components/navigation-progress';
import { FormAlert } from '@/components/form-alert';
import { FormOptional, FormStep } from '@/components/form-step';
import { MarketPhotoPicker } from '@/components/market-photo-picker';
import { submitCatalogDrinkAction } from '@/app/catalog/new/actions';
import { CatalogDrinkBrandInput, CatalogDrinkFlavorInput, type PickedFlavor } from '@/components/catalog-drink-flavor-input';
import { DRINK_JUICE_NAME, DRINK_SUGAR_NAME, DRINK_VOLUME_PRESETS, MAX_DRINK_FLAVORS, MAX_DRINK_FULL_NAME, MAX_DRINK_INGREDIENTS, MAX_DRINK_VOLUMES, volumeLabel, type DrinkSugar } from '@/lib/catalog-drink-fields';

const STEPS = [
  { id: 'drink-step-name', title: 'Бренд и вкус' },
  { id: 'drink-step-photo', title: 'Фото банки' },
  { id: 'drink-step-details', title: 'Объём и состав' },
  { id: 'drink-step-check', title: 'Проверка' },
] as const;
const LAST_STEP = STEPS.length - 1;
/** A version with a sweetener is a drink of its own, so it can sit next to the regular can in the catalog. */
export const SUGAR_OPTIONS: { value: DrinkSugar; title: string; hint: string }[] = [
  { value: 'regular', title: 'С сахаром', hint: 'Обычная банка' },
  { value: 'free', title: 'Без сахара', hint: 'Zero, Sugar Free, Light' },
  { value: 'sweetener', title: 'С сахарозаменителем', hint: 'Часть сахара заменена подсластителем' },
];

/** «С соком» — a mark on top of the sugar choice: some flavours come only with juice, and the can is a drink of its own. */
export function DrinkJuiceOption({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return <fieldset className="catalog-drink-sugar catalog-drink-juice">
    <legend className="catalog-flavor-label">Сок</legend>
    <label className="catalog-drink-sugar-option">
      <input type="checkbox" name="juice" value="1" checked={checked} onChange={event => onChange(event.target.checked)} />
      <span><b>С соком</b><small>В составе есть фруктовый сок — некоторые вкусы выпускают только так</small></span>
    </label>
  </fieldset>;
}

/**
 * «Больше не производится» — a switch: the drink is published straight into the catalog's archive (found by search,
 * out of the main list), for cans that are gone from shops but people still review and collect.
 */
export function DrinkDiscontinuedOption({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="catalog-drink-discontinued">
    <span><b>Больше не производится</b><small>Напиток снят с производства — он попадёт в архив каталога, его найдут поиском</small></span>
    <input type="checkbox" role="switch" name="discontinued" value="1" checked={checked} onChange={event => onChange(event.target.checked)} />
  </label>;
}

/**
 * «Добавить напиток»: four steps like the store form — brand and flavour, a can photo, volumes and the label text,
 * then a preview of the catalog card before it goes to moderation.
 */
/** `inCabinet` — the business cabinet's form: the done screen leads back to the company's drinks. */
export function CatalogDrinkForm({ brands, flavors, inCabinet = false, verified = false }: { brands: string[]; flavors: { key: string; label: string }[]; inCabinet?: boolean; verified?: boolean }) {
  const [state, action, pending] = useActionState(submitCatalogDrinkAction, {});
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [problem, setProblem] = useState('');
  const [brand, setBrand] = useState('');
  const [picked, setPicked] = useState<PickedFlavor[]>([]);
  const [sugar, setSugar] = useState<DrinkSugar>('regular');
  const [juice, setJuice] = useState(false);
  const [discontinued, setDiscontinued] = useState(false);
  const [fullName, setFullName] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [photosBusy, setPhotosBusy] = useState(false);
  const [volumes, setVolumes] = useState<number[]>([]);
  const [otherVolume, setOtherVolume] = useState('');
  const [ingredients, setIngredients] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const busy = pending || photosBusy;

  // The same name the catalog will show (flavorName on the key the server builds).
  // Parts in the server's order (sorted keys and own names), shown by their labels.
  const baseName = [...picked].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)).map(item => item.label).join(' + ');
  const drinkName = baseName ? `${baseName}${juice ? DRINK_JUICE_NAME : ''}${DRINK_SUGAR_NAME[sugar]}` : '';
  const photoUrl = useMemo(() => photos[0] ? URL.createObjectURL(photos[0]) : '', [photos]);
  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl); }, [photoUrl]);

  /** What keeps a step from being finished, or '' when it is ready. */
  function stepProblem(index: number): string {
    if (index === 0) {
      if (brand.trim().length < 2) return 'Укажите бренд.';
      return picked.length ? '' : 'Укажите вкус: начните вводить и выберите подсказку или добавьте свой.';
    }
    if (index === 1) return photos.length ? '' : 'Добавьте фото банки — по нему напиток узнают в каталоге.';
    if (index === 2) return volumes.length ? '' : 'Отметьте хотя бы один объём.';
    return '';
  }
  function show(next: number) {
    setStep(next); setReached(value => Math.max(value, next)); setProblem('');
    requestAnimationFrame(() => { formRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); formRef.current?.querySelectorAll<HTMLElement>('section.form-card')[next]?.focus({ preventScroll: true }); });
  }
  function advance(target: number) {
    if (busy) return;
    if (target > step) {
      for (let index = step; index < target; index++) {
        const issue = stepProblem(index);
        if (issue) { if (index !== step) setStep(index); setProblem(issue); return; }
      }
    }
    show(target);
  }
  function toggleVolume(volume: number) {
    setVolumes(current => current.includes(volume) ? current.filter(item => item !== volume) : current.length < MAX_DRINK_VOLUMES ? [...current, volume].sort((a, b) => a - b) : current);
  }
  function addOtherVolume() {
    const volume = Number(otherVolume);
    if (!Number.isInteger(volume) || volume < 100 || volume > 2000) { setProblem('Объём — целое число от 100 до 2000 мл.'); return; }
    if (!volumes.includes(volume)) toggleVolume(volume);
    setOtherVolume(''); setProblem('');
  }

  if (state.saved && state.published) return <section className="market-empty catalog-drink-done">
    <h2>Напиток в каталоге</h2>
    <p>Компания подтверждена, поэтому «{brand} · {drinkName}» опубликован сразу, без модерации. Чтобы видеть его отзывы в аналитике, прикрепите напиток к компании — это одна заявка.</p>
    <div className="market-empty-actions"><Link href={state.published} className="community-button">Открыть карточку</Link><Link href="/business/cabinet?section=drinks" className="community-button community-button-secondary">Прикрепить к компании</Link></div>
  </section>;
  if (state.saved) return <section className="market-empty catalog-drink-done">
    <h2>Напиток отправлен на проверку</h2>
    <p>Модератор сверит фото и название. После публикации «{brand} · {drinkName}» появится в каталоге — {inCabinet ? 'и его можно будет прикрепить к компании в один клик.' : 'его можно будет оценить, добавить в избранное и отметить в трекере.'}</p>
    {inCabinet
      ? <div className="market-empty-actions"><Link href="/business/cabinet?section=drinks" className="community-button">К напиткам компании</Link><a href="/business/cabinet?section=new-drink" className="community-button community-button-secondary">Добавить ещё</a></div>
      : <div className="market-empty-actions"><Link href="/catalog" className="community-button">В каталог</Link><a href="/catalog/new" className="community-button community-button-secondary">Добавить ещё</a></div>}
  </section>;

  return <form ref={formRef} noValidate className="store-form catalog-drink-form" onSubmit={event => {
    if (step < LAST_STEP) { event.preventDefault(); advance(step + 1); return; }
    const issue = [0, 1, 2].map(stepProblem).find(Boolean);
    if (issue) { event.preventDefault(); const index = [0, 1, 2].findIndex(item => stepProblem(item)); setStep(index); setProblem(issue); }
  }} action={form => {
    if (busy) return;
    // React resets the form after each action, which puts the radios and the checkbox back to their first state in the
    // DOM while the cards still show the choice: a second send («Всё равно отправить») took «С сахаром» and no juice.
    form.set('sugar', sugar);
    if (juice) form.set('juice', '1'); else form.delete('juice');
    if (discontinued) form.set('discontinued', '1'); else form.delete('discontinued');
    if (inCabinet && verified) form.set('business', '1');
    photos.forEach(photo => form.append('photos', photo));
    startTransition(() => action(form));
  }}><fieldset disabled={pending}>
    <p className="store-form-counter" aria-live="polite">Шаг {step + 1} из {STEPS.length} · <b>{STEPS[step]!.title}</b></p>
    <ol className="store-form-progress" aria-label="Этапы заявки">{STEPS.map((item, index) => <li key={item.id} data-state={index === step ? 'current' : index <= reached ? 'visited' : 'upcoming'}>
      <button type="button" disabled={index > reached} aria-current={index === step ? 'step' : undefined} onClick={() => { if (index !== step) advance(index); }}><span className="store-form-progress-label">{index + 1}. {item.title}</span></button>
    </li>)}</ol>

    <section className="form-card" aria-labelledby="drink-step-name" tabIndex={-1} hidden={step !== 0}>
      <FormStep n={1} id="drink-step-name" title="Бренд и вкус" hint="Как написано на банке. Если бренд уже есть в каталоге, выберите его из подсказок." />
      <div className="form-field">
        <label className="catalog-flavor-label" htmlFor="catalog-drink-brand">Бренд</label>
        <CatalogDrinkBrandInput inputId="catalog-drink-brand" brands={brands} value={brand} onChange={setBrand} />
      </div>
      <div className="form-field">
        <label className="catalog-flavor-label" htmlFor="catalog-drink-flavor">Вкус</label>
        <CatalogDrinkFlavorInput inputId="catalog-drink-flavor" flavors={flavors} value={picked} onChange={setPicked} onProblem={setProblem} />
        <p className="store-note">Выберите из подсказок или добавьте свой. Для микса — до {MAX_DRINK_FLAVORS} вкусов, в каталоге он будет называться как «Манго + Маракуйя».</p>
      </div>
      <fieldset className="catalog-drink-sugar">
        <legend className="catalog-flavor-label">Сахар</legend>
        {SUGAR_OPTIONS.map(option => <label key={option.value} className="catalog-drink-sugar-option">
          <input type="radio" name="sugar" value={option.value} checked={sugar === option.value} onChange={() => setSugar(option.value)} />
          <span><b>{option.title}</b><small>{option.hint}</small></span>
        </label>)}
      </fieldset>
      <DrinkJuiceOption checked={juice} onChange={setJuice} />
      <DrinkDiscontinuedOption checked={discontinued} onChange={setDiscontinued} />
      <div className="form-field">
        <label htmlFor="catalog-drink-full-name"><span className="form-label">Полное название {<FormOptional />}</span></label>
        <input id="catalog-drink-full-name" type="text" name="fullName" maxLength={MAX_DRINK_FULL_NAME} autoComplete="off" value={fullName} onChange={event => setFullName(event.target.value)} placeholder="Monster Ultra Paradise" aria-describedby="catalog-drink-full-name-note" />
        <p className="store-note" id="catalog-drink-full-name-note">Как напиток называют целиком, с линейкой. По этому названию его тоже найдут в поиске.</p>
      </div>
      {brand.trim() && drinkName && <p className="catalog-drink-name" role="status">В каталоге: <b>{brand.trim()} · {drinkName}</b></p>}
    </section>

    <section className="form-card store-photo-section" aria-labelledby="drink-step-photo" tabIndex={-1} hidden={step !== 1}>
      <FormStep n={2} id="drink-step-photo" title="Фото банки" hint="Банка целиком, этикетка спереди и читается, лучше на светлом фоне — фото станет обложкой в каталоге." />
      <MarketPhotoPicker compact crop={false} maxPhotos={1} onChange={setPhotos} onBusyChange={setPhotosBusy} disabled={pending} />
    </section>

    <section className="form-card" aria-labelledby="drink-step-details" tabIndex={-1} hidden={step !== 2}>
      <FormStep n={3} id="drink-step-details" title="Объём и состав" hint="Отметьте объёмы, в которых продаётся банка. Состав перепишите с этикетки — он появится в блоке «Состав»." />
      <div className="form-field">
        <span className="form-label">Объём</span>
        {volumes.map(volume => <input key={volume} type="hidden" name="volume" value={volume} />)}
        <div className="catalog-drink-chips" role="group" aria-label="Объёмы">
          {[...new Set([...DRINK_VOLUME_PRESETS, ...volumes])].sort((a, b) => a - b).map(volume => <button key={volume} type="button" aria-pressed={volumes.includes(volume)} onClick={() => toggleVolume(volume)}>{volumeLabel(volume)}</button>)}
        </div>
        <div className="catalog-drink-volume">
          <label><span className="sr-only">Другой объём, мл</span><input type="number" inputMode="numeric" min={100} max={2000} step={1} value={otherVolume} onChange={event => setOtherVolume(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addOtherVolume(); } }} placeholder="Другой, мл" /></label>
          <button type="button" className="community-button community-button-secondary" disabled={!otherVolume.trim() || volumes.length >= MAX_DRINK_VOLUMES} onClick={addOtherVolume}>Добавить</button>
        </div>
      </div>
      <label><span className="form-label">Состав {<FormOptional />}</span>
        <textarea name="ingredients" rows={5} maxLength={MAX_DRINK_INGREDIENTS} value={ingredients} onChange={event => setIngredients(event.target.value)} placeholder="Вода, сахар, регулятор кислотности лимонная кислота, таурин, кофеин…" />
        <small className="catalog-drink-count">{ingredients.length} / {MAX_DRINK_INGREDIENTS}</small>
      </label>
    </section>

    <section className="form-card" aria-labelledby="drink-step-check" tabIndex={-1} hidden={step !== 3}>
      <FormStep n={4} id="drink-step-check" title="Проверка" hint="Так напиток будет выглядеть в каталоге. Модератор проверит фото и название перед публикацией." />
      <div className="catalog-drink-preview">
        <span className="catalog-drink-preview-cover">{photoUrl ? <Image src={photoUrl} width={160} height={200} unoptimized alt="" /> : null}</span>
        <div>
          <small>{brand.trim()}</small>
          <strong>{drinkName}</strong>
          {discontinued && <span className="catalog-drink-archived">В архиве · больше не производится</span>}
          {fullName.trim() && <p>{fullName.trim()}</p>}
          <p>{volumes.map(volumeLabel).join(' · ')}</p>
          <p className="catalog-drink-preview-text">{ingredients.trim() || 'Состав не указан — его можно будет дополнить позже.'}</p>
        </div>
      </div>
      <ul className="catalog-drink-rules">
        {discontinued
          ? <li>Напиток попадёт в архив каталога: его найдут поиском, а в общем списке, тирлистах и дейтинге его не будет.</li>
          : <li>Цен у нового напитка пока нет — они появятся, когда его найдут в магазинах.</li>}
        <li>Отзывы, избранное, трекер, коллекции, тирлисты, дейтинг и рекомендации заработают сразу после публикации.</li>
      </ul>
    </section>

    <div className="form-submit store-form-footer">
      {/* The submitter's name and value reach the action: «Всё равно отправить» is the same request, sent as the member's own version. */}
      {!problem && state.confirmable ? <FormAlert tone="warning" actions={<>{state.duplicate && <Link href={state.duplicate}>{state.duplicate.startsWith('/catalog/pending') ? 'Посмотреть заявки' : 'Открыть карточку'}</Link>}<button className="community-button community-button-secondary" type="submit" name="confirmMatch" value="1" disabled={busy}>Всё равно отправить на проверку</button></>}>{state.error}</FormAlert>
      : (problem || state.error) && <FormAlert actions={!problem && state.duplicate ? <Link href={state.duplicate}>Открыть карточку</Link> : undefined}>{problem || state.error}</FormAlert>}
      <div className="store-form-nav">
        {step > 0 && <button type="button" className="community-button community-button-secondary" disabled={busy} onClick={() => show(step - 1)}>Назад</button>}
        <button className="community-button" disabled={busy} type="submit">{pending ? 'Отправляем…' : step < LAST_STEP ? 'Далее' : 'Отправить на проверку'}</button>
      </div>
    </div>
  </fieldset></form>;
}
